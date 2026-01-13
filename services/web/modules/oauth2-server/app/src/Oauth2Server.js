import { db } from '../../../../app/src/infrastructure/mongodb.js'
import { hashSecret, compareSecret } from './SecretsHelper.js'
import OAuthPersonalAccessTokenManager from './OAuthPersonalAccessTokenManager.mjs'

/**
 * Get token information from the database
 * @param {string} accessToken - The access token (plain text)
 * @returns {Promise<Object|null>} Token information or null if not found
 */
async function getToken(accessToken) {
  const hashedToken = hashSecret(accessToken)
  
  const token = await db.oauthAccessTokens.findOne({
    accessToken: hashedToken,
  })
  
  if (!token) {
    return null
  }
  
  // Update last used timestamp
  await OAuthPersonalAccessTokenManager.updateLastUsed(hashedToken)
  
  return token
}

/**
 * Verify if a token is valid
 * @param {string} accessToken - The access token (plain text)
 * @returns {Promise<Object>} Validation result with isValid and token info
 */
async function verifyToken(accessToken) {
  const token = await getToken(accessToken)
  
  if (!token) {
    return {
      isValid: false,
      reason: 'Token not found',
    }
  }
  
  // Check if token has expired
  if (token.expiresAt && new Date() > new Date(token.expiresAt)) {
    return {
      isValid: false,
      reason: 'Token expired',
      token,
    }
  }
  
  // Check if token has an expiry date for access tokens
  if (token.accessTokenExpiresAt && new Date() > new Date(token.accessTokenExpiresAt)) {
    return {
      isValid: false,
      reason: 'Access token expired',
      token,
    }
  }
  
  return {
    isValid: true,
    token,
  }
}

/**
 * Get OAuth application by client ID
 * @param {string} clientId - The client ID
 * @returns {Promise<Object|null>} Application object or null
 */
async function getApplication(clientId) {
  return await db.oauthApplications.findOne({ id: clientId })
}

/**
 * Validate client credentials
 * @param {string} clientId - The client ID
 * @param {string} clientSecret - The client secret
 * @returns {Promise<boolean>} True if credentials are valid
 */
async function validateClient(clientId, clientSecret) {
  const application = await getApplication(clientId)
  
  if (!application) {
    return false
  }
  
  if (!application.clientSecret) {
    return false
  }
  
  return compareSecret(clientSecret, application.clientSecret)
}

export default {
  getToken,
  verifyToken,
  getApplication,
  validateClient,
}
