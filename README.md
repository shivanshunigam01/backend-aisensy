# Trader Backend MVC

MVC-style Node.js + Express backend generated from the provided API documentation.

## Included

- Express app and `server.js`
- MVC-like folders: `controllers`, `services`, `routes`, `models`
- Middleware for validation, not found, and error handling
- Razorpay config and signature verification utility
- `AdWord.js` utility file
- `.env.example`
- Simple test for signature verification

## Folder Structure

```bash
trader-backend-mvc/
├── server.js
├── package.json
├── .env.example
├── src/
│   ├── app.js
│   ├── config/
│   ├── constants/
│   ├── controllers/
│   ├── middleware/
│   ├── models/
│   ├── routes/
│   ├── services/
│   └── utils/
└── tests/
```

## Setup

```bash
npm install
cp .env.example .env
npm run dev
```

## API

### Health

```http
GET /health
```

### Create Razorpay Order

```http
POST /api/razorpay/create-order
Content-Type: application/json

{
  "planId": "starter",
  "email": "demo@example.com"
}
```

### Verify Payment

```http
POST /api/razorpay/verify-payment
Content-Type: application/json

{
  "razorpay_order_id": "order_xxx",
  "razorpay_payment_id": "pay_xxx",
  "razorpay_signature": "signature_xxx"
}
```

## Notes

- `enterprise` is intentionally rejected for order creation.
- Amounts are controlled server-side only.
- This backend follows the provided spec closely.
- Add auth, rate limiting, and persistent storage before public production use.
