// Controller for API v0 endpoints used by git-bridge
// These endpoints provide git-bridge with access to project data, versions, and snapshots

import { callbackify } from 'node:util'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import { fetchJson, fetchStream } from '@overleaf/fetch-utils'
import settings from '@overleaf/settings'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import UserGetter from '../User/UserGetter.js'
import { Snapshot } from 'overleaf-editor-core'
import Errors from '../Errors/Errors.js'
import EditorController from '../Editor/EditorController.mjs'
import ProjectEntityHandler from '../Project/ProjectEntityHandler.mjs'
import FileTypeManager from '../Uploads/FileTypeManager.js'
import crypto from 'node:crypto'
import fs from 'node:fs'
import fsPromises from 'node:fs/promises'
import { pipeline } from 'node:stream/promises'
import Path from 'node:path'

/**
 * GET /api/v0/docs/:project_id
 * Returns the latest version info for a project
 */
async function getDoc(req, res, next) {
  const projectId = req.params.project_id

  try {
    // Get project
    const project = await ProjectGetter.promises.getProject(projectId, {
      name: 1,
      owner_ref: 1,
    })

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Get latest history version
    const historyId = await HistoryManager.promises.getHistoryId(projectId)
    const latestHistory = await HistoryManager.promises.getLatestHistory(
      projectId
    )

    if (!latestHistory || !latestHistory.updates) {
      // No history yet, return minimal response
      return res.json({
        latestVerId: 0,
        latestVerAt: new Date().toISOString(),
        latestVerBy: null,
      })
    }

    // Get the most recent update
    const updates = latestHistory.updates
    const latestUpdate = updates[0] // updates are sorted newest first

    let latestVerBy = null
    if (latestUpdate.meta && latestUpdate.meta.users) {
      const userId = latestUpdate.meta.users[0]
      if (userId) {
        const user = await UserGetter.promises.getUser(userId, {
          email: 1,
          first_name: 1,
          last_name: 1,
        })
        if (user) {
          const name = [user.first_name, user.last_name]
            .filter(Boolean)
            .join(' ')
          latestVerBy = {
            email: user.email,
            name: name || user.email,
          }
        }
      }
    }

    const response = {
      latestVerId: latestUpdate.toV || 0,
      latestVerAt: latestUpdate.meta.end_ts
        ? new Date(latestUpdate.meta.end_ts).toISOString()
        : new Date().toISOString(),
      latestVerBy,
    }

    res.json(response)
  } catch (err) {
    logger.error({ err, projectId }, 'Error getting doc info')
    next(err)
  }
}

/**
 * GET /api/v0/docs/:project_id/saved_vers
 * Returns the list of saved versions (labels) for a project
 */
async function getSavedVers(req, res, next) {
  const projectId = req.params.project_id

  try {
    // Get project to verify it exists
    const project = await ProjectGetter.promises.getProject(projectId, {
      name: 1,
    })

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Get labels from project-history service
    let labels
    try {
      labels = await fetchJson(
        `${settings.apis.project_history.url}/project/${projectId}/labels`
      )
    } catch (err) {
      // If no labels exist, return empty array
      if (err.response?.status === 404) {
        labels = []
      } else {
        throw err
      }
    }

    // Enrich labels with user information
    labels = await enrichLabels(labels)

    // Transform to git-bridge format
    const savedVers = labels.map(label => ({
      versionId: label.version,
      comment: label.comment,
      user: {
        email: label.user_display_name || label.user?.email || 'unknown',
        name: label.user_display_name || label.user?.name || 'unknown',
      },
      createdAt: label.created_at,
    }))

    res.json(savedVers)
  } catch (err) {
    logger.error({ err, projectId }, 'Error getting saved versions')
    next(err)
  }
}

/**
 * GET /api/v0/docs/:project_id/snapshots/:version
 * Returns the snapshot (file contents) for a specific version
 */
async function getSnapshot(req, res, next) {
  const projectId = req.params.project_id
  const version = parseInt(req.params.version, 10)

  try {
    // Get project to verify it exists
    const project = await ProjectGetter.promises.getProject(projectId, {
      name: 1,
    })

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Get snapshot content from history service
    const snapshotRaw = await HistoryManager.promises.getContentAtVersion(
      projectId,
      version
    )

    const snapshot = Snapshot.fromRaw(snapshotRaw)

    // Build response in git-bridge format
    // Note: srcs and atts are arrays of arrays: [[content, path], [content, path], ...]
    const srcs = []
    const atts = []

    // Process all files in the snapshot
    const files = snapshot.getFileMap()
    for (const [pathname, file] of files) {
      if (file.isEditable()) {
        // Text file - include content directly as [content, path] array
        srcs.push([file.getContent(), pathname])
      } else {
        // Binary file - provide URL to download as [url, path] array
        const hash = file.getHash()
        
        // Build URL to blob endpoint (already exists in web service)
        const blobUrl = `${settings.siteUrl}/project/${projectId}/blob/${hash}`
        
        atts.push([blobUrl, pathname])
      }
    }

    const response = {
      srcs,
      atts,
    }

    res.json(response)
  } catch (err) {
    if (err instanceof Errors.NotFoundError) {
      return res.status(404).json({ message: 'Version not found' })
    }
    logger.error({ err, projectId, version }, 'Error getting snapshot')
    next(err)
  }
}

/**
 * POST /api/v0/docs/:project_id/snapshots
 * Receives a push from git-bridge with file changes
 */
async function postSnapshot(req, res, next) {
  const projectId = req.params.project_id
  const { latestVerId, files, postbackUrl } = req.body
  
  // Use git-bridge user ID (system user) for operations
  // If not configured, operations will be performed as system user (null)
  const userId = settings.gitBridgeUserId ?? null

  try {
    // Get project to verify it exists
    const project = await ProjectGetter.promises.getProject(projectId, {
      name: 1,
      rootFolder: 1,
    })

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // Validate latestVerId matches current version
    const latestHistory = await HistoryManager.promises.getLatestHistory(
      projectId
    )
    
    let currentVersion = 0
    if (latestHistory && latestHistory.updates && latestHistory.updates.length > 0) {
      currentVersion = latestHistory.updates[0].toV || 0
    }

    if (latestVerId !== currentVersion) {
      // Version mismatch - return 409 Conflict
      logger.info(
        { projectId, latestVerId, currentVersion },
        'Push rejected: version out of date'
      )
      
      // Send response immediately
      res.status(409).json({
        status: 409,
        code: 'outOfDate',
        message: 'Out of Date',
      })
      
      // Postback the out of date result
      if (postbackUrl) {
        await sendPostback(postbackUrl, {
          code: 'outOfDate',
          message: 'Out of Date',
        })
      }
      
      return
    }

    // Accept the push request immediately (202 Accepted)
    res.status(202).json({
      status: 202,
      code: 'accepted',
      message: 'Accepted',
    })

    // Process the push asynchronously
    processSnapshotPush(projectId, files, postbackUrl, userId).catch(err => {
      logger.error({ err, projectId }, 'Error processing snapshot push')
    })
  } catch (err) {
    logger.error({ err, projectId }, 'Error posting snapshot')
    next(err)
  }
}

/**
 * Process the snapshot push asynchronously
 */
async function processSnapshotPush(projectId, files, postbackUrl, userId) {
  try {
    logger.info({ projectId, fileCount: files.length }, 'Processing snapshot push')
    
    // Get all current entities to determine what needs to be deleted
    const { docs, files: existingFiles } =
      await ProjectEntityHandler.promises.getAllEntities(projectId)
    
    const existingPaths = new Set()
    docs.forEach(doc => existingPaths.add(doc.path))
    existingFiles.forEach(file => existingPaths.add(file.path))
    
    // Track which paths are in the new snapshot
    const newPaths = new Set(files.map(f => f.name))
    
    // Validate files first
    const invalidFiles = []
    for (const file of files) {
      const validation = validateFilePath(file.name)
      if (!validation.valid) {
        invalidFiles.push({
          file: file.name,
          state: validation.state,
          cleanFile: validation.cleanPath,
        })
      }
    }
    
    if (invalidFiles.length > 0) {
      logger.warn({ projectId, invalidFiles }, 'Invalid files in push')
      await sendPostback(postbackUrl, {
        code: 'invalidFiles',
        errors: invalidFiles,
      })
      return
    }
    
    // Process file updates/creations
    for (const file of files) {
      if (file.url) {
        // File has been modified - download and update it
        await processFileUpdate(projectId, file.name, file.url, userId)
      }
      // If no URL, file exists but hasn't changed - no action needed
    }
    
    // Delete files that are no longer in the snapshot
    const pathsToDelete = [...existingPaths].filter(path => !newPaths.has(path))
    for (const path of pathsToDelete) {
      try {
        await EditorController.promises.deleteEntityWithPath(
          projectId,
          path,
          'git-bridge',
          userId
        )
        logger.debug({ projectId, path }, 'Deleted file from project')
      } catch (err) {
        logger.warn({ err, projectId, path }, 'Failed to delete file')
      }
    }
    
    // Get new version after updates
    const updatedHistory = await HistoryManager.promises.getLatestHistory(
      projectId
    )
    let newVersion = 0
    if (updatedHistory && updatedHistory.updates && updatedHistory.updates.length > 0) {
      newVersion = updatedHistory.updates[0].toV || 0
    }
    
    // Send success postback
    await sendPostback(postbackUrl, {
      code: 'upToDate',
      latestVerId: newVersion,
    })
    
    logger.info({ projectId, newVersion }, 'Snapshot push completed successfully')
  } catch (err) {
    logger.error({ err, projectId }, 'Error in processSnapshotPush')
    
    // Send error postback
    if (postbackUrl) {
      try {
        await sendPostback(postbackUrl, {
          code: 'error',
          message: 'Unexpected Error',
        })
      } catch (postbackErr) {
        logger.error({ err: postbackErr, projectId }, 'Failed to send error postback')
      }
    }
  }
}

/**
 * Process a single file update
 */
async function processFileUpdate(projectId, filePath, fileUrl, userId) {
  let fsPath = null
  
  try {
    // Download file to temporary location
    fsPath = await downloadFile(projectId, fileUrl)
    
    // Determine if this should be a doc or binary file
    const fileType = await determineFileType(projectId, filePath, fsPath)
    
    if (fileType === 'doc') {
      // Process as text document
      const docLines = await readFileIntoTextArray(fsPath)
      await EditorController.promises.upsertDocWithPath(
        projectId,
        filePath,
        docLines,
        'git-bridge',
        userId
      )
      logger.debug({ projectId, filePath }, 'Updated doc from git-bridge')
    } else {
      // Process as binary file
      await EditorController.promises.upsertFileWithPath(
        projectId,
        filePath,
        fsPath,
        null, // linkedFileData
        'git-bridge',
        userId
      )
      logger.debug({ projectId, filePath }, 'Updated file from git-bridge')
    }
  } finally {
    // Clean up temporary file
    if (fsPath) {
      try {
        await fsPromises.unlink(fsPath)
      } catch (err) {
        logger.warn({ err, fsPath }, 'Failed to delete temporary file')
      }
    }
  }
}

/**
 * Download a file from URL to temporary location
 */
async function downloadFile(projectId, url) {
  const fsPath = Path.join(
    settings.path.dumpFolder,
    `${projectId}_${crypto.randomUUID()}`
  )
  
  const writeStream = fs.createWriteStream(fsPath)
  
  try {
    const readStream = await fetchStream(url)
    await pipeline(readStream, writeStream)
    return fsPath
  } catch (err) {
    // Clean up on error
    try {
      await fsPromises.unlink(fsPath)
    } catch (unlinkErr) {
      logger.warn({ err: unlinkErr, fsPath }, 'Failed to delete file after download error')
    }
    throw err
  }
}

/**
 * Determine if a file should be treated as a doc or binary file
 */
async function determineFileType(projectId, path, fsPath) {
  // Check if there is an existing file with the same path
  const { docs, files } =
    await ProjectEntityHandler.promises.getAllEntities(projectId)
  
  const existingDoc = docs.find(d => d.path === path)
  const existingFile = files.find(f => f.path === path)
  const existingFileType = existingDoc ? 'doc' : existingFile ? 'file' : null
  
  // Determine whether the update should create a doc or binary file
  const { binary, encoding } = await FileTypeManager.promises.getType(
    path,
    fsPath,
    existingFileType
  )
  
  // If we receive a non-utf8 encoding, treat as binary
  const isBinary = binary || encoding !== 'utf-8'
  
  // If a binary file already exists, always keep it as a binary file
  if (existingFileType === 'file') {
    return 'file'
  } else {
    return isBinary ? 'file' : 'doc'
  }
}

/**
 * Read a file into an array of lines
 */
async function readFileIntoTextArray(fsPath) {
  let content = await fsPromises.readFile(fsPath, 'utf8')
  if (content === null || content === undefined) {
    content = ''
  }
  const lines = content.split(/\r\n|\n|\r/)
  return lines
}

/**
 * Validate a file path
 */
function validateFilePath(path) {
  // Check for invalid characters or patterns
  // Git-bridge already handles most validation, but we do basic checks
  
  if (!path || path.length === 0) {
    return { valid: false, state: 'error' }
  }
  
  // Check for null bytes
  if (path.includes('\0')) {
    return { valid: false, state: 'error' }
  }
  
  // Check for suspicious patterns
  if (path.includes('..') || path.startsWith('/')) {
    return { valid: false, state: 'error' }
  }
  
  // Check for .git directory
  if (path.startsWith('.git/') || path === '.git') {
    return { valid: false, state: 'disallowed' }
  }
  
  return { valid: true }
}

/**
 * Send postback notification to git-bridge
 */
async function sendPostback(postbackUrl, data) {
  if (!postbackUrl) {
    return
  }
  
  try {
    await fetchJson(postbackUrl, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(data),
    })
    logger.debug({ postbackUrl, data }, 'Postback sent successfully')
  } catch (err) {
    logger.error(
      { err, postbackUrl, data },
      'Failed to send postback to git-bridge'
    )
    throw err
  }
}

/**
 * Enrich labels with user information
 */
async function enrichLabels(labels) {
  if (!labels || !labels.length) {
    return []
  }

  // Get unique user IDs
  const uniqueUsers = new Set(labels.map(label => label.user_id))
  uniqueUsers.delete(null)
  uniqueUsers.delete(undefined)

  // Fetch user details
  const userDetailsMap = new Map()
  for (const userId of uniqueUsers) {
    try {
      const user = await UserGetter.promises.getUser(userId, {
        email: 1,
        first_name: 1,
        last_name: 1,
      })
      if (user) {
        const name = [user.first_name, user.last_name]
          .filter(Boolean)
          .join(' ')
        userDetailsMap.set(userId.toString(), {
          email: user.email,
          name: name || user.email,
        })
      }
    } catch (err) {
      logger.warn({ err, userId }, 'Failed to get user details for label')
    }
  }

  // Enrich labels
  return labels.map(label => {
    const enrichedLabel = { ...label }
    if (label.user_id) {
      const userDetails = userDetailsMap.get(label.user_id.toString())
      if (userDetails) {
        enrichedLabel.user = userDetails
        enrichedLabel.user_display_name = userDetails.name
      }
    }
    return enrichedLabel
  })
}

export default {
  getDoc: expressify(getDoc),
  getSavedVers: expressify(getSavedVers),
  getSnapshot: expressify(getSnapshot),
  postSnapshot: expressify(postSnapshot),
}
