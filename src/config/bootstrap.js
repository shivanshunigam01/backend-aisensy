const { seedAdminIfNeeded } = require('../services/adminAuthService');
const { seedCmsIfNeeded } = require('../services/cmsService');
const crmService = require('../services/crmService');
const { seedSuperAdmin } = require('../zentroflow/services/authService');

async function bootstrapData() {
  await seedAdminIfNeeded();
  await seedCmsIfNeeded();
  await crmService.getSettings();
  try {
    await seedSuperAdmin();
  } catch (err) {
    console.warn('[zentroflow] seed skipped:', err.message);
  }
}

module.exports = { bootstrapData };
