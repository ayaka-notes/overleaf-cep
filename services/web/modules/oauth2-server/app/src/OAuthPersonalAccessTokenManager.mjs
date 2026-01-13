import { OauthAccessToken } from '../../../../app/src/models/OauthAccessToken.js'
import { OauthApplication } from '../../../../app/src/models/OauthApplication.js'
import { User } from '../../../../app/src/models/User.js'
import {
  hashSecret,
  generateToken,
  createPartialToken,
} from './SecretsHelper.js'
import mongodb from 'mongodb-legacy'

const { ObjectId } = mongodb

/**
 * Personal Access Token type identifier
 */
const PERSONAL_ACCESS_TOKEN_TYPE = 'personal_access_token'

/**
 * Default scopes for personal access tokens
 */
const DEFAULT_SCOPES = 'read_write'

/**
 * Personal Access Token Manager
 * Handles creation and management of personal access tokens
 */
class OAuthPersonalAccessTokenManager {
  /**
   * Create a personal access token for a user
   * @param {string} userId - The user ID
   * @param {string} name - Name/description for the token (optional)
   * @param {string} scope - Scope for the token (default: 'read_write')
   * @param {Date} expiresAt - Expiration date (default: 1 year from now)
   * @returns {Promise<string>} The generated access token (plain text)
   */
  async createToken(userId, name = null, scope = DEFAULT_SCOPES, expiresAt = null) {
    // Validate user exists
    const user = await User.findById(userId).exec()
    if (!user) {
      throw new Error(`User not found: ${userId}`)
    }

    // Generate a new access token
    const accessToken = generateToken(32)
    const accessTokenPartial = createPartialToken(accessToken)

    // Set default expiration to 1 year from now if not provided
    const tokenExpiresAt = expiresAt || new Date(Date.now() + 365 * 24 * 60 * 60 * 1000)

    // Create the token document
    const tokenData = {
      accessToken: hashSecret(accessToken),
      accessTokenPartial,
      type: PERSONAL_ACCESS_TOKEN_TYPE,
      accessTokenExpiresAt: tokenExpiresAt,
      scope,
      user_id: new ObjectId(userId),
      createdAt: new Date(),
      oauthApplication_id: null, // Personal access tokens don't have an associated application
    }

    if (name) {
      tokenData.name = name
    }

    await OauthAccessToken.create(tokenData)

    // Return the plain text token (this is the only time it will be available)
    return accessToken
  }

  /**
   * List all personal access tokens for a user
   * @param {string} userId - The user ID
   * @returns {Promise<Array>} Array of token objects (without the actual token)
   */
  async listTokens(userId) {
    const tokens = await OauthAccessToken.find({
      user_id: new ObjectId(userId),
      type: PERSONAL_ACCESS_TOKEN_TYPE,
    })
      .select('-accessToken') // Don't include the hashed token
      .sort({ createdAt: -1 })
      .lean()
      .exec()

    return tokens
  }

  /**
   * Revoke a personal access token
   * @param {string} userId - The user ID
   * @param {string} tokenId - The token document ID
   * @returns {Promise<boolean>} True if revoked successfully
   */
  async revokeToken(userId, tokenId) {
    const result = await OauthAccessToken.deleteOne({
      _id: new ObjectId(tokenId),
      user_id: new ObjectId(userId),
      type: PERSONAL_ACCESS_TOKEN_TYPE,
    }).exec()

    return result.deletedCount > 0
  }

  /**
   * Revoke all personal access tokens for a user
   * @param {string} userId - The user ID
   * @returns {Promise<number>} Number of tokens revoked
   */
  async revokeAllTokens(userId) {
    const result = await OauthAccessToken.deleteMany({
      user_id: new ObjectId(userId),
      type: PERSONAL_ACCESS_TOKEN_TYPE,
    }).exec()

    return result.deletedCount
  }

  /**
   * Update last used timestamp for a token
   * @param {string} tokenId - The token document ID
   * @returns {Promise<void>}
   */
  async updateLastUsed(tokenId) {
    await OauthAccessToken.updateOne(
      { _id: new ObjectId(tokenId) },
      { $set: { lastUsedAt: new Date() } }
    ).exec()
  }

  /**
   * Get token by its hashed value
   * @param {string} accessToken - The plain text access token
   * @returns {Promise<Object|null>} Token object or null
   */
  async getTokenByValue(accessToken) {
    const hashedToken = hashSecret(accessToken)
    const token = await OauthAccessToken.findOne({
      accessToken: hashedToken,
      type: PERSONAL_ACCESS_TOKEN_TYPE,
    })
      .populate('user_id')
      .lean()
      .exec()

    if (!token) {
      return null
    }

    // Check if token is expired
    if (token.accessTokenExpiresAt && token.accessTokenExpiresAt < new Date()) {
      return null
    }

    return token
  }
}

export default new OAuthPersonalAccessTokenManager()
