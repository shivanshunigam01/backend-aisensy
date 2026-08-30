const { getRazorpayClient } = require('../config/razorpay');
const { env } = require('../config/env');
const { ApiError } = require('../utils/apiError');
const PaymentModel = require('../models/PaymentModel');
const { verifyRazorpaySignature } = require('../utils/signature');
const planService = require('./planService');

async function createOrder({ planId, email }) {
  const plan = await planService.getBillablePlan(planId);
  const amount = plan?.amountInPaise;

  if (!plan || !amount) {
    throw new ApiError(400, 'Invalid or unpaid plan.');
  }

  const razorpay = getRazorpayClient();

  if (!razorpay) {
    throw new ApiError(503, 'Razorpay is not configured on the server.');
  }

  try {
    const order = await razorpay.orders.create({
      amount,
      currency: 'INR',
      notes: PaymentModel.buildOrderNotes(email)
    });

    return PaymentModel.formatCreateOrderResponse(order, env.razorpayKeyId);
  } catch (error) {
    throw new ApiError(500, error.message || 'Failed to create Razorpay order.');
  }
}

function verifyPayment({ razorpay_order_id, razorpay_payment_id, razorpay_signature }) {
  if (!env.razorpayKeySecret) {
    throw new ApiError(503, 'Server misconfiguration.');
  }

  const ok = verifyRazorpaySignature(
    razorpay_order_id,
    razorpay_payment_id,
    razorpay_signature,
    env.razorpayKeySecret
  );

  return { ok };
}

module.exports = {
  createOrder,
  verifyPayment
};
