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
    .filter(Boolean),

  // ZentroFlow 2.0
  zfJwtSecret: process.env.ZF_JWT_SECRET || process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PANEL_TOKEN || 'ZF-JWT-SECRET-CHANGE-ME',
  zfSeedEmail: process.env.ZF_SEED_EMAIL || 'flow@zentroverse.in',
  zfSeedPassword: process.env.ZF_SEED_PASSWORD || 'ZentroFlow@2026',

  // HR module (PeopleFlow-compatible collections under /api/hr)
  hrJwtSecret: process.env.HR_JWT_SECRET || process.env.ADMIN_JWT_SECRET || process.env.ADMIN_PANEL_TOKEN || 'HR-JWT-SECRET-CHANGE-ME',
  hrAllowPublicRegister: String(process.env.HR_ALLOW_PUBLIC_REGISTER || 'true').toLowerCase() !== 'false',

  // Meta Lead Ads / CAPI (share keys when ready)
  metaAppId: process.env.META_APP_ID || '',
  metaAppSecret: process.env.META_APP_SECRET || '',
  metaAccessToken: process.env.META_ACCESS_TOKEN || '',
  metaSystemUserToken: process.env.META_SYSTEM_USER_TOKEN || '',
  metaWebhookVerifyToken: process.env.META_WEBHOOK_VERIFY_TOKEN || '',
  metaGraphVersion: process.env.META_GRAPH_VERSION || 'v21.0',

  // Reserved communication providers
  whatsappApiKey: process.env.WHATSAPP_API_KEY || '',
  whatsappApiUrl: process.env.WHATSAPP_API_URL || '',
  emailProvider: process.env.EMAIL_PROVIDER || '',
  voiceProviderApiKey: process.env.VOICE_PROVIDER_API_KEY || ''
};

module.exports = { env };
