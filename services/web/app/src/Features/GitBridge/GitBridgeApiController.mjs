// Controller for API v0 endpoints used by git-bridge
// These endpoints provide git-bridge with access to project data, versions, and snapshots

import { callbackify } from 'node:util'
import { expressify } from '@overleaf/promise-utils'
import logger from '@overleaf/logger'
import { fetchJson } from '@overleaf/fetch-utils'
import settings from '@overleaf/settings'
import ProjectGetter from '../Project/ProjectGetter.mjs'
import HistoryManager from '../History/HistoryManager.mjs'
import UserGetter from '../User/UserGetter.js'
import { Snapshot } from 'overleaf-editor-core'
import Errors from '../Errors/Errors.js'

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
    let labels = await fetchJson(
      `${settings.apis.project_history.url}/project/${projectId}/labels`
    )

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
        const historyId = await HistoryManager.promises.getHistoryId(projectId)
        
        // Build URL to blob endpoint
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

  try {
    // Get project to verify it exists
    const project = await ProjectGetter.promises.getProject(projectId, {
      name: 1,
    })

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    // TODO: Implement snapshot push logic
    // This would involve:
    // 1. Validating the latestVerId matches current version
    // 2. Processing the files array (downloading from URLs if modified)
    // 3. Updating the project with new content
    // 4. Posting back results to postbackUrl
    
    // For now, return "not implemented" response
    logger.warn(
      { projectId, latestVerId },
      'Snapshot push not yet implemented'
    )
    
    res.status(501).json({
      status: 501,
      code: 'notImplemented',
      message: 'Snapshot push not yet implemented',
    })
  } catch (err) {
    logger.error({ err, projectId }, 'Error posting snapshot')
    next(err)
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
