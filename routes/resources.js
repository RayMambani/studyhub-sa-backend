const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { sendPushToAll } = require('../notifications/push');
const { notifyAllExcept } = require('../notifications/feed');
const { saveUpload } = require('../util/storage');

const router = express.Router();

// Held in memory, then handed to Cloudinary (free plan limit is 10 MB per file).
const upload = multer({ storage: multer.memoryStorage(), limits: { fileSize: 10 * 1024 * 1024 } });

router.get('/', requireAuth, async (req, res) => {
  const { module, search } = req.query;
  let sql = 'SELECT * FROM resources WHERE 1=1';
  const params = [];
  if (module) { sql += ' AND module = ?'; params.push(module); }
  if (search) { sql += ' AND title LIKE ?'; params.push(`%${search}%`); }
  sql += ' ORDER BY upload_date DESC';
  res.json(await db.all(sql, params));
});

router.post('/', requireAuth, upload.single('file'), async (req, res) => {
  const { title, description, module } = req.body;
  if (!title || !req.file) {
    return res.status(400).json({ error: 'title and file are required' });
  }

  const id = uuid();
  const fileUrl = await saveUpload(req.file);
  const fileType = path.extname(req.file.originalname).replace('.', '').toUpperCase();

  await db.run(
    'INSERT INTO resources (id, title, description, module, file_url, file_type, uploader_id) VALUES (?, ?, ?, ?, ?, ?, ?)',
    [id, title, description || '', module || '', fileUrl, fileType, req.userId]
  );

  const note = { title: 'New resource uploaded', body: `${title} was just shared${module ? ' in ' + module : ''}` };
  sendPushToAll({ ...note, excludeUserId: req.userId }).catch(err => console.error('Push send failed:', err.message));
  await notifyAllExcept(req.userId, { ...note, type: 'resource' });

  res.status(201).json({ id, fileUrl });
});

module.exports = router;