const { isCloudinaryConfigured, uploadToCloudinary } = require('../services/cloudinaryService');

async function getStatus(req, res) {
  return res.json({ configured: isCloudinaryConfigured() });
}

async function postUpload(req, res, next) {
  try {
    const { file, folder, resourceType } = req.body ?? {};
    if (!file) return res.status(400).json({ error: 'file is required.' });
    const result = await uploadToCloudinary({ file, folder, resourceType: resourceType || 'auto' });
    return res.json(result);
  } catch (err) {
    if (err.status === 503) return res.status(503).json({ error: err.message });
    return next(err);
  }
}

module.exports = { getStatus, postUpload };
