const test = require('node:test');
const assert = require('node:assert/strict');
const { randomBytes } = require('node:crypto');
const {
  encryptWebhookToken,
  decryptWebhookToken,
  isEncrypted,
} = require('../src/webhook-crypto');

function setTestKey() {
  process.env.WEBHOOK_TOKEN_ENCRYPTION_KEY = randomBytes(32).toString('base64');
}

test('webhook tokens encrypt and decrypt with the configured key', () => {
  setTestKey();
  const token = 'test-webhook-token-value';
  const encrypted = encryptWebhookToken(token);

  assert.notEqual(encrypted, token);
  assert.equal(isEncrypted(encrypted), true);
  assert.equal(decryptWebhookToken(encrypted), token);
});

test('webhook token encryption uses a fresh nonce for each write', () => {
  setTestKey();
  const token = 'same-token';
  assert.notEqual(encryptWebhookToken(token), encryptWebhookToken(token));
});

test('tampered ciphertext is rejected', () => {
  setTestKey();
  const encrypted = encryptWebhookToken('test-webhook-token-value');
  const parts = encrypted.split(':');
  parts[3] = (parts[3][0] === 'A' ? 'B' : 'A') + parts[3].slice(1);

  assert.throws(() => decryptWebhookToken(parts.join(':')));
});

test('tokens cannot be decrypted with a different key', () => {
  setTestKey();
  const encrypted = encryptWebhookToken('test-webhook-token-value');
  setTestKey();

  assert.throws(() => decryptWebhookToken(encrypted));
});

test('missing encryption key fails closed', () => {
  delete process.env.WEBHOOK_TOKEN_ENCRYPTION_KEY;
  assert.throws(() => encryptWebhookToken('test-webhook-token-value'), /WEBHOOK_TOKEN_ENCRYPTION_KEY is required/);
});
