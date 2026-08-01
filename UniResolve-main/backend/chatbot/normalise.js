/**
 * ============================================================
 * UniBot — vocabulary normalisation
 * ------------------------------------------------------------
 * The classifier matches on word overlap, so "was my petition
 * knocked back" and "were any of mine rejected" look unrelated
 * even though they mean the same thing.
 *
 * This module rewrites a sentence into a canonical vocabulary
 * BEFORE it reaches the classifier. The same rewriting is applied
 * to the training phrases, so both sides speak the same language.
 *
 * IMPORTANT — this is used for INTENT CLASSIFICATION ONLY.
 * Entities (complaint IDs, category names, department names) are
 * always read from the user's original wording, because rewriting
 * would corrupt proper nouns such as "Hostel Office".
 *
 * Rules are deliberately conservative. A mapping is only included
 * when the word is unambiguous in this domain. Words that carry a
 * second meaning here are explicitly excluded and the reason is
 * recorded, because an over-eager rule does more harm than good:
 * an earlier draft mapped "file" to "submit", which broke
 * "can I attach a file".
 * ============================================================
 */

/**
 * Multi-word phrases, replaced first and longest-first so that
 * "knocked back" resolves before "back" is ever considered.
 */
const PHRASES = [
  // rejected
  ['knocked back', 'rejected'],
  ['turned down', 'rejected'],
  ['thrown out', 'rejected'],
  ['shot down', 'rejected'],
  ['not accepted', 'rejected'],

  // resolved
  ['wrapped up', 'resolved'],
  ['sorted out', 'resolved'],
  ['taken care of', 'resolved'],
  ['put right', 'resolved'],
  ['done and dusted', 'resolved'],

  // still open
  ['gathering dust', 'still pending'],
  ['still outstanding', 'still pending'],
  ['not been actioned', 'still pending'],
  ['left hanging', 'still pending'],
  ['in limbo', 'still pending'],

  // oldest / slowest
  ['taking forever', 'oldest waiting longest'],
  ['dragging on', 'oldest waiting longest'],
  ['most overdue', 'oldest'],
  ['waiting the longest', 'oldest'],
  ['sitting the longest', 'oldest'],

  // urgent
  ['on fire', 'urgent'],
  ['needs immediate attention', 'urgent'],
  ['most pressing', 'urgent'],

  // who is handling it
  ['took ownership of', 'is handling'],
  ['taken ownership of', 'is handling'],
  ['is accountable for', 'is handling'],
  ['looking after', 'handling'],
  ['in charge of', 'handling'],

  // analytics
  ['paint me a picture', 'give me an overview'],
  ['piling up on my desk', 'waiting for review'],
  ['star performer', 'best coordinator'],
  ['mean time to resolve', 'average resolution time'],
  ['turnaround time', 'average resolution time'],

  // history
  ['chronology of', 'history of'],
  ['audit trail', 'history'],
  ['blow by blow', 'history'],

  // breakdown
  ['carve up', 'break down'],

  // process
  ['remain concealed', 'anonymous'],
  ['stay unnamed', 'anonymous'],
  ['remain nameless', 'anonymous'],
  ['identity concealed', 'anonymous'],
  ['cropped up again', 'happened again'],
  ['flared up again', 'happened again'],
  ['in the dark about', 'update on'],
  ['any word back', 'any update'],
  ['keep an eye on', 'track'],
  ['keep tabs on', 'track'],
];

/**
 * Single words, matched on whole-word boundaries.
 *
 * Deliberately NOT mapped, and why:
 *   file / files   — a file is an attachment here, not the verb "to file"
 *   report         — both a noun and a verb in this domain
 *   open           — "open complaints" must stay distinct from "pending"
 *   total, days    — used verbatim in counting and duration questions
 *   office, section— appear inside real department names
 *   issue          — used for both "an issue" and "to issue"
 */
const WORDS = {
  grievance: 'complaint',
  grievances: 'complaints',
  petition: 'complaint',
  petitions: 'complaints',
  ticket: 'complaint',
  tickets: 'complaints',

  lodge: 'submit',
  lodged: 'submitted',
  lodging: 'submitting',
  filed: 'submitted',
  escalated: 'submitted',

  fixed: 'resolved',
  solved: 'resolved',
  concluded: 'resolved',
  unresolved: 'pending',
  languishing: 'oldest',
  overdue: 'oldest',
  critical: 'urgent',

  tally: 'count',
  enumerate: 'list',
};

/** Escapes a phrase for safe use inside a RegExp. */
const escapeRe = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

const PHRASE_RULES = [...PHRASES]
  .sort((a, b) => b[0].length - a[0].length)
  .map(([from, to]) => [new RegExp(`\\b${escapeRe(from)}\\b`, 'gi'), to]);

const WORD_RULES = Object.entries(WORDS)
  .map(([from, to]) => [new RegExp(`\\b${escapeRe(from)}\\b`, 'gi'), to]);

/**
 * Rewrites text into the canonical vocabulary.
 * Applied to training phrases and to incoming questions alike.
 */
const ENABLED = String(process.env.CHATBOT_NORMALISE || 'on').toLowerCase() !== 'off';

function normalise(text) {
  if (!ENABLED) return String(text || '').toLowerCase().trim();
  let out = ` ${String(text || '').toLowerCase()} `;
  PHRASE_RULES.forEach(([re, to]) => { out = out.replace(re, to); });
  WORD_RULES.forEach(([re, to]) => { out = out.replace(re, to); });
  return out.replace(/\s+/g, ' ').trim();
}

module.exports = { normalise, PHRASES, WORDS };
