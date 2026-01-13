import crypto from 'node:crypto'

/**
 * Hash a secret using SHA-512
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
