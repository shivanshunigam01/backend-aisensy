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

### Leads (general)

```http
POST /api/leads
Content-Type: application/json

{
  "name": "Demo User",
  "phone": "9876543210",
  "email": "demo@example.com",
  "source": "website"
}
```

```http
GET /api/leads
x-admin-token: ZV-ADMIN-2026-DEMO
```

```http
POST /api/leads/update
x-admin-token: ZV-ADMIN-2026-DEMO
Content-Type: application/json

{ "id": "...", "status": "contacted", "admin_notes": "Called back" }
```

```http
POST /api/leads/delete
x-admin-token: ZV-ADMIN-2026-DEMO
Content-Type: application/json

{ "id": "..." }
```

### Bajaj ASD application

```http
POST /api/bajaj-asd/apply
Content-Type: application/json

{
  "target_location": "patna-sd",
  "district": "Patna",
  "state": "Bihar",
  "applicant_name": "राम कुमार",
  "mobile": "9876543210",
  "current_town": "Patna",
  "is_existing_business": "Yes",
  "business_name": "ABC Auto",
  "business_type": "Two-Wheeler Dealer",
  "years_in_business": "3–5 years",
  "existing_oem": "No",
  "investment_capacity": "₹10–15 Lakh",
  "space_status": "Own space available",
  "start_timeline": "Within 1 Month",
  "contact_consent": true,
  "disclaimer_ack": true
}
```

```http
GET /api/bajaj-asd/applications
x-admin-token: ZV-ADMIN-2026-DEMO
```

```http
POST /api/bajaj-asd/update
x-admin-token: ZV-ADMIN-2026-DEMO
Content-Type: application/json

{ "id": "...", "status": "qualified", "admin_notes": "Interview scheduled" }
```

## Notes

- `enterprise` is intentionally rejected for order creation.
- Amounts are controlled server-side only.
- This backend follows the provided spec closely.
- Add auth, rate limiting, and persistent storage before public production use.
