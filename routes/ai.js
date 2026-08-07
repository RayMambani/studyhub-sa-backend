// routes/ai.js
//
// Backs the "AI Study Assist" feature (summaries, Q&A, recommendations).
//
// IMPORTANT — read this before assuming it's a real LLM: this is a
// heuristic, rule-based implementation with NO external API key required,
// so it works out of the box. It genuinely processes real input (extractive
// summarisation, keyword-matched answers, activity-based recommendations)
// rather than returning random text, but it is not a large language model.
//
// To upgrade this to a real LLM (e.g. OpenAI, Anthropic, Gemini):
//   1. Add an API key to .env (e.g. OPENAI_API_KEY=...)
//   2. Replace the body of each function below with a fetch() call to that
//      provider's chat/completions endpoint, passing req.body.text/question.
// Nothing on the Android side needs to change — it just calls these same
// three endpoints and displays whatever text comes back.

const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { computeUserStats } = require('../util/stats');

const router = express.Router();

// A small local knowledge base drawn from the seeded course content, used
// for keyword-matched answers when no better match is found.
const KNOWLEDGE_BASE = [
  { keywords: ['linked list', 'node', 'pointer'], answer: 'A linked list stores elements as nodes, where each node holds a value and a pointer to the next node. A dummy head node is a common trick that removes the need for special-case handling of an empty list or deleting the first element.' },
  { keywords: ['binomial', 'poisson', 'normal distribution', 'distribution'], answer: 'Use Binomial for a fixed number of trials with two outcomes, Poisson for counting events over time at a constant rate, and Normal for continuous, symmetric, bell-shaped data. Convert to a z-score (z = (x - mean) / std dev) to use the standard normal table.' },
  { keywords: ['void contract', 'voidable', 'contract'], answer: 'A void contract never had legal effect at all. A voidable contract is valid but one party may choose to cancel it (e.g. due to misrepresentation or duress) — until cancelled, it remains binding.' },
  { keywords: ['osi model', 'osi layer', 'layers'], answer: 'The OSI model has 7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application (mnemonic: "All People Seem To Need Data Processing"). Routers work at the Network layer, switches at the Data Link layer.' },
  { keywords: ['accounting equation', 'balance sheet', 'income statement'], answer: 'The accounting equation is Assets = Liabilities + Owner\'s Equity. The Income Statement shows performance over a period; the Balance Sheet shows financial position at a single point in time.' },
  { keywords: ['study tip', 'how to study', 'exam prep', 'revise'], answer: 'Active recall (testing yourself without notes) and spaced repetition (revisiting material over several days rather than one long session) are consistently the most effective study techniques — more effective than re-reading notes.' },
];

function pickAnswer(question) {
  const q = question.toLowerCase();
  const match = KNOWLEDGE_BASE.find(entry => entry.keywords.some(k => q.includes(k)));
  if (match) return match.answer;
  return "I don't have a specific answer for that yet — try checking the Resource Library for your module's notes, or rephrase your question using a term from your course material (e.g. \"linked list\", \"OSI model\", \"binomial distribution\").";
}

// Extractive summariser: splits into sentences, scores each by length and
// position, and returns the highest-scoring ones in their original order —
// a real (if simple) summarisation algorithm, not a canned response.
function summarise(text, maxSentences = 3) {
  const sentences = text
    .replace(/\s+/g, ' ')
    .split(/(?<=[.!?])\s+/)
    .map(s => s.trim())
    .filter(s => s.length > 15);

  if (sentences.length <= maxSentences) return sentences.join(' ');

  const scored = sentences.map((s, i) => ({
    sentence: s,
    index: i,
    score: s.length + (i === 0 ? 40 : 0) + (i === sentences.length - 1 ? 15 : 0),
  }));

  return scored
    .sort((a, b) => b.score - a.score)
    .slice(0, maxSentences)
    .sort((a, b) => a.index - b.index)
    .map(s => s.sentence)
    .join(' ');
}

// POST /api/ai/summarize   Body: { text }
router.post('/summarize', requireAuth, (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 40) {
    return res.status(400).json({ error: 'Paste at least a paragraph of text to summarise.' });
  }
  res.json({ summary: summarise(text) });
});

// POST /api/ai/ask   Body: { question }
router.post('/ask', requireAuth, (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }
  res.json({ answer: pickAnswer(question) });
});

// GET /api/ai/recommendations — based on the student's real activity
router.get('/recommendations', requireAuth, (req, res) => {
  const stats = computeUserStats(req.userId);
  const groups = db.prepare(`
    SELECT g.module FROM group_members gm
    JOIN study_groups g ON g.id = gm.group_id
    WHERE gm.user_id = ?
  `).all(req.userId).map(r => r.module);

  const recommendations = [];

  if (groups.length === 0) {
    recommendations.push('Join a study group for your modules — students in active groups upload more resources and stay on top of deadlines.');
  } else {
    recommendations.push(`You're active in ${[...new Set(groups)].join(', ')} — check the Resource Library for the latest notes in those modules.`);
  }

  if (stats.uploadsCount === 0) {
    recommendations.push('Try uploading a resource — summarising your own notes is one of the most effective ways to revise, and it earns the Academic Contributor badge.');
  }

  if (stats.streak < 3) {
    recommendations.push('Log in daily to build your study streak — consistent short sessions beat occasional long ones for retention.');
  } else {
    recommendations.push(`Great consistency — you're on a ${stats.streak}-day streak. Keep it going!`);
  }

  recommendations.push('Use active recall: close your notes and try to explain a topic out loud before checking if you got it right.');

  res.json({ recommendations });
});

module.exports = router;
