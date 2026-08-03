// util/stats.js
const db = require('../db/db');

function todayStr() {
  return new Date().toISOString().slice(0, 10); // YYYY-MM-DD
}

function daysBetween(a, b) {
  const msPerDay = 24 * 60 * 60 * 1000;
  return Math.round((new Date(b) - new Date(a)) / msPerDay);
}

// Call this once per successful login (password, Google, or register-as-first-login).
// Increments the streak if the student logged in yesterday, keeps it the same
// if they already logged in today, and resets to 1 after a missed day.
function updateLoginStreak(userId) {
  const user = db.prepare('SELECT last_login_date, login_streak FROM users WHERE id = ?').get(userId);
  if (!user) return;

  const today = todayStr();
  let streak = user.login_streak || 0;

  if (!user.last_login_date) {
    streak = 1;
  } else if (user.last_login_date === today) {
    // already logged in today — streak unchanged
  } else {
    const gap = daysBetween(user.last_login_date, today);
    streak = gap === 1 ? streak + 1 : 1;
  }

  db.prepare('UPDATE users SET last_login_date = ?, login_streak = ? WHERE id = ?')
    .run(today, streak, userId);
}

// Badges are earned from real activity, not hardcoded — recomputed on every
// profile fetch so they always reflect the student's current standing.
function computeUserStats(userId) {
  const uploadsCount = db.prepare(
    'SELECT COUNT(*) AS c FROM resources WHERE uploader_id = ?'
  ).get(userId).c;

  const groupsCount = db.prepare(
    'SELECT COUNT(*) AS c FROM group_members WHERE user_id = ?'
  ).get(userId).c;

  const messagesCount = db.prepare(
    'SELECT COUNT(*) AS c FROM messages WHERE sender_id = ?'
  ).get(userId).c;

  const user = db.prepare('SELECT login_streak FROM users WHERE id = ?').get(userId);
  const streak = (user && user.login_streak) || 0;

  const points = uploadsCount * 15 + groupsCount * 10 + messagesCount * 2 + streak * 5;

  const badges = [];
  if (uploadsCount >= 1) badges.push('Academic Contributor');
  if (uploadsCount >= 5) badges.push('Resource Specialist');
  if (groupsCount >= 1 && messagesCount >= 3) badges.push('Best Collaborator');
  if (streak >= 3) badges.push('Study Champion');

  return { uploadsCount, groupsCount, messagesCount, streak, points, badges };
}

module.exports = { updateLoginStreak, computeUserStats };
