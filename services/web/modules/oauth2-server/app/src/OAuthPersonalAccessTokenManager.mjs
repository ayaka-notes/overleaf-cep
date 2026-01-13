import crypto from 'node:crypto'
import { db, ObjectId } from '../../../../app/src/infrastructure/mongodb.js'
import { hashSecret } from './SecretsHelper.js'

const PERSONAL_ACCESS_TOKEN_PREFIX = 'olpat_'

/**
 * Generate a random token
 */
function generateToken() {
  const randomBytes = crypto.randomBytes(32)
  return PERSONAL_ACCESS_TOKEN_PREFIX + randomBytes.toString('hex')
}

/**
 * Create a personal access token for a user
 * @param {string} userId - The user ID
 * @returns {Promise<string>} The generated token
 */
async function createToken(userId) {
  const token = generateToken()
  const hashedToken = hashSecret(token)
  
  const tokenData = {
    accessToken: hashedToken,
    accessTokenPartial: token.slice(-8),
    type: 'personal',
    oauthApplication_id: null,
    user_id: userId,
    scope: '*',
    createdAt: new Date(),
    expiresAt: null, // Personal access tokens don't expire by default
    lastUsedAt: null,
  }
  
  await db.oauthAccessTokens.insertOne(tokenData)
  
  return token
}

/**
 * Get all personal access tokens for a user
 * @param {string} userId - The user ID
 * @returns {Promise<Array>} Array of token objects
 */
async function getUserTokens(userId) {
  const tokens = await db.oauthAccessTokens
    .find({
      user_id: userId,
      type: 'personal',
    })
    .toArray()
  
  return tokens.map(token => ({
    _id: token._id,
    accessTokenPartial: token.accessTokenPartial,
    createdAt: token.createdAt,
    lastUsedAt: token.lastUsedAt,
    scope: token.scope,
  }))
}

/**
 * Delete a personal access token
 * @param {string} userId - The user ID
 * @param {string} tokenId - The token ID
 * @returns {Promise<boolean>} True if deleted successfully
 */
async function deleteToken(userId, tokenId) {
  const result = await db.oauthAccessTokens.deleteOne({
    _id: new ObjectId(tokenId),
    user_id: userId,
    type: 'personal',
  })
  
  return result.deletedCount > 0
}

/**
 * Update the last used timestamp for a token
 * @param {string} hashedToken - The hashed token
 */
async function updateLastUsed(hashedToken) {
  await db.oauthAccessTokens.updateOne(
    { accessToken: hashedToken },
    { $set: { lastUsedAt: new Date() } }
  )
}

export default {
  createToken,
  getUserTokens,
  deleteToken,
  updateLastUsed,
}
