const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  port: Number(process.env.RAZORPAY_API_PORT || process.env.PORT || 8787),
  razorpayKeyId: process.env.RAZORPAY_KEY_ID || '',
  razorpayKeySecret: process.env.RAZORPAY_KEY_SECRET || '',
  mongodbUri: process.env.MONGODB_URI || '',
  adminToken: process.env.ADMIN_PANEL_TOKEN || 'ZV-ADMIN-2026-DEMO',
  adminJwtSecret: process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PANEL_TOKEN || 'ZV-ADMIN-JWT-SECRET-CHANGE-ME',
  adminSeedEmail: process.env.ADMIN_SEED_EMAIL || 'admin@zentroverse.in',
  adminSeedPassword: process.env.ADMIN_SEED_PASSWORD || 'Zentro@2026',
  cloudinaryCloudName: process.env.CLOUDINARY_CLOUD_NAME || '',
  cloudinaryApiKey: process.env.CLOUDINARY_API_KEY || '',
  cloudinaryApiSecret: process.env.CLOUDINARY_API_SECRET || '',
  cloudinaryUploadFolder: process.env.CLOUDINARY_UPLOAD_FOLDER || 'zentroverse',
  corsOrigins: (process.env.CORS_ORIGIN || 'http://localhost:8080,http://localhost:5173,https://zentroverse.com,https://www.zentroverse.com,https://zentrosure.com,https://www.zentrosure.com')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
};

module.exports = { env };
