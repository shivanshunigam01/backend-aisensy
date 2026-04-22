const assert = require('assert');
const {
  generateRazorpaySignature,
  verifyRazorpaySignature
} = require('../src/utils/signature');

const orderId = 'order_test_123';
const paymentId = 'pay_test_123';
const secret = 'test_secret';
const signature = generateRazorpaySignature(orderId, paymentId, secret);

assert.ok(signature, 'Signature should be generated');
assert.strictEqual(
  verifyRazorpaySignature(orderId, paymentId, signature, secret),
  true,
  'Signature should verify successfully'
);
assert.strictEqual(
  verifyRazorpaySignature(orderId, paymentId, 'wrong_signature', secret),
  false,
  'Invalid signature should fail verification'
);

console.log('All signature tests passed.');
