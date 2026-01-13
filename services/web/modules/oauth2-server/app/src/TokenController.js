import Oauth2Server from './Oauth2Server.js'
import logger from '@overleaf/logger'

/**
 * Check if an OAuth token is valid
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function checkOAuthToken(req, res) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'No authorization header provided',
      })
    }
    
    // Extract token from "Bearer <token>" format
    const token = authHeader.replace(/^Bearer\s+/i, '')
    
    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
      })
    }
    
    const verification = await Oauth2Server.verifyToken(token)
    
    if (!verification.isValid) {
      return res.status(401).json({
        valid: false,
        reason: verification.reason,
      })
    }
    
    return res.json({
      valid: true,
      token: {
        type: verification.token.type,
        scope: verification.token.scope,
        user_id: verification.token.user_id,
        createdAt: verification.token.createdAt,
        expiresAt: verification.token.expiresAt,
        lastUsedAt: verification.token.lastUsedAt,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error checking OAuth token')
    return res.status(500).json({
      error: 'Internal server error',
    })
  }
}

/**
 * Get information about an OAuth token
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function getTokenInfo(req, res) {
  try {
    const authHeader = req.headers.authorization
    
    if (!authHeader) {
      return res.status(401).json({
        error: 'No authorization header provided',
      })
    }
    
    const token = authHeader.replace(/^Bearer\s+/i, '')
    
    if (!token) {
      return res.status(401).json({
        error: 'No token provided',
      })
    }
    
    const tokenInfo = await Oauth2Server.getToken(token)
    
    if (!tokenInfo) {
      return res.status(404).json({
        error: 'Token not found',
      })
    }
    
    return res.json({
      type: tokenInfo.type,
      scope: tokenInfo.scope,
      user_id: tokenInfo.user_id,
      oauthApplication_id: tokenInfo.oauthApplication_id,
      createdAt: tokenInfo.createdAt,
      expiresAt: tokenInfo.expiresAt,
      accessTokenExpiresAt: tokenInfo.accessTokenExpiresAt,
      lastUsedAt: tokenInfo.lastUsedAt,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error getting token info')
    return res.status(500).json({
      error: 'Internal server error',
    })
  }
}

/**
 * Validate an OAuth token (check format and existence)
 * @param {Object} req - Express request object
 * @param {Object} res - Express response object
 */
async function validateToken(req, res) {
  try {
    const { token } = req.body
    
    if (!token) {
      return res.status(400).json({
        error: 'No token provided in request body',
      })
    }
    
    const verification = await Oauth2Server.verifyToken(token)
    
    return res.json({
      valid: verification.isValid,
      reason: verification.reason,
      token: verification.token ? {
        type: verification.token.type,
        scope: verification.token.scope,
        user_id: verification.token.user_id,
      } : null,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error validating token')
    return res.status(500).json({
      error: 'Internal server error',
    })
  }
}

export default {
  checkOAuthToken,
  getTokenInfo,
  validateToken,
}
