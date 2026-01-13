import OAuthPersonalAccessTokenManager from './OAuthPersonalAccessTokenManager.mjs'
import logger from '@overleaf/logger'
import SessionManager from '../../../../app/src/Features/Authentication/SessionManager.js'

/**
 * Get all personal access tokens for the logged-in user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getUserPersonalAccessTokens(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    
    if (!userId) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }
    
    const tokens = await OAuthPersonalAccessTokenManager.getUserTokens(userId)
    
    return res.json({
      tokens,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error getting user personal access tokens')
    return res.status(500).json({
      error: 'Internal server error',
    })
  }
}

/**
 * Create a new personal access token for the logged-in user
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function createPersonalAccessToken(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    
    if (!userId) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }
    
    const token = await OAuthPersonalAccessTokenManager.createToken(userId)
    
    return res.json({
      token,
      message: 'Personal access token created successfully. Please save this token as it will not be shown again.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error creating personal access token')
    return res.status(500).json({
      error: 'Internal server error',
    })
  }
}

/**
 * Delete a personal access token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function deletePersonalAccessToken(req, res) {
  try {
    const userId = SessionManager.getLoggedInUserId(req.session)
    
    if (!userId) {
      return res.status(401).json({
        error: 'Not authenticated',
      })
    }
    
    const { token_id } = req.params
    
    if (!token_id) {
      return res.status(400).json({
        error: 'Token ID is required',
      })
    }
    
    const deleted = await OAuthPersonalAccessTokenManager.deleteToken(
      userId,
      token_id
    )
    
    if (!deleted) {
      return res.status(404).json({
        error: 'Token not found or already deleted',
      })
    }
    
    return res.json({
      message: 'Token deleted successfully',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error deleting personal access token')
    return res.status(500).json({
      error: 'Internal server error',
    })
  }
}

export default {
  getUserPersonalAccessTokens,
  createPersonalAccessToken,
  deletePersonalAccessToken,
}
