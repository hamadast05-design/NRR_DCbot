const { createCipheriv, createDecipheriv, randomBytes } = require('node:crypto');

const PREFIX = 'enc:v1:';
const ALGORITHM = 'aes-256-gcm';

function getEncryptionKey() {
  const encoded = process.env.WEBHOOK_TOKEN_ENCRYPTION_KEY;
  if (!encoded) {
    throw new Error('WEBHOOK_TOKEN_ENCRYPTION_KEY is required to access stored webhook credentials.');
  }

  const key = Buffer.from(encoded, 'base64');
  if (key.length !== 32 || key.toString('base64') !== encoded.trim()) {
    throw new Error('WEBHOOK_TOKEN_ENCRYPTION_KEY must be a canonical base64-encoded 32-byte key.');
  }
  return key;
}

function isEncrypted(value) {
  return typeof value === 'string' && value.startsWith(PREFIX);
}

function encryptWebhookToken(token) {
  if (typeof token !== 'string' || !token) {
    throw new TypeError('A non-empty webhook token is required.');
  }
  if (isEncrypted(token)) return token;

  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, getEncryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(token, 'utf8'), cipher.final()]);
  const tag = cipher.getAuthTag();

  return PREFIX + [
    iv.toString('base64'),
    tag.toString('base64'),
    ciphertext.toString('base64'),
  ].join(':');
}

function decryptWebhookToken(value) {
  if (!isEncrypted(value)) {
    throw new Error('Stored webhook token is not encrypted. Run the webhook credential migration before using it.');
  }

  const parts = value.slice(PREFIX.length).split(':');
  if (parts.length !== 3) throw new Error('Stored webhook token has an invalid encrypted format.');

  const [iv, tag, ciphertext] = parts.map(part => Buffer.from(part, 'base64'));
  if (iv.length !== 12 || tag.length !== 16 || ciphertext.length === 0) {
    throw new Error('Stored webhook token has invalid encrypted data.');
  }

  const decipher = createDecipheriv(ALGORITHM, getEncryptionKey(), iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(ciphertext), decipher.final()]).toString('utf8');
}

module.exports = { encryptWebhookToken, decryptWebhookToken, isEncrypted };
