const express = require('express');
const bcrypt = require('bcryptjs');
const multer = require('multer');
const path = require('path');
const { v4: uuid } = require('uuid');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { computeUserStats } = require('../util/stats');
const { isStrongPassword, PASSWORD_REQUIREMENTS_MESSAGE } = require('../util/password');

const router = express.Router();

const avatarStorage = multer.diskStorage({
  destination: path.join(__dirname, '..', 'uploads'),
  filename: (req, file, cb) => cb(null, `avatar-${req.userId}-${uuid()}${path.extname(file.originalname) || '.jpg'}`),
});
const uploadAvatar = multer({ storage: avatarStorage, limits: { fileSize: 8 * 1024 * 1024 } });

router.post('/avatar', requireAuth, uploadAvatar.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });
  const fileUrl = `/uploads/${req.file.filename}`;
  await db.run('UPDATE users SET profile_image = ? WHERE id = ?', [fileUrl, req.userId]);
  res.status(201).json({ profileImage: fileUrl });
});

router.get('/me', requireAuth, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const stats = await computeUserStats(req.userId);
  res.json({
    id: user.id,
    fullName: user.full_name,
    studentNumber: user.student_number,
    email: user.email,
    profileImage: user.profile_image,
    language: user.language,
    privacy: user.privacy,
    uploadsCount: stats.uploadsCount,
    groupsCount: stats.groupsCount,
    streak: stats.streak,
    points: stats.points,
    badges: stats.badges,
  });
});

router.patch('/settings', requireAuth, async (req, res) => {
  const { language, fcmToken, privacy } = req.body;

  if (language && !['en', 'zu', 've'].includes(language)) {
    return res.status(400).json({ error: 'language must be one of: en, zu, ve' });
  }
  if (privacy && !['public', 'private'].includes(privacy)) {
    return res.status(400).json({ error: 'privacy must be one of: public, private' });
  }

  if (language) await db.run('UPDATE users SET language = ? WHERE id = ?', [language, req.userId]);
  if (fcmToken) await db.run('UPDATE users SET fcm_token = ? WHERE id = ?', [fcmToken, req.userId]);
  if (privacy) await db.run('UPDATE users SET privacy = ? WHERE id = ?', [privacy, req.userId]);

  const user = await db.get('SELECT language, privacy FROM users WHERE id = ?', [req.userId]);
  res.json({ language: user.language, privacy: user.privacy });
});

router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MESSAGE });
  }

  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.password_hash) {
    if (!currentPassword) return res.status(400).json({ error: 'currentPassword is required' });
    if (!(await bcrypt.compare(currentPassword, user.password_hash))) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  }

  await db.run('UPDATE users SET password_hash = ? WHERE id = ?', [await bcrypt.hash(newPassword, 12), req.userId]);
  res.json({ updated: true });
});

router.patch('/profile', requireAuth, async (req, res) => {
  const { fullName, studentNumber } = req.body;

  if (fullName !== undefined) {
    if (!fullName.trim()) return res.status(400).json({ error: 'fullName cannot be empty' });
    await db.run('UPDATE users SET full_name = ? WHERE id = ?', [fullName.trim(), req.userId]);
  }
  if (studentNumber !== undefined) {
    const sn = studentNumber.trim() || null;
    if (sn && await db.get('SELECT id FROM users WHERE student_number = ? AND id != ?', [sn, req.userId])) {
      return res.status(409).json({ error: 'This student number is already registered' });
    }
    await db.run('UPDATE users SET student_number = ? WHERE id = ?', [sn, req.userId]);
  }

  const user = await db.get('SELECT full_name, student_number FROM users WHERE id = ?', [req.userId]);
  res.json({ fullName: user.full_name, studentNumber: user.student_number });
});

router.post('/delete-account', requireAuth, async (req, res) => {
  const user = await db.get('SELECT * FROM users WHERE id = ?', [req.userId]);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.password_hash) {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Enter your password to confirm deletion' });
    if (!(await bcrypt.compare(password, user.password_hash))) {
      return res.status(401).json({ error: 'Incorrect password' });
    }
  }

  const id = req.userId;
  await db.batch([
    ['DELETE FROM comments WHERE resource_id IN (SELECT id FROM resources WHERE uploader_id = ?)', [id]],
    ['DELETE FROM resources WHERE uploader_id = ?', [id]],
    ['DELETE FROM notes WHERE user_id = ?', [id]],
    ['DELETE FROM events WHERE user_id = ?', [id]],
    ['DELETE FROM notifications WHERE user_id = ?', [id]],
    ['DELETE FROM group_members WHERE user_id = ?', [id]],
    ['DELETE FROM messages WHERE sender_id = ?', [id]],
    ['DELETE FROM users WHERE id = ?', [id]],
  ]);
  res.json({ deleted: true });
});

module.exports = router;