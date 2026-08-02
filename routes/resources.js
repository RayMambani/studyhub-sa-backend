// routes/resources.js
const express = require('express');
const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { sendPushToUser, sendPushToAll } = require('../notifications/push');

const router = express.Router();

const storage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => cb(null, `${uuid()}-${file.originalname}`),
});
const upload = multer({ storage, limits: { fileSize: 25 * 1024 * 1024 } });

// GET /api/resources?module=COMS2A&search=linked+list
router.get('/', requireAuth, (req, res) => {
  const { module, search } = req.query;
  let sql = 'SELECT * FROM resources WHERE 1=1';
  const params = [];
  if (module) { sql += ' AND module = ?'; params.push(module); }
  if (search) { sql += ' AND title LIKE ?'; params.push(`%${search}%`); }
  sql += ' ORDER BY upload_date DESC';
  const rows = db.prepare(sql).all(...params);
  res.json(rows);
});

// POST /api/resources  (multipart/form-data: file, title, description, module)
router.post('/', requireAuth, upload.single('file'), (req, res) => {
  const { title, description, module } = req.body;
  if (!title || !req.file) {
    return res.status(400).json({ error: 'title and file are required' });
  }

  const id = uuid();
  const fileUrl = `/uploads/${req.file.filename}`;
  const fileType = path.extname(req.file.originalname).replace('.', '').toUpperCase();

  db.prepare(
    `INSERT INTO resources (id, title, description, module, file_url, file_type, uploader_id)
     VALUES (?, ?, ?, ?, ?, ?, ?)`
  ).run(id, title, description || '', module || '', fileUrl, fileType, req.userId);

  // Real-time push: notify other students a new resource is available (PoE requirement).
  sendPushToAll({
    title: 'New resource uploaded',
    body: `${title} was just shared${module ? ' in ' + module : ''}`,
    excludeUserId: req.userId,
  }).catch(err => console.error('Push send failed:', err.message));

  res.status(201).json({ id, fileUrl });
});

module.exports = router;
