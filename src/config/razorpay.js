const Razorpay = require('razorpay');
const { env } = require('./env');

function getRazorpayClient() {
  if (!env.razorpayKeyId || !env.razorpayKeySecret) {
    return null;
  }

  return new Razorpay({
    key_id: env.razorpayKeyId,
    key_secret: env.razorpayKeySecret
  });
}

module.exports = { getRazorpayClient };
