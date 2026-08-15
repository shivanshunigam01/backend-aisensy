const { seedAdminIfNeeded } = require('../services/adminAuthService');
const { seedCmsIfNeeded } = require('../services/cmsService');
const crmService = require('../services/crmService');

async function bootstrapData() {
  await seedAdminIfNeeded();
  await seedCmsIfNeeded();
  await crmService.getSettings();
}

module.exports = { bootstrapData };
