import crypto from 'node:crypto'

/**
 * Hash a secret using SHA-512
 * 
 * Note: SHA-512 is used here for OAuth tokens (not passwords).
 * This is consistent with the existing Overleaf OAuth implementation
 * and is appropriate for high-entropy random tokens where the token
 * itself provides the security, not the hashing algorithm.
 * 
 * @param {string} secret - The secret to hash
 * @returns {string} The hashed secret
 */
export function hashSecret(secret) {
  return crypto.createHash('sha512').update(secret).digest('hex')
}

/**
 * Compare a plain text secret with a hashed secret
 * @param {string} plainSecret - The plain text secret
 * @param {string} hashedSecret - The hashed secret to compare against
 * @returns {boolean} True if the secrets match
 */
export function compareSecret(plainSecret, hashedSecret) {
  const hashedPlain = hashSecret(plainSecret)
  return hashedPlain === hashedSecret
}
