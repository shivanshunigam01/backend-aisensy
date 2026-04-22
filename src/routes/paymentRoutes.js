const express = require('express');
const paymentController = require('../controllers/paymentController');
const {
  validateCreateOrderRequest,
  validateVerifyPaymentRequest
} = require('../middleware/requestValidators');

const router = express.Router();

router.post('/razorpay/create-order', validateCreateOrderRequest, paymentController.createOrder);
router.post('/razorpay/verify-payment', validateVerifyPaymentRequest, paymentController.verifyPayment);

module.exports = router;
