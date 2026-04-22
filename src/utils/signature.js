const crypto = require('crypto');

function generateRazorpaySignature(orderId, paymentId, secret) {
  return crypto
    .createHmac('sha256', secret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

function verifyRazorpaySignature(orderId, paymentId, providedSignature, secret) {
  const expectedSignature = generateRazorpaySignature(orderId, paymentId, secret);
  return expectedSignature === providedSignature;
}

module.exports = {
  generateRazorpaySignature,
  verifyRazorpaySignature
};
