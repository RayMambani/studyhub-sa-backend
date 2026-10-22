// routes/ai.js
//
// Backs the "AI Study Assist" feature (summaries, Q&A, recommendations).
//
// Uses Google's Gemini API when GEMINI_API_KEY is set in the environment,
// and automatically falls back to a local rule-based implementation if the
// key is missing OR every model call fails -- so the feature never just
// breaks for the student.

const express = require('express');
const db = require('../db/db');
const { requireAuth } = require('../middleware/auth');
const { computeUserStats } = require('../util/stats');

const router = express.Router();

// Hardcoded names used only if the discovery call below itself fails.
const FALLBACK_MODELS = ['gemini-flash-latest', 'gemini-2.5-flash'];

let modelCache = { models: null, fetchedAt: 0 };
const MODEL_CACHE_TTL_MS = 60 * 60 * 1000; // re-check every hour

// Rather than guessing hardcoded model names (which Google keeps retiring),
// ask Google directly which models currently exist and support
// generateContent, then use those. This self-heals when Google renames or
// retires a model, instead of needing a manual code fix every time.
async function getAvailableModels(apiKey) {
  const now = Date.now();
  if (modelCache.models && (now - modelCache.fetchedAt) < MODEL_CACHE_TTL_MS) {
    return modelCache.models;
  }

  try {
    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models?key=${apiKey}`);
    if (!response.ok) {
      console.error('[ai] ListModels failed:', response.status, await response.text());
      return FALLBACK_MODELS;
    }
    const data = await response.json();
    const names = (data.models || [])
      .filter(m => Array.isArray(m.supportedGenerationMethods) && m.supportedGenerationMethods.includes('generateContent'))
      .map(m => m.name.replace(/^models\//, ''))
      .sort((a, b) => (a.includes('flash') ? -1 : 1) - (b.includes('flash') ? -1 : 1));

    if (names.length > 0) {
      modelCache = { models: names, fetchedAt: now };
      return names;
    }
    return FALLBACK_MODELS;
  } catch (err) {
    console.error('[ai] ListModels threw:', err.message);
    return FALLBACK_MODELS;
  }
}

const GEMINI_URL = (model, key) =>
  `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`;

async function callGemini(prompt) {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) return null;

  const models = await getAvailableModels(apiKey);

  for (const model of models.slice(0, 5)) {
    try {
      const response = await fetch(GEMINI_URL(model, apiKey), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
        }),
      });

      if (!response.ok) {
        console.error(`[ai] Gemini request failed for model ${model}:`, response.status, await response.text());
        continue;
      }

      const data = await response.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
      if (text) {
        console.log(`[ai] Success using model: ${model}`);
        return text.trim();
      }
    } catch (err) {
      console.error(`[ai] Gemini call threw for model ${model}:`, err.message);
    }
  }

  return null; // every model attempt failed -- caller falls back to local logic
}

// --- Local fallback logic (used when Gemini is unavailable) ---

const KNOWLEDGE_BASE = [
  { keywords: ['linked list', 'node', 'pointer'], answer: 'A linked list stores elements as nodes, where each node holds a value and a pointer to the next node. A dummy head node is a common trick that removes the need for special-case handling of an empty list or deleting the first element.' },
  { keywords: ['binomial', 'poisson', 'normal distribution', 'distribution'], answer: 'Use Binomial for a fixed number of trials with two outcomes, Poisson for counting events over time at a constant rate, and Normal for continuous, symmetric, bell-shaped data. Convert to a z-score (z = (x - mean) / std dev) to use the standard normal table.' },
  { keywords: ['void contract', 'voidable', 'contract'], answer: 'A void contract never had legal effect at all. A voidable contract is valid but one party may choose to cancel it (e.g. due to misrepresentation or duress) -- until cancelled, it remains binding.' },
  { keywords: ['osi model', 'osi layer', 'layers'], answer: 'The OSI model has 7 layers: Physical, Data Link, Network, Transport, Session, Presentation, Application (mnemonic: "All People Seem To Need Data Processing"). Routers work at the Network layer, switches at the Data Link layer.' },
  { keywords: ['accounting equation', 'balance sheet', 'income statement'], answer: 'The accounting equation is Assets = Liabilities + Owner\'s Equity. The Income Statement shows performance over a period; the Balance Sheet shows financial position at a single point in time.' },
  { keywords: ['study tip', 'how to study', 'exam prep', 'revise'], answer: 'Active recall (testing yourself without notes) and spaced repetition (revisiting material over several days rather than one long session) are consistently the most effective study techniques -- more effective than re-reading notes.' },
];

function localAnswer(question) {
  const q = question.toLowerCase();
  const match = KNOWLEDGE_BASE.find(entry => entry.keywords.some(k => q.includes(k)));
  if (match) return match.answer;
  return "I don't have a specific answer for that yet -- try checking the Resource Library for your module's notes, or rephrase your question using a term from your course material (e.g. \"linked list\", \"OSI model\", \"binomial distribution\").";
}

function localSummarise(text, maxSentences = 3) {
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

// --- Routes ---

// POST /api/ai/summarize   Body: { text }
router.post('/summarize', requireAuth, async (req, res) => {
  const { text } = req.body;
  if (!text || text.trim().length < 40) {
    return res.status(400).json({ error: 'Paste at least a paragraph of text to summarise.' });
  }

  const geminiSummary = await callGemini(
    `Summarise the following study notes in 3-4 concise sentences, suitable for a student revising before a test:\n\n${text}`
  );
  res.json({ summary: geminiSummary || localSummarise(text) });
});

// POST /api/ai/ask   Body: { question }
router.post('/ask', requireAuth, async (req, res) => {
  const { question } = req.body;
  if (!question || !question.trim()) {
    return res.status(400).json({ error: 'question is required' });
  }

  const geminiAnswer = await callGemini(
    `You are a helpful study assistant for a South African university student. Answer this academic question clearly and concisely, in 2-4 sentences:\n\n${question}`
  );
  res.json({ answer: geminiAnswer || localAnswer(question) });
});

// GET /api/ai/recommendations -- based on the student's real activity
router.get('/recommendations', requireAuth, async (req, res) => {
  const stats = await computeUserStats(req.userId);
  const groups = (await db.all('SELECT g.module FROM group_members gm JOIN study_groups g ON g.id = gm.group_id WHERE gm.user_id = ?', [req.userId])).map(r => r.module);

  const geminiPrompt = `A student is using a study app. They are in these modules: ${groups.length ? [...new Set(groups)].join(', ') : 'none yet'}. They have uploaded ${stats.uploadsCount} resources, joined ${stats.groupsCount} groups, and have a ${stats.streak}-day login streak. Give exactly 3 short, specific, encouraging study recommendations as a plain list, one per line, no numbering or markdown.`;

  const geminiText = await callGemini(geminiPrompt);
  if (geminiText) {
    const lines = geminiText.split('\n').map(l => l.replace(/^[-*\d.]+\s*/, '').trim()).filter(Boolean);
    if (lines.length > 0) return res.json({ recommendations: lines.slice(0, 4) });
  }

  // Local fallback
  const recommendations = [];
  if (groups.length === 0) {
    recommendations.push('Join a study group for your modules -- students in active groups upload more resources and stay on top of deadlines.');
  } else {
    recommendations.push(`You're active in ${[...new Set(groups)].join(', ')} -- check the Resource Library for the latest notes in those modules.`);
  }
  if (stats.uploadsCount === 0) {
    recommendations.push('Try uploading a resource -- summarising your own notes is one of the most effective ways to revise, and it earns the Academic Contributor badge.');
  }
  if (stats.streak < 3) {
    recommendations.push('Log in daily to build your study streak -- consistent short sessions beat occasional long ones for retention.');
  } else {
    recommendations.push(`Great consistency -- you're on a ${stats.streak}-day streak. Keep it going!`);
  }
  recommendations.push('Use active recall: close your notes and try to explain a topic out loud before checking if you got it right.');

  res.json({ recommendations });
});

module.exports = router;