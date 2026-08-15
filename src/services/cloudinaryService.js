const crypto = require('crypto');
const { env } = require('../config/env');

function isCloudinaryConfigured() {
  return Boolean(env.cloudinaryCloudName && env.cloudinaryApiKey && env.cloudinaryApiSecret);
}

async function uploadToCloudinary({ file, folder, resourceType = 'auto' }) {
  const cloud = env.cloudinaryCloudName;
  const apiKey = env.cloudinaryApiKey;
  const secret = env.cloudinaryApiSecret;
  if (!cloud || !apiKey || !secret) {
    const err = new Error('Cloudinary is not configured');
    err.status = 503;
    throw err;
  }

  const timestamp = Math.round(Date.now() / 1000);
  const uploadFolder = folder || env.cloudinaryUploadFolder;
  const params = { folder: uploadFolder, timestamp };
  const toSign = Object.keys(params)
    .sort()
    .map((k) => `${k}=${params[k]}`)
    .join('&');
  const signature = crypto.createHash('sha1').update(`${toSign}${secret}`).digest('hex');

  const form = new FormData();
  form.append('file', file);
  form.append('api_key', apiKey);
  form.append('timestamp', String(timestamp));
  form.append('signature', signature);
  form.append('folder', uploadFolder);

  const endpoint =
    resourceType === 'auto'
      ? `https://api.cloudinary.com/v1_1/${cloud}/auto/upload`
      : `https://api.cloudinary.com/v1_1/${cloud}/${resourceType}/upload`;

  const res = await fetch(endpoint, { method: 'POST', body: form });
  const data = await res.json();
  if (!res.ok) {
    const err = new Error(data?.error?.message ?? 'Upload failed');
    err.status = 502;
    throw err;
  }

  return {
    ok: true,
    url: data.secure_url,
    publicId: data.public_id,
    resourceType: data.resource_type,
    format: data.format,
    width: data.width,
    height: data.height
  };
}

module.exports = { isCloudinaryConfigured, uploadToCloudinary };
