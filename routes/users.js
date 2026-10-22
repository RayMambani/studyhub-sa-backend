// routes/users.js
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

// POST /api/users/avatar   (multipart/form-data: file)
// Backs the "upload a profile picture" requirement â€” stores the image in
// /uploads and saves its URL against the user's profile_image column.
router.post('/avatar', requireAuth, uploadAvatar.single('file'), (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'file is required' });

  const fileUrl = `/uploads/${req.file.filename}`;
  db.prepare('UPDATE users SET profile_image = ? WHERE id = ?').run(fileUrl, req.userId);
  res.status(201).json({ profileImage: fileUrl });
});

// GET /api/users/me
router.get('/me', requireAuth, (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });
  const stats = computeUserStats(req.userId);
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

// PATCH /api/users/settings
// Body: { language?: 'en'|'zu'|'ve', fcmToken?: string, privacy?: 'public'|'private' }
// Backs the Settings screen (language, privacy) and push notification registration.
router.patch('/settings', requireAuth, (req, res) => {
  const { language, fcmToken, privacy } = req.body;

  if (language && !['en', 'zu', 've'].includes(language)) {
    return res.status(400).json({ error: 'language must be one of: en, zu, ve' });
  }
  if (privacy && !['public', 'private'].includes(privacy)) {
    return res.status(400).json({ error: 'privacy must be one of: public, private' });
  }

  if (language) {
    db.prepare('UPDATE users SET language = ? WHERE id = ?').run(language, req.userId);
  }
  if (fcmToken) {
    db.prepare('UPDATE users SET fcm_token = ? WHERE id = ?').run(fcmToken, req.userId);
  }
  if (privacy) {
    db.prepare('UPDATE users SET privacy = ? WHERE id = ?').run(privacy, req.userId);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ language: user.language, privacy: user.privacy });
});

// POST /api/users/change-password
// Body: { currentPassword, newPassword }
// Backs Settings > Account Security. Verifies the current password with
// bcrypt before allowing the change; SSO-only accounts (no password_hash
// yet) can set one for the first time without a currentPassword check.
router.post('/change-password', requireAuth, async (req, res) => {
  const { currentPassword, newPassword } = req.body;
  if (!newPassword || newPassword.length < 8) {
    return res.status(400).json({ error: 'newPassword must be at least 8 characters' });
  }
  if (!isStrongPassword(newPassword)) {
    return res.status(400).json({ error: PASSWORD_REQUIREMENTS_MESSAGE });
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.password_hash) {
    if (!currentPassword) {
      return res.status(400).json({ error: 'currentPassword is required' });
    }
    const valid = await bcrypt.compare(currentPassword, user.password_hash);
    if (!valid) {
      return res.status(401).json({ error: 'Current password is incorrect' });
    }
  }

  const newHash = await bcrypt.hash(newPassword, 12);
  db.prepare('UPDATE users SET password_hash = ? WHERE id = ?').run(newHash, req.userId);
  res.json({ updated: true });
});

// PATCH /api/users/profile
// Body: { fullName?, studentNumber? }
// Backs the Profile screen's Edit button â€” updates the student's own
// display details (kept separate from /settings, which is preferences).
router.patch('/profile', requireAuth, (req, res) => {
  const { fullName, studentNumber } = req.body;

  if (fullName !== undefined) {
    if (!fullName.trim()) return res.status(400).json({ error: 'fullName cannot be empty' });
    db.prepare('UPDATE users SET full_name = ? WHERE id = ?').run(fullName.trim(), req.userId);
  }
  if (studentNumber !== undefined) {
    db.prepare('UPDATE users SET student_number = ? WHERE id = ?').run(studentNumber.trim() || null, req.userId);
  }

  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  res.json({ fullName: user.full_name, studentNumber: user.student_number });
});

// POST /api/users/delete-account   Body: { password? }
// Permanently deletes the logged-in student and everything they created.
// Password accounts must confirm with their password; Google-only accounts have no password.
router.post('/delete-account', requireAuth, async (req, res) => {
  const user = db.prepare('SELECT * FROM users WHERE id = ?').get(req.userId);
  if (!user) return res.status(404).json({ error: 'User not found' });

  if (user.password_hash) {
    const { password } = req.body;
    if (!password) return res.status(400).json({ error: 'Enter your password to confirm deletion' });
    const valid = await bcrypt.compare(password, user.password_hash);
    if (!valid) return res.status(401).json({ error: 'Incorrect password' });
  }

  const wipe = db.transaction((id) => {
    db.prepare('DELETE FROM comments WHERE resource_id IN (SELECT id FROM resources WHERE uploader_id = ?)').run(id);
    db.prepare('DELETE FROM resources WHERE uploader_id = ?').run(id);
    db.prepare('DELETE FROM notes WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM events WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM notifications WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM group_members WHERE user_id = ?').run(id);
    db.prepare('DELETE FROM messages WHERE sender_id = ?').run(id);
    db.prepare('DELETE FROM users WHERE id = ?').run(id);
  });
  wipe(req.userId);
  res.json({ deleted: true });
});

module.exports = router;
