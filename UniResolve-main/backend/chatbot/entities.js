/**
 * ============================================================
 * UniBot — entity extraction and topic matching
 * ------------------------------------------------------------
 * Intent classification alone tells us WHAT kind of question was
 * asked. Entities tell us WHICH complaint(s) it is about.
 *
 * Two mechanisms:
 *   1. NLP.js named entities — complaint IDs (regex) plus enum
 *      entities for status, category, department, priority and
 *      relative time periods, each with natural synonyms.
 *   2. Topic matching — a small keyword scorer that finds the
 *      complaint whose title/description best matches the words
 *      in the question, so "my complaint for the course
 *      registration" resolves to the right record.
 * ============================================================
 */

const STATUSES = {
  'Submitted': ['submitted', 'just filed', 'newly submitted', 'not yet reviewed'],
  'Under Review': ['under review', 'being reviewed', 'reviewing', 'in review'],
  'Assigned': ['assigned', 'allocated'],
  'In Progress': ['in progress', 'ongoing', 'being worked on', 'in process', 'working on'],
  'Resolved': ['resolved', 'fixed', 'completed', 'done', 'closed', 'solved', 'sorted'],
  'Rejected': ['rejected', 'declined', 'refused', 'dismissed', 'invalid'],
  'Reopen Requested': ['reopen requested', 'reopened', 'reopen request', 'reopening'],
};

/*
 * Synonyms are deliberately specific. Very short or very common words
 * ("it", "room", "new") are excluded because they collide with ordinary
 * English — the pronoun in "what's up with it" was being read as the
 * IT Services category.
 */
const CATEGORIES = {
  'Academics': ['academics', 'academic', 'class', 'classes', 'lecture', 'lectures', 'course', 'courses', 'teaching', 'syllabus', 'attendance'],
  'Facilities': ['facilities', 'facility', 'building', 'classroom', 'washroom', 'toilet', 'furniture', 'cleaning', 'air conditioning', 'water cooler'],
  'Administration': ['administration', 'admin office', 'certificate', 'transcript', 'documents', 'paperwork', 'id card'],
  'IT Services': ['it services', 'it service', 'wifi', 'wi fi', 'internet', 'computer', 'computers', 'portal', 'software', 'printer', 'projector', 'laptop', 'network'],
  'Examination': ['examination', 'exam', 'exams', 'paper', 'papers', 'result', 'results', 'grade', 'grades', 'marks', 'date sheet', 'rechecking'],
  'Transport': ['transport', 'bus', 'buses', 'van', 'shuttle', 'commute'],
  'Hostel': ['hostel', 'dorm', 'dormitory', 'mess', 'accommodation', 'residence'],
  'Fee/Accounts': ['fee', 'fees', 'accounts', 'payment', 'challan', 'voucher', 'scholarship', 'refund', 'dues', 'installment'],
};

const DEPARTMENTS = {
  'IT Department': ['it department', 'it dept'],
  'Examination Department': ['examination department', 'exam department', 'exam office'],
  'Accounts Department': ['accounts department', 'accounts office', 'finance office'],
  'Transport Office': ['transport office', 'transport department'],
  'Hostel Office': ['hostel office', 'hostel department', 'warden'],
  'Academic Office': ['academic office', 'academics office'],
  'Maintenance Department': ['maintenance department', 'maintenance office', 'maintenance team'],
  'Administration Office': ['administration office', 'admin department'],
};

const PRIORITIES = {
  'Urgent': ['urgent', 'critical', 'emergency', 'immediately'],
  'High': ['high priority', 'high', 'important'],
  'Medium': ['medium priority', 'medium', 'normal'],
  'Low': ['low priority', 'low', 'minor'],
};

const PERIODS = {
  today:      ['today', 'this morning'],
  yesterday:  ['yesterday'],
  this_week:  ['this week', 'past week', 'last 7 days', 'last seven days'],
  this_month: ['this month', 'past month', 'last month', 'last 30 days', 'last thirty days'],
  this_year:  ['this year', 'past year', 'last year'],
};

/** Registers every entity on an NLP.js manager instance. */
function registerEntities(manager) {
  manager.addRegexEntity('complaintId', ['en'], /\bCMP[-\s]?\d{3,6}\b/gi);

  const addEnum = (name, map) => {
    Object.entries(map).forEach(([option, synonyms]) => {
      manager.addNamedEntityText(name, option, ['en'], synonyms);
    });
  };

  addEnum('status', STATUSES);
  addEnum('category', CATEGORIES);
  addEnum('department', DEPARTMENTS);
  addEnum('priority', PRIORITIES);
  addEnum('period', PERIODS);
}

/**
 * Flattens NLP.js entity output into a simple object.
 * Returns { complaintId, status, category, department, priority, period }.
 */
function collectEntities(result) {
  const found = {};
  (result.entities || []).forEach((e) => {
    const value = e.option || e.sourceText;
    if (!value) return;
    if (e.entity === 'complaintId') {
      found.complaintId = String(value).toUpperCase().replace(/\s+/g, '-');
    } else if (!found[e.entity]) {
      found[e.entity] = value;
    }
  });
  return found;
}

/** Converts a period entity into a Mongo date filter. */
function periodToRange(period) {
  const now = new Date();
  const start = new Date(now);
  switch (period) {
    case 'today':      start.setHours(0, 0, 0, 0); break;
    case 'yesterday':  start.setDate(start.getDate() - 1); start.setHours(0, 0, 0, 0); break;
    case 'this_week':  start.setDate(start.getDate() - 7); break;
    case 'this_month': start.setDate(start.getDate() - 30); break;
    case 'this_year':  start.setDate(start.getDate() - 365); break;
    default: return null;
  }
  return { $gte: start };
}

/* ============================================================
   Topic matching
   ============================================================ */

/**
 * Words that must never be treated as a complaint's SUBJECT.
 *
 * This list matters more than it looks. Status words in particular have to
 * be here: without them "is my complaint resolved or not" matched a
 * complaint titled "Fans not working in lecture hall 11" on the word "not",
 * and answered about that one complaint instead of all of them.
 *
 * Status and priority words are already captured as entities, so removing
 * them from topic search loses nothing.
 */
const STOPWORDS = new Set([
  // articles, pronouns, auxiliaries and question words
  'a', 'about', 'all', 'am', 'an', 'and', 'any', 'anything', 'are', 'as', 'at',
  'be', 'been', 'being', 'but', 'by', 'can', 'concerning', 'did', 'do', 'does',
  'for', 'from', 'get', 'give', 'had', 'has', 'have', 'how', 'i', 'if', 'in',
  'is', 'it', 'its', 'just', 'know', 'later', 'let', 'like', 'me', 'my', 'need',
  'of', 'on', 'one', 'ones', 'or', 'please', 'regarding', 'related', 'so',
  'some', 'tell', 'that', 'the', 'their', 'them', 'then', 'there', 'these',
  'they', 'this', 'those', 'to', 'told', 'up', 'us', 'want', 'was', 'we', 'were',
  'what', 'whats', 'when', 'where', 'which', 'who', 'why', 'will', 'with',
  'would', 'you', 'your', 'yet', 'mine', 'ours',

  // negations and fillers that carry no subject meaning
  'no', 'nor', 'not', 'never', 'ever', 'still', 'already', 'actually', 'really',
  'again', 'now', 'today', 'yes', 'ok', 'okay', 'much', 'many', 'more', 'most',
  'very', 'too', 'also', 'even', 'only', 'ah', 'hmm', 'hey', 'hi',

  // the domain nouns themselves
  'complaint', 'complaints', 'case', 'cases', 'issue', 'issues', 'problem',
  'problems', 'thing', 'things', 'matter', 'matters', 'ticket', 'tickets',
  'grievance', 'grievances', 'request', 'requests',

  // verbs describing interacting with the system
  'show', 'list', 'display', 'view', 'see', 'check', 'track', 'update', 'updates',
  'submitted', 'submit', 'filed', 'file', 'raised', 'raise', 'lodged', 'lodge',
  'happened', 'happening', 'handled', 'handling', 'handle',

  // status, priority and lifecycle vocabulary — captured as entities instead
  'status', 'resolved', 'resolve', 'resolving', 'pending', 'rejected', 'reject',
  'assigned', 'assign', 'progress', 'review', 'reviewed', 'reopen', 'reopened',
  'closed', 'close', 'open', 'done', 'fixed', 'fix', 'sorted', 'sort',
  'finished', 'finish', 'complete', 'completed', 'outstanding', 'unresolved',
  'urgent', 'priority', 'high', 'low', 'medium', 'oldest', 'newest', 'latest',
  'recent', 'resolution',
]);

/**
 * Minimum meaningful words before topic search is trusted.
 *
 * One is enough — "my printer complaint" names a real subject — because the
 * stop list above now strips the status and filler words that used to create
 * spurious single-word matches. Questions like "is it done" reduce to zero
 * content words and correctly skip topic search altogether.
 */
const MIN_TOPIC_WORDS = 1;

/** Very light stemmer: strips common English plural/verb endings. */
function stem(word) {
  return word
    .replace(/(ing|ed|es|s)$/i, '')
    .toLowerCase();
}

function contentWords(text) {
  return String(text || '')
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, ' ')
    .split(/\s+/)
    .filter((w) => w.length > 2 && !STOPWORDS.has(w))
    .map(stem)
    .filter(Boolean);
}

/**
 * Scores how well a complaint matches the words of a question.
 * Title matches count double because they are the closest thing
 * a complaint has to a subject line.
 */
function scoreComplaint(complaint, words) {
  if (!words.length) return 0;
  const title = contentWords(complaint.title);
  const body = contentWords(complaint.description);
  const category = contentWords(complaint.category);

  let score = 0;
  words.forEach((w) => {
    if (title.some((t) => t.includes(w) || w.includes(t))) score += 2;
    else if (category.some((c) => c.includes(w) || w.includes(c))) score += 1.5;
    else if (body.some((b) => b.includes(w) || w.includes(b))) score += 1;
  });
  // Normalise so long questions do not automatically win.
  return score / words.length;
}

/**
 * Finds the complaint that best matches the free text of a question.
 * Returns null when nothing matches well enough to be confident.
 */
function findByTopic(text, complaints) {
  const words = contentWords(text);
  // A single leftover word is not enough to identify a complaint by subject —
  // that is how generic questions used to latch onto an unrelated record.
  if (words.length < MIN_TOPIC_WORDS || !complaints.length) return null;

  const ranked = complaints
    .map((c) => ({ complaint: c, score: scoreComplaint(c, words) }))
    .sort((a, b) => b.score - a.score);

  const best = ranked[0];
  if (!best || best.score < 0.8) return null;

  // If the runner-up is nearly as good, the reference is ambiguous.
  const second = ranked[1];
  if (second && best.score - second.score < 0.25) {
    return { complaint: best.complaint, ambiguous: true, alternatives: ranked.slice(0, 3).map((r) => r.complaint) };
  }
  return { complaint: best.complaint, ambiguous: false };
}

module.exports = {
  registerEntities,
  collectEntities,
  periodToRange,
  findByTopic,
  contentWords,
  STATUSES,
  CATEGORIES,
};
