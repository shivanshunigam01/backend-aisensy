const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.RAZORPAY_API_PORT || process.env.PORT || 8787),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  /** MongoDB connection string (Atlas). See .env.example */
  mongodbUri: process.env.MONGODB_URI || '',
  /** Admin panel token — must match frontend `ADMIN_TOKEN` / `x-admin-token` header */
  adminToken: process.env.ADMIN_PANEL_TOKEN || 'ZV-ADMIN-2026-DEMO'
};

module.exports = { env };
