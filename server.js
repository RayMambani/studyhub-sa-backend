// server.js
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const path = require('path');

const authRoutes = require('./routes/auth');
const userRoutes = require('./routes/users');
const resourceRoutes = require('./routes/resources');
const groupRoutes = require('./routes/groups');
const noteRoutes = require('./routes/notes');
const eventRoutes = require('./routes/events');
const notificationRoutes = require('./routes/notifications');
const commentRoutes = require('./routes/comments');
const aiRoutes = require('./routes/ai');

const app = express();
app.use(cors());
app.use(express.json());
app.use('/uploads', express.static(path.join(__dirname, 'uploads')));
// Permanent, git-committed sample documents — unlike /uploads, this folder
// is part of the repo, so it survives every restart/redeploy on Render's
// free tier (which does not keep a persistent disk between restarts).
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

app.use((req, res) => res.status(404).json({ error: 'Not found' }));

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => console.log(`StudyHub SA API listening on port ${PORT}`));
