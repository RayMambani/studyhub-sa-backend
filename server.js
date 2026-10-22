require('dotenv').config();
require('express-async-errors');
const express = require('express');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const { cloudUrlFor } = require('./util/storage');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const resourceRoutes = require('./routes/resources');
const groupRoutes = require('./routes/groups');
const noteRoutes = require('./routes/notes');
const eventRoutes = require('./routes/events');
const notificationRoutes = require('./routes/notifications');
const commentRoutes = require('./routes/comments');
const aiRoutes = require('./routes/ai');
const legalRoutes = require('./routes/legal');

const app = express();
app.use(cors());
app.use(express.json());

fs.mkdirSync(path.join(__dirname, 'uploads'), { recursive: true });
// Files saved on local disk (older uploads, local dev) are served directly...
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// ...everything else lives on Cloudinary, so the same /uploads/<name> address redirects there.
app.get('/uploads/:name', (req, res) => {
  const url = cloudUrlFor(req.params.name);
  if (!url) return res.status(404).json({ error: 'Not found' });
  res.redirect(302, url);
});
app.use('/seed-docs', express.static(path.join(__dirname, 'public', 'seed-docs')));

app.get('/', (req, res) => res.json({ status: 'StudyHub SA API is running' }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/resources', resourceRoutes);
app.use('/api/groups', groupRoutes);
app.use('/api/notes', noteRoutes);
app.use('/api/events', eventRoutes);
app.use('/api/notifications', notificationRoutes);
app.use('/api/resources', commentRoutes);
app.use('/api/ai', aiRoutes);
app.use('/', legalRoutes);

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

app.use((err, req, res, next) => {
  if (err && err.code === 'LIMIT_FILE_SIZE') {
    return res.status(413).json({ error: 'That file is too large. The limit is 10 MB.' });
  }
  console.error('[error]', err);
  if (res.headersSent) return next(err);
  res.status(500).json({ error: 'Something went wrong on the server. Please try again.' });
});

const PORT = process.env.PORT || 4000;
if (require.main === module) {
  app.listen(PORT, () => console.log(`StudyHub SA API listening on port ${PORT}`));
}

module.exports = app;