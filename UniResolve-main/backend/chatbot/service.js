/**
 * ============================================================
 * UniBot — NLP service
 * ------------------------------------------------------------
 * Uses NLP.js (node-nlp): a lightweight, CPU-only NLP library.
 * No large language model and no external API is involved.
 *
 * Pipeline for every message:
 *
 *   1. CLASSIFY  — a small neural network trained at startup on
 *                  the example phrases in intents.js decides what
 *                  kind of question this is.
 *   2. EXTRACT   — named entity recognition pulls out specifics:
 *                  complaint IDs, status, category, department,
 *                  priority and time periods.
 *   3. RESOLVE   — works out WHICH complaint is meant, using the
 *                  ID, a topic keyword match, or what was being
 *                  discussed a moment ago.
 *   4. ANSWER    — queries MongoDB within the asker's permissions
 *                  and phrases the reply for their role.
 *   5. FALLBACK  — below the confidence threshold we never guess;
 *                  we offer the closest matches instead and log
 *                  the question so gaps can be found later.
 * ============================================================
 */

const { NlpManager } = require('node-nlp');
const { intents, answers, fallbacks } = require('./intents');
const { registerEntities } = require('./entities');
const { answerFromData } = require('./answers');
const { forget } = require('./context');
const { normalise } = require('./normalise');
const ChatLog = require('../models/ChatLog');

/** Below this score we do not trust the lexical classification. */
const THRESHOLD = 0.55;
/** Between this and THRESHOLD we offer suggestions rather than guessing. */
const SUGGEST_FLOOR = 0.22;


let manager = null;
let ready = false;
let stats = { intents: 0, utterances: 0, trainMs: 0 };

const pick = (list) => list[Math.floor(Math.random() * list.length)];

/** Human-readable label for an intent, used by "did you mean?". */
const INTENT_LABELS = {
  'data.complaint.status': 'the status of a complaint',
  'data.complaint.check': 'whether a complaint is resolved',
  'data.complaint.about': 'a complaint on a particular topic',
  'data.complaint.list': 'a list of complaints',
  'data.complaint.count': 'how many complaints there are',
  'data.complaint.pending': 'which complaints are still open',
  'data.complaint.resolved': 'which complaints are resolved',
  'data.complaint.rejected': 'which complaints were rejected',
  'data.complaint.latest': 'the most recent complaint',
  'data.complaint.oldest': 'the longest-waiting complaint',
  'data.complaint.urgent': 'urgent complaints',
  'data.complaint.handler': 'who is handling a complaint',
  'data.complaint.duration': 'how long a complaint has been open',
  'data.complaint.next': 'what to do next',
  'data.complaint.timeline': 'the history of a complaint',
  'data.complaint.breakdown': 'a breakdown by category',
  'data.complaint.feedback': 'complaints waiting for your rating',
  'data.notifications': 'your notifications',
  'data.stats.departments': 'department statistics',
  'data.stats.coordinators': 'coordinator performance',
  'data.stats.performance': 'overall performance',
  'data.stats.unassigned': 'what is waiting for review',
  'data.stats.workload': 'what to work on next',
  'faq.submit': 'how to submit a complaint',
  'faq.status.meaning': 'what the statuses mean',
  'faq.time': 'how long resolution takes',
  'faq.attachment': 'attaching files',
  'faq.anonymous': 'anonymous complaints',
  'faq.reopen': 'reopening a complaint',
  'faq.feedback': 'giving feedback',
  'faq.track': 'tracking a complaint',
  'faq.categories': 'complaint categories',
  'faq.contact': 'contacting support',
  'faq.reject': 'why complaints get rejected',
};

/** Example question the user can click to run the suggested intent. */
const INTENT_EXAMPLES = {
  'data.complaint.status': 'What is the status of my complaint?',
  'data.complaint.check': 'Is my complaint resolved?',
  'data.complaint.list': 'Show my complaints',
  'data.complaint.count': 'How many complaints do I have?',
  'data.complaint.pending': 'Which are still pending?',
  'data.complaint.resolved': 'Show my resolved complaints',
  'data.complaint.rejected': 'Show my rejected complaints',
  'data.complaint.latest': 'What is my latest complaint?',
  'data.complaint.oldest': 'What is the oldest one?',
  'data.complaint.urgent': 'Show urgent complaints',
  'data.complaint.handler': 'Who is handling my complaint?',
  'data.complaint.duration': 'How long has it been open?',
  'data.complaint.next': 'What should I do next?',
  'data.complaint.timeline': 'What has happened with my complaint?',
  'data.complaint.breakdown': 'What do I complain about most?',
  'data.complaint.feedback': 'Which complaints can I rate?',
  'data.notifications': 'Do I have any notifications?',
  'data.stats.departments': 'Which department has the most complaints?',
  'data.stats.coordinators': 'Coordinator performance',
  'data.stats.performance': 'Give me an overview',
  'data.stats.unassigned': 'What is waiting for review?',
  'data.stats.workload': 'What should I work on next?',
  'faq.submit': 'How do I submit a complaint?',
  'faq.status.meaning': 'What do the statuses mean?',
  'faq.time': 'How long does it take?',
  'faq.attachment': 'Can I attach a file?',
  'faq.anonymous': 'Can I complain anonymously?',
  'faq.reopen': 'How do I reopen a complaint?',
  'faq.feedback': 'How do I give feedback?',
  'faq.track': 'How do I track my complaint?',
  'faq.categories': 'What can I complain about?',
  'faq.contact': 'How do I contact support?',
  'faq.reject': 'Why do complaints get rejected?',
};

/**
 * Trains the classifier. Called once from server.js at startup.
 * Runs entirely on the CPU in well under a second.
 */
async function trainBot() {
  manager = new NlpManager({
    languages: ['en'],
    forceNER: true,          // entity recognition is part of the pipeline
    nlu: { log: false },
    autoSave: false,
    autoLoad: false,
  });

  registerEntities(manager);

  /*
   * Each example is registered in BOTH its original and its normalised
   * form. Adding rather than replacing matters: rewriting alone measured
   * worse than doing nothing (95.1% vs 99.2%), because collapsing
   * vocabulary also erases distinctions the classifier was relying on.
   * Training on both keeps every original cue and merely adds synonym
   * coverage on top.
   */
  let utterances = 0;
  let augmented = 0;
  Object.entries(intents).forEach(([intent, examples]) => {
    examples.forEach((example) => {
      manager.addDocument('en', example, intent);
      utterances += 1;

      const canonical = normalise(example);
      if (canonical && canonical !== example.toLowerCase().trim()) {
        manager.addDocument('en', canonical, intent);
        augmented += 1;
      }
    });
    // NLP.js needs at least one answer registered per intent.
    manager.addAnswer('en', intent, intent);
  });

  const startedAt = Date.now();
  await manager.train();
  stats = {
    intents: Object.keys(intents).length,
    utterances,
    trainMs: Date.now() - startedAt,
  };
  ready = true;

  console.log(`UniBot trained: ${stats.intents} intents, ${stats.utterances} example phrases in ${stats.trainMs}ms`);

}

const isReady = () => ready;
const getStats = () => ({ ...stats });

/**
 * Classifies a question.
 *
 * The text is first rewritten into a canonical vocabulary (see
 * normalise.js) so that "was my petition knocked back" and "were any
 * rejected" reach the classifier as the same words. Training phrases go
 * through the identical rewrite, so both sides always agree.
 *
 * Returns { intent, score, normalised, result }.
 */
async function classify(text) {
  if (!ready) throw new Error('UniBot is not trained yet');

  const original = String(text || '');
  const canonical = normalise(original);

  /*
   * Read the question twice: as written, and with synonyms folded into
   * the canonical vocabulary. Whichever reading the classifier is more
   * confident about wins. The original is preferred on a tie, so
   * normalisation can only ever add understanding, never remove it.
   */
  const asWritten = await manager.process('en', original);
  const asCanonical = canonical && canonical !== original.toLowerCase().trim()
    ? await manager.process('en', canonical)
    : null;

  const useCanonical = asCanonical && Number(asCanonical.score || 0) > Number(asWritten.score || 0);
  const intentResult = useCanonical ? asCanonical : asWritten;
  const score = Number(intentResult.score || 0);
  const confident = intentResult.intent && intentResult.intent !== 'None' && score >= THRESHOLD;

  return {
    intent: confident ? intentResult.intent : 'None',
    score,
    normalised: canonical,
    reading: useCanonical ? 'canonical' : 'as-written',
    // Entities always come from the ORIGINAL wording: rewriting would
    // corrupt proper nouns such as "Hostel Office".
    result: asWritten,
    intentResult,
  };
}

/** Records questions we could not answer, so gaps can be reviewed later. */
async function logUnanswered(text, user, score) {
  try {
    await ChatLog.create({
      user: user._id,
      role: user.role,
      message: String(text).slice(0, 500),
      score,
    });
  } catch (err) {
    // Logging must never break a reply.
    console.error('UniBot could not log an unanswered question:', err.message);
  }
}

/** Builds a "did you mean…?" reply from the next-best classifications. */
function buildSuggestions(result, user) {
  const ranked = (result.classifications || [])
    .filter((c) => c.intent !== 'None' && c.score >= SUGGEST_FLOOR)
    .filter((c) => INTENT_LABELS[c.intent])
    .filter((c) => !(user.role !== 'student' && c.intent === 'data.notifications'))
    .filter((c) => !(user.role === 'student' && c.intent.startsWith('data.stats.')))
    .slice(0, 2);

  return ranked.map((c) => ({
    intent: c.intent,
    label: INTENT_LABELS[c.intent],
    example: INTENT_EXAMPLES[c.intent] || INTENT_LABELS[c.intent],
  }));
}

/**
 * Classifies `message` and produces a reply for `user`.
 * Returns { reply, intent, score, source, suggestions }.
 */
async function askBot(message, user) {
  if (!ready) {
    return { reply: 'I am still starting up — please try again in a moment.', intent: 'none', score: 0, source: 'system', suggestions: [] };
  }

  const text = String(message || '').trim();
  if (!text) {
    return { reply: pick(fallbacks), intent: 'none', score: 0, source: 'fallback', suggestions: [] };
  }

  const decision = await classify(text);
  const { intent, score, result } = decision;

  // Not confident enough — offer the closest matches instead of guessing.
  if (!intent || intent === 'None') {
    const suggestions = buildSuggestions(decision.intentResult || result, user);
    await logUnanswered(text, user, score);

    const lead = pick(fallbacks);
    const body = suggestions.length
      ? `${lead} Did you want to know about ${suggestions.map((s) => `**${s.label}**`).join(' or ')}?`
      : `${lead} You can ask me things like "is my complaint resolved", "show my pending complaints", or "how do I submit a complaint".`;

    return { reply: body, intent: 'none', score, source: 'fallback', suggestions };
  }

  if (intent === 'chat.bye') forget(user._id);

  // Data-backed intents query MongoDB within the asker's permissions.
  if (intent.startsWith('data.')) {
    try {
      const reply = await answerFromData(intent, { text, result, user });
      if (reply) return { reply, intent, score, source: 'data', suggestions: [] };
    } catch (err) {
      console.error('UniBot data lookup failed:', err.message);
      return {
        reply: 'I could not read the complaint records just now. Please try again in a moment.',
        intent, score, source: 'error', suggestions: [],
      };
    }
  }

  const staticAnswer = answers[intent];
  if (staticAnswer) return { reply: pick(staticAnswer), intent, score, source: 'faq', suggestions: [] };

  // Intent understood but nothing to say — treat as unanswered.
  await logUnanswered(text, user, score);
  return { reply: pick(fallbacks), intent, score, source: 'fallback', suggestions: [] };
}

/** Quick-reply chips shown in the widget, tailored per role. */
function suggestionsFor(role) {
  if (role === 'admin') {
    return [
      'What is waiting for review?',
      'Give me an overview',
      'Which department has the most complaints?',
      'Show urgent complaints',
      'Coordinator performance',
    ];
  }
  if (role === 'coordinator') {
    return [
      'What should I work on next?',
      'Which are still pending?',
      'How am I performing?',
      'Show urgent complaints',
      'What is my oldest complaint?',
    ];
  }
  return [
    'Is my complaint resolved?',
    'How many are resolved?',
    'Show my pending complaints',
    'Who is handling my complaint?',
    'How do I submit a complaint?',
  ];
}

module.exports = { trainBot, askBot, isReady, suggestionsFor, classify, getStats, THRESHOLD };
