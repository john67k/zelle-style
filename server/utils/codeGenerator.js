const crypto = require('crypto');

function generateVerificationCode() {
  // Generate a 6-digit code
  return Math.floor(100000 + Math.random() * 900000).toString();
}

function generateTransactionId() {
  // Generate a unique transaction ID
  return 'TX-' + crypto.randomBytes(6).toString('hex').toUpperCase();
}

function generateSecureToken() {
  return crypto.randomBytes(32).toString('hex');
}

module.exports = {
  generateVerificationCode,
  generateTransactionId,
  generateSecureToken
};