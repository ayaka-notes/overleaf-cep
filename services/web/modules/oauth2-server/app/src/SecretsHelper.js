import crypto from 'node:crypto'

/**
 * Hash a secret using SHA256
 * @param {string} secret - The secret to hash
 * @returns {string} The hashed secret in hex format
 */
export function hashSecret(secret) {
  if (!secret) {
    throw new Error('Secret is required for hashing')
  }
  return crypto.createHash('sha256').update(secret).digest('hex')
}

/**
 * Verify a secret against a hashed secret
 * @param {string} secret - The plain text secret
 * @param {string} hashedSecret - The hashed secret to compare against
 * @returns {boolean} True if the secret matches the hash
 */
export function verifySecret(secret, hashedSecret) {
  if (!secret || !hashedSecret) {
    return false
  }
  const hash = hashSecret(secret)
  return crypto.timingSafeEqual(Buffer.from(hash), Buffer.from(hashedSecret))
}

/**
 * Generate a random token
 * @param {number} length - The length of the token in bytes (default 32)
 * @returns {string} A random token in hex format
 */
export function generateToken(length = 32) {
  return crypto.randomBytes(length).toString('hex')
}

/**
 * Length of partial token for display purposes
 */
const PARTIAL_TOKEN_LENGTH = 8

/**
 * Create a partial token for display purposes (first 8 characters)
 * @param {string} token - The full token
 * @returns {string} The partial token
 */
export function createPartialToken(token) {
  if (!token || token.length < PARTIAL_TOKEN_LENGTH) {
    return token
  }
  return token.substring(0, PARTIAL_TOKEN_LENGTH)
}
