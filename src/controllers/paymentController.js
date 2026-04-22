const paymentService = require('../services/paymentService');
const { asyncHandler } = require('../utils/asyncHandler');

const createOrder = asyncHandler(async (req, res) => {
  const payload = req.validatedBody || req.body;
  const response = await paymentService.createOrder(payload);
  return res.status(200).json(response);
});

const verifyPayment = asyncHandler(async (req, res) => {
  const payload = req.validatedBody || req.body;
  const response = paymentService.verifyPayment(payload);
  return res.status(200).json(response);
});

module.exports = {
  createOrder,
  verifyPayment
};
