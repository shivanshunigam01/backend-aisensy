function validateCreateOrderRequest(req, _res, next) {
  const { planId, email } = req.body || {};

  req.validatedBody = {
    planId: typeof planId === 'string' ? planId.trim() : '',
    email: typeof email === 'string' ? email.trim() : ''
  };

  next();
}

function validateVerifyPaymentRequest(req, res, next) {
  const { razorpay_order_id, razorpay_payment_id, razorpay_signature } = req.body || {};

  const missing = !razorpay_order_id || !razorpay_payment_id || !razorpay_signature;

  if (missing) {
    return res.status(400).json({ ok: false, error: 'Missing payment fields.' });
  }

  req.validatedBody = {
    razorpay_order_id: String(razorpay_order_id),
    razorpay_payment_id: String(razorpay_payment_id),
    razorpay_signature: String(razorpay_signature)
  };

  next();
}

module.exports = {
  validateCreateOrderRequest,
  validateVerifyPaymentRequest
};
