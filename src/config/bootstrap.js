const { seedAdminIfNeeded } = require('../services/adminAuthService');
const { seedCmsIfNeeded } = require('../services/cmsService');
const { seedPlansIfNeeded } = require('../services/planService');
const crmService = require('../services/crmService');

async function bootstrapData() {
  await seedAdminIfNeeded();
  await seedCmsIfNeeded();
  await seedPlansIfNeeded();
  await crmService.getSettings();
}

module.exports = { bootstrapData };
