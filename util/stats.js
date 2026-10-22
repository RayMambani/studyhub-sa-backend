const db = require('../db/db');

const todayStr = () => new Date().toISOString().slice(0, 10);
const daysBetween = (a, b) => Math.round((new Date(b) - new Date(a)) / 86400000);

async function updateLoginStreak(userId) {
  const user = await db.get('SELECT last_login_date, login_streak FROM users WHERE id = ?', [userId]);
  if (!user) return;

  const today = todayStr();
  let streak = user.login_streak || 0;
  if (!user.last_login_date) streak = 1;
  else if (user.last_login_date !== today) streak = daysBetween(user.last_login_date, today) === 1 ? streak + 1 : 1;

  await db.run('UPDATE users SET last_login_date = ?, login_streak = ? WHERE id = ?', [today, streak, userId]);
}

async function computeUserStats(userId) {
  const uploadsCount = (await db.get('SELECT COUNT(*) AS c FROM resources WHERE uploader_id = ?', [userId])).c;
  const groupsCount = (await db.get('SELECT COUNT(*) AS c FROM group_members WHERE user_id = ?', [userId])).c;
  const messagesCount = (await db.get('SELECT COUNT(*) AS c FROM messages WHERE sender_id = ?', [userId])).c;
  const user = await db.get('SELECT login_streak FROM users WHERE id = ?', [userId]);
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