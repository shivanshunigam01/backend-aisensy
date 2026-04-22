class PaymentModel {
  static buildOrderNotes(email) {
    return {
      email: typeof email === 'string' ? email.slice(0, 120) : ''
    };
  }

  static formatCreateOrderResponse(order, keyId) {
    return {
      orderId: order.id,
      amount: order.amount,
      currency: order.currency,
      keyId
    };
  }
}

module.exports = PaymentModel;
