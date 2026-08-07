// db/seed.js
// Populates the database with realistic starter content the first time it
// runs (checked via a marker row so it never duplicates on restart/redeploy):
// established study groups with real member counts, real downloadable
// resources per module (served from a committed /public/seed-docs folder so
// they survive Render restarts — unlike runtime-written files in /uploads,
// which are wiped whenever a free-tier instance restarts), an existing
// conversation in each group's chat, and module-specific resource comments.
const { v4: uuid } = require('uuid');
const bcrypt = require('bcryptjs');

const SEED_MARKER_ID = 'seed-v2';

module.exports = function seed(db) {
  const already = db.prepare('SELECT id FROM users WHERE id = ?').get(SEED_MARKER_ID);
  if (already) return; // already seeded, never re-run

  // A single system account that "authors" the starter content — real row
  // in the users table so foreign keys make sense, but it can't log in
  // (no real password is ever set for it beyond this random unusable hash).
  const passwordHash = bcrypt.hashSync(uuid(), 10);
  db.prepare(`
    INSERT INTO users (id, full_name, student_number, email, password_hash, auth_provider, language, privacy)
    VALUES (?, 'StudyHub SA Library', NULL, 'library@studyhub.sa', ?, 'password', 'en', 'public')
  `).run(SEED_MARKER_ID, passwordHash);

  const groups = [
    { name: 'Data Structures Squad', module: 'COMS2A', desc: 'Working through linked lists, trees, and sorting together.', members: 87 },
    { name: 'Accounting Study Circle', module: 'ACCT101', desc: 'Weekly problem sets and exam prep for financial accounting.', members: 120 },
    { name: 'Contract Law Revision', module: 'LAWS102', desc: 'Case law discussion and past-paper walkthroughs.', members: 56 },
    { name: 'Statistics Crew', module: 'STAT1B', desc: 'Probability, distributions, and test prep.', members: 70 },
    { name: 'Networks & Systems', module: 'NETW201', desc: 'OSI model, routing, and lab report help.', members: 99 },
  ];

  // file names match the real, committed files in backend/public/seed-docs/
  const resourcesByModule = {
    COMS2A: [
      { title: 'Course Outline & Assessment Plan', file: 'coms2a_course_outline.txt', desc: 'Semester schedule, assessment weighting, and key dates.' },
      { title: 'Week 4 Notes — Linked Lists', file: 'coms2a_week4_linked_lists.txt', desc: 'Singly vs doubly linked lists, with worked examples.' },
    ],
    ACCT101: [
      { title: 'Course Outline & Assessment Plan', file: 'acct101_course_outline.txt', desc: 'Semester schedule, assessment weighting, and key dates.' },
      { title: 'Financial Statements Summary', file: 'acct101_financial_statements.txt', desc: 'Quick-reference summary of the income statement and balance sheet.' },
    ],
    LAWS102: [
      { title: 'Course Outline & Assessment Plan', file: 'laws102_course_outline.txt', desc: 'Semester schedule, assessment weighting, and key dates.' },
      { title: 'Contract Law Case Digest', file: 'laws102_case_digest.txt', desc: 'Summarised key cases for offer, acceptance, and breach.' },
    ],
    STAT1B: [
      { title: 'Course Outline & Assessment Plan', file: 'stat1b_course_outline.txt', desc: 'Semester schedule, assessment weighting, and key dates.' },
      { title: 'Probability Distributions Cheat Sheet', file: 'stat1b_distributions.txt', desc: 'Binomial, Poisson, and Normal distribution formulas.' },
    ],
    NETW201: [
      { title: 'Course Outline & Assessment Plan', file: 'netw201_course_outline.txt', desc: 'Semester schedule, assessment weighting, and key dates.' },
      { title: 'OSI Model Reference Sheet', file: 'netw201_osi_model.txt', desc: 'The seven layers with protocols and examples at each.' },
    ],
  };

  const conversationsByModule = {
    COMS2A: [
      'Hey everyone, has anyone started the linked-list assignment yet?',
      'Just started — the trickiest part is the delete-by-value method.',
      'I used a dummy head node, made edge cases way easier to handle.',
      'That is a great idea, going to refactor mine now, thank you!',
      'Uploaded my week 4 notes to the Resource Library if anyone wants a summary.',
    ],
    ACCT101: [
      'Does anyone have a clean summary of the adjusting entries section?',
      'I posted one in the Resource Library — check the Financial Statements Summary.',
      'Thank you! That is exactly what I needed before the test.',
      'Is the mock test this Friday still happening?',
      'Yes, 09:00 in the usual venue.',
    ],
    LAWS102: [
      'Can someone explain the difference between void and voidable contracts again?',
      'Void means it never had legal effect, voidable means one party can choose to cancel it.',
      'That makes sense, thank you!',
      'I added a case digest to the library covering offer and acceptance.',
      'Perfect timing, revising that section tonight.',
    ],
    STAT1B: [
      'Is the upcoming test covering both binomial and normal distributions?',
      'Yes, plus a short section on hypothesis testing.',
      'Uploaded a cheat sheet with all three distributions summarised.',
      'You are a lifesaver, thank you!',
      'Good luck everyone for Friday.',
    ],
    NETW201: [
      'Struggling to remember which layer handles routing, can anyone help?',
      'That is layer 3, the Network layer — routers operate there.',
      'Thanks! Is there a summary of the whole OSI model anywhere?',
      'Just uploaded one to the Resource Library.',
      'Appreciate it, going through it now before the lab report is due.',
    ],
  };

  // Different commenter names and remarks per module, so Resource Details
  // doesn't show the same two names everywhere.
  const commentsByModule = {
    COMS2A: [
      ['Karabo M.', 'This cleared up the dummy head node trick for me, thank you!'],
      ['Naledi P.', 'Really clean explanation of singly vs doubly linked lists.'],
    ],
    ACCT101: [
      ['Ayanda K.', 'Saved me before the mock test, the ratio section is gold.'],
      ['Tumi R.', 'Wish I had this before attempting the adjusting entries.'],
    ],
    LAWS102: [
      ['Sipho D.', 'The void vs voidable explanation finally made it click.'],
      ['Aisha K.', 'Great case summaries, exactly what I needed for the class test.'],
    ],
    STAT1B: [
      ['Lerato N.', 'The distribution comparison table is so useful for revision.'],
      ['Johan V.', 'Clear breakdown of when to use Binomial vs Poisson.'],
    ],
    NETW201: [
      ['Thandeka M.', 'Finally understand which devices operate at which layer.'],
      ['Michael O.', 'The TCP vs UDP table is a great quick-reference.'],
    ],
  };

  const insertGroup = db.prepare(`
    INSERT INTO study_groups (id, name, module, description, created_by, seed_members)
    VALUES (?, ?, ?, ?, ?, ?)
  `);
  const insertResource = db.prepare(`
    INSERT INTO resources (id, title, description, module, file_url, file_type, uploader_id)
    VALUES (?, ?, ?, ?, ?, ?, ?)
  `);
  const insertMessage = db.prepare(`
    INSERT INTO messages (id, group_id, sender_id, content, sent_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);
  const insertComment = db.prepare(`
    INSERT INTO comments (id, resource_id, author_name, content, created_at)
    VALUES (?, ?, ?, ?, datetime('now', ?))
  `);

  groups.forEach(g => {
    const groupId = uuid();
    insertGroup.run(groupId, g.name, g.module, g.desc, SEED_MARKER_ID, g.members);

    // Downloadable resources — served from the permanent /seed-docs static
    // route (backend/public/seed-docs), not the ephemeral /uploads folder,
    // so these links keep working across every redeploy.
    (resourcesByModule[g.module] || []).forEach(r => {
      const resourceId = uuid();
      insertResource.run(resourceId, r.title, r.desc, g.module, `/seed-docs/${r.file}`, 'TXT', SEED_MARKER_ID);

      (commentsByModule[g.module] || []).forEach(([name, text], i) => {
        insertComment.run(uuid(), resourceId, name, text, `-${(i + 1) * 40} minutes`);
      });
    });

    // A short existing conversation so Group Chat never opens empty.
    const lines = conversationsByModule[g.module] || [];
    lines.forEach((line, i) => {
      insertMessage.run(uuid(), groupId, SEED_MARKER_ID, line, `-${(lines.length - i) * 20} minutes`);
    });
  });
};
