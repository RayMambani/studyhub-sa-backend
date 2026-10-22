const fs = require('fs');
const path = require('path');
const { v4: uuid } = require('uuid');
const cloudinary = require('cloudinary').v2;

const IMAGE_EXTS = ['jpg', 'jpeg', 'png', 'gif', 'webp'];
const UPLOAD_DIR = path.join(__dirname, '..', 'uploads');
const FOLDER = 'studyhub';

const enabled = () => !!(process.env.CLOUDINARY_CLOUD_NAME && process.env.CLOUDINARY_API_KEY && process.env.CLOUDINARY_API_SECRET);

if (enabled()) {
  cloudinary.config({
    cloud_name: process.env.CLOUDINARY_CLOUD_NAME,
    api_key: process.env.CLOUDINARY_API_KEY,
    api_secret: process.env.CLOUDINARY_API_SECRET,
    secure: true,
  });
}

function safeName(original, prefix) {
  const ext = (path.extname(original || '') || '').toLowerCase();
  const base = path.basename(original || 'file', path.extname(original || '')).replace(/[^A-Za-z0-9_-]/g, '_').slice(0, 60) || 'file';
  return `${prefix}${uuid()}-${base}${ext}`;
}

const typeFor = (name) => (IMAGE_EXTS.includes(path.extname(name).slice(1).toLowerCase()) ? 'image' : 'raw');

// Saves a multer memory file and returns the app-facing path, e.g. /uploads/<name>.
// With Cloudinary configured the file lives there permanently; otherwise it is
// written to the local uploads folder (tests and local development).
async function saveUpload(file, prefix = '') {
  const name = safeName(file.originalname, prefix);

  if (!enabled()) {
    fs.mkdirSync(UPLOAD_DIR, { recursive: true });
    fs.writeFileSync(path.join(UPLOAD_DIR, name), file.buffer);
    return `/uploads/${name}`;
  }

  const ext = path.extname(name);
  const options = typeFor(name) === 'image'
    ? { resource_type: 'image', folder: FOLDER, public_id: name.slice(0, name.length - ext.length) }
    : { resource_type: 'raw', folder: FOLDER, public_id: name };

  await new Promise((resolve, reject) => {
    const stream = cloudinary.uploader.upload_stream(options, (err, result) => (err ? reject(err) : resolve(result)));
    stream.end(file.buffer);
  });
  return `/uploads/${name}`;
}

// Where a stored file actually lives on Cloudinary, or null if it is not configured.
function cloudUrlFor(name) {
  const cloud = process.env.CLOUDINARY_CLOUD_NAME;
  if (!cloud) return null;
  const safe = path.basename(name);
  return `https://res.cloudinary.com/${cloud}/${typeFor(safe)}/upload/${FOLDER}/${safe}`;
}

module.exports = { saveUpload, cloudUrlFor };