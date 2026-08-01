/**
 * ============================================================
 * UniBot — answer engine
 * ------------------------------------------------------------
 * Turns (intent + entities + conversation context) into a natural
 * reply backed by live MongoDB data.
 *
 * Everything here is role-aware. A student asking "how many are
 * resolved?" means their own complaints; a coordinator means the
 * ones assigned to them; an admin means the whole system. The
 * wording changes to match, so replies read naturally for each.
 * ============================================================
 */

const Complaint = require('../models/Complaint');
const Notification = require('../models/Notification');
const { collectEntities, periodToRange, findByTopic } = require('./entities');
const { remember, recall } = require('./context');

/* ============================================================
   Role-aware vocabulary
   ============================================================ */

const isStudent = (u) => u.role === 'student';
const isCoordinator = (u) => u.role === 'coordinator';
const isAdmin = (u) => u.role === 'admin';

/** The Mongo filter limiting a user to what they may see. */
function scopeFor(user) {
  if (isStudent(user)) return { student: user._id };
  if (isCoordinator(user)) return { assignedCoordinator: user._id };
  return {};
}

/** "your complaints" / "the complaints assigned to you" / "complaints in the system" */
function ownerPhrase(user) {
  if (isStudent(user)) return 'your complaints';
  if (isCoordinator(user)) return 'the complaints assigned to you';
  return 'complaints in the system';
}

/**
 * Grammatical count sentence for each role.
 * When `noun` already carries a qualifier ("assigned complaint"), the
 * coordinator wording switches to "You have …" so the sentence does not
 * read "3 assigned complaints are assigned to you".
 */
function countSentence(user, n, noun = 'complaint') {
  const label = `${n} ${noun}${n === 1 ? '' : 's'}`;
  if (isStudent(user)) return `You have **${label}**`;
  if (isCoordinator(user)) {
    return noun === 'complaint'
      ? `**${label}** ${n === 1 ? 'is' : 'are'} assigned to you`
      : `You have **${label}**`;
  }
  return `There ${n === 1 ? 'is' : 'are'} **${label}** in the system`;
}

/** Empty-state wording per role. */
function emptyPhrase(user, qualifier = '') {
  const q = qualifier ? `${qualifier} ` : '';
  if (isStudent(user)) return `You have no ${q}complaints at the moment.`;
  if (isCoordinator(user)) return `You have no ${q}complaints assigned to you right now.`;
  return `There are no ${q}complaints in the system right now.`;
}

/* ============================================================
   Formatting helpers
   ============================================================ */

const plural = (n, word) => `${n} ${word}${n === 1 ? '' : 's'}`;

function daysOpen(complaint) {
  const end = complaint.resolvedAt ? new Date(complaint.resolvedAt) : new Date();
  return Math.max(0, Math.round((end - new Date(complaint.createdAt)) / 86400000));
}

function formatDate(d) {
  return new Date(d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

/** One-line summary used in lists. */
function line(c, user) {
  const bits = [`**${c.complaintId}** — ${c.title}`, `Status: ${c.status}`];
  if (!isStudent(user) && c.priority && c.priority !== 'Medium') bits.push(`Priority: ${c.priority}`);
  if (isStudent(user) && c.assignedCoordinatorName) bits.push(`with ${c.assignedCoordinatorName}`);
  if (!isStudent(user)) bits.push(c.isAnonymous ? 'Anonymous student' : c.studentName);
  return `• ${bits.join(' · ')}`;
}

function listOf(complaints, user, limit = 8) {
  return complaints.slice(0, limit).map((c) => line(c, user)).join('\n');
}

function moreNote(total, shown) {
  // "more" is already a mass word — never pluralise it.
  return total > shown ? `\n…and ${total - shown} more. Open your dashboard to see them all.` : '';
}

/** What the current status means, in plain language and role-appropriate. */
function statusHint(c, user) {
  if (isStudent(user)) {
    const hints = {
      'Submitted': 'It is waiting for an admin to review it.',
      'Under Review': 'An admin is verifying it right now.',
      'Assigned': `It has been accepted and passed to ${c.assignedCoordinatorName || 'a coordinator'}.`,
      'In Progress': `${c.assignedCoordinatorName || 'The coordinator'} is actively working on it.`,
      'Resolved': 'It has been fixed. You can leave feedback on it from your dashboard.',
      'Rejected': 'It was found invalid, and the reason is recorded on the complaint.',
      'Reopen Requested': 'Your reopen request is waiting for admin review.',
    };
    return hints[c.status] || '';
  }
  const staff = {
    'Submitted': 'It still needs admin review.',
    'Under Review': 'It is being verified by the admin office.',
    'Assigned': 'It has not been started yet.',
    'In Progress': 'Work is underway.',
    'Resolved': 'It is closed.',
    'Rejected': 'It was rejected by the admin office.',
    'Reopen Requested': 'The student has asked for this to be reopened.',
  };
  return staff[c.status] || '';
}

/** Detailed multi-line description of a single complaint. */
function describe(c, user, { includeNext = true } = {}) {
  const parts = [];
  parts.push(`**${c.complaintId}** — ${c.title}`);
  parts.push(`Status: **${c.status}** · ${c.category} · ${c.department}`);

  if (!isStudent(user)) {
    parts.push(`Priority: ${c.priority || 'Medium'} · From: ${c.isAnonymous ? 'Anonymous student' : `${c.studentName} (${c.studentId})`}`);
  }
  if (c.assignedCoordinatorName) parts.push(`Handled by: ${c.assignedCoordinatorName}`);

  parts.push(c.resolvedAt
    ? `Submitted ${formatDate(c.createdAt)}, resolved in ${plural(daysOpen(c), 'day')}.`
    : `Submitted ${formatDate(c.createdAt)} — open for ${plural(daysOpen(c), 'day')}.`);

  if (c.status === 'Rejected' && c.rejectionReason) parts.push(`Reason: ${c.rejectionReason}`);
  if (c.coordinatorNotes) parts.push(`Note: ${c.coordinatorNotes}`);
  if (c.feedback?.rating) parts.push(`Your rating: ${c.feedback.rating}/5`);

  if (includeNext) {
    const hint = statusHint(c, user);
    if (hint) parts.push(hint);
  }
  return parts.join('\n');
}

/* ============================================================
   Target resolution — WHICH complaint is being asked about
   ============================================================ */

/**
 * Works out which complaint the user means, using in priority order:
 *   1. an explicit complaint ID in the message
 *   2. a topic match against their complaints ("the wifi one")
 *   3. the complaint discussed earlier in this conversation
 *   4. their single complaint, if they only have one
 *
 * Returns { complaint, how, ambiguous, alternatives } or null.
 */
async function resolveTarget(text, entities, user, ctx) {
  const scope = scopeFor(user);

  // 1. Explicit ID
  if (entities.complaintId) {
    const byId = await Complaint.findOne({ ...scope, complaintId: entities.complaintId });
    if (byId) return { complaint: byId, how: 'id' };
    // The ID exists but not in their scope, or does not exist at all.
    const anywhere = await Complaint.findOne({ complaintId: entities.complaintId });
    return { notFound: true, requestedId: entities.complaintId, existsElsewhere: !!anywhere };
  }

  const pool = await Complaint.find(scope).sort({ createdAt: -1 }).limit(120);
  if (!pool.length) return null;

  // 2. Topic match
  const topic = findByTopic(text, pool);
  if (topic) {
    return { complaint: topic.complaint, how: 'topic', ambiguous: topic.ambiguous, alternatives: topic.alternatives };
  }

  // 3. Conversation context
  if (ctx.lastComplaintId) {
    const remembered = pool.find((c) => c.complaintId === ctx.lastComplaintId);
    if (remembered) return { complaint: remembered, how: 'context' };
  }

  // 4. Only one complaint — unambiguous by definition
  if (pool.length === 1) return { complaint: pool[0], how: 'only' };

  return null;
}

/** Builds the Mongo filter implied by any entities in the message. */
function filtersFrom(entities, scope) {
  const query = { ...scope };
  const applied = [];

  if (entities.status) { query.status = entities.status; applied.push(entities.status.toLowerCase()); }
  if (entities.category) { query.category = entities.category; applied.push(entities.category); }
  if (entities.department) { query.department = entities.department; applied.push(entities.department); }
  if (entities.priority) { query.priority = entities.priority; applied.push(`${entities.priority.toLowerCase()} priority`); }
  if (entities.period) {
    const range = periodToRange(entities.period);
    if (range) { query.createdAt = range; applied.push(entities.period.replace(/_/g, ' ')); }
  }
  return { query, applied };
}

const describeFilters = (applied) => (applied.length ? ` (${applied.join(', ')})` : '');

/**
 * Turns status/category entities into an adjective so counts read naturally:
 * "3 resolved Hostel complaints" rather than "3 complaints (resolved, Hostel)".
 * Returns null when the filters do not lend themselves to an adjective.
 */
function qualifiedNoun(entities) {
  const parts = [];
  if (entities.status) parts.push(entities.status.toLowerCase());
  if (entities.category) parts.push(entities.category);
  if (entities.priority) parts.push(`${entities.priority.toLowerCase()} priority`);
  if (!parts.length) return null;
  if (entities.department || entities.period) return null;   // better as a suffix
  return `${parts.join(' ')} complaint`;
}

/* ============================================================
   Intent handlers
   ============================================================ */

const OPEN_STATUSES = ['Submitted', 'Under Review', 'Assigned', 'In Progress', 'Reopen Requested'];

/** Renders a complaint's full activity history as a readable list. */
function timelineOf(c) {
  const events = (c.timeline || []).map((t) => {
    const who = t.actorName ? ` — ${t.actorName}` : '';
    return `• **${t.status}** (${formatDate(t.createdAt)})${who}\n   ${t.message || ''}`.trimEnd();
  }).join('\n');

  const header = `**${c.complaintId}** — ${c.title}\nCurrently **${c.status}**, open ${plural(daysOpen(c), 'day')}.`;
  return events ? `${header}\n\nHistory:\n${events}` : `${header}\n\nNo activity has been recorded yet.`;
}

/** Shared wording when a complaint ID was given but cannot be shown. */
function notFoundMessage(target, user) {
  return target.existsElsewhere
    ? `I could not find **${target.requestedId}** among ${ownerPhrase(user)}. It may belong to another student or another coordinator.`
    : `I could not find a complaint with the ID **${target.requestedId}**. Please double-check the number.`;
}

const handlers = {

  /* ---------- single-complaint questions ---------- */

  async 'data.complaint.status'(ctxArgs) {
    return statusLike(ctxArgs, { yesNo: false });
  },

  async 'data.complaint.check'(ctxArgs) {
    return statusLike(ctxArgs, { yesNo: true });
  },

  async 'data.complaint.about'(ctxArgs) {
    return statusLike(ctxArgs, { yesNo: false, requireTarget: true });
  },

  async 'data.complaint.handler'({ target, user }) {
    // No single complaint identified — answer for all of them, which is
    // exactly what "who is handling my complaints" (plural) is asking.
    if (!target?.complaint) {
      if (target?.notFound) return notFoundMessage(target, user);

      const open = await Complaint.find({ ...scopeFor(user), status: { $in: OPEN_STATUSES } })
        .sort({ createdAt: -1 }).limit(12);
      if (!open.length) {
        const total = await Complaint.countDocuments(scopeFor(user));
        return total
          ? `Nothing of yours is open at the moment, so nobody is actively working on anything. All ${plural(total, 'complaint')} are closed.`
          : emptyPhrase(user);
      }

      const assigned = open.filter((c) => c.assignedCoordinatorName);
      const waiting = open.filter((c) => !c.assignedCoordinatorName);

      // Group by coordinator so the answer reads as a summary, not a dump.
      const byPerson = new Map();
      assigned.forEach((c) => {
        const key = `${c.assignedCoordinatorName}|${c.department}`;
        if (!byPerson.has(key)) byPerson.set(key, []);
        byPerson.get(key).push(c);
      });

      const sections = [];
      if (byPerson.size) {
        const lines = [...byPerson.entries()].map(([key, list]) => {
          const [name, dept] = key.split('|');
          const ids = list.map((c) => c.complaintId).join(', ');
          return `• **${name}** (${dept}) — ${plural(list.length, 'complaint')}: ${ids}`;
        }).join('\n');
        sections.push(`${plural(assigned.length, 'open complaint')} ${assigned.length === 1 ? 'is' : 'are'} with a coordinator:\n${lines}`);
      }
      if (waiting.length) {
        sections.push(`${plural(waiting.length, 'complaint')} ${waiting.length === 1 ? 'has' : 'have'} not been assigned yet — still with the admin office:\n${listOf(waiting, user, 5)}`);
      }
      return sections.join('\n\n');
    }

    const c = target.complaint;
    if (!c.assignedCoordinatorName) {
      return `**${c.complaintId}** has not been assigned to a coordinator yet — it is still at the "${c.status}" stage with the admin office.`;
    }
    return `**${c.complaintId}** (${c.title}) is being handled by **${c.assignedCoordinatorName}** in the ${c.department}.\n${statusHint(c, user)}`;
  },

  async 'data.complaint.duration'({ target, user }) {
    // No single complaint identified — summarise waiting times instead.
    if (!target?.complaint) {
      if (target?.notFound) return notFoundMessage(target, user);

      const open = await Complaint.find({ ...scopeFor(user), status: { $in: OPEN_STATUSES } }).sort({ createdAt: 1 });
      if (!open.length) {
        const resolved = await Complaint.find({ ...scopeFor(user), resolvedAt: { $ne: null } });
        if (!resolved.length) return emptyPhrase(user);
        const avg = (resolved.reduce((s, c) => s + daysOpen(c), 0) / resolved.length).toFixed(1);
        return `Nothing is open right now. Your ${plural(resolved.length, 'closed complaint')} took **${avg} days** on average to resolve.`;
      }
      const longest = open.slice(0, 5).map((c) =>
        `• **${c.complaintId}** — ${c.title} · open ${plural(daysOpen(c), 'day')} · ${c.status}`).join('\n');
      const avgOpen = (open.reduce((s, c) => s + daysOpen(c), 0) / open.length).toFixed(0);
      return `${plural(open.length, 'complaint')} of yours ${open.length === 1 ? 'is' : 'are'} still open, waiting ${avgOpen} days on average. Longest first:\n${longest}`;
    }

    const c = target.complaint;
    const d = daysOpen(c);

    if (c.resolvedAt) {
      return `**${c.complaintId}** was resolved in ${plural(d, 'day')} (submitted ${formatDate(c.createdAt)}, resolved ${formatDate(c.resolvedAt)}).`;
    }
    const eta = {
      'Submitted': 'Complaints are usually reviewed within 1–2 working days.',
      'Under Review': 'Once verified it is normally assigned within a day.',
      'Assigned': 'The coordinator usually begins work within a couple of days.',
      'In Progress': 'It is being worked on now, so an update should follow shortly.',
      'Reopen Requested': 'An admin will review the reopen request shortly.',
    }[c.status] || '';
    return `**${c.complaintId}** has been open for ${plural(d, 'day')} and is currently **${c.status}**.\n${eta}`;
  },

  async 'data.complaint.next'({ target, user }) {
    if (isStudent(user)) {
      if (!target?.complaint) {
        return 'Nothing is needed from you right now. Submit a complaint from **Submit Complaint** whenever you need to, and I will keep you posted on its progress.';
      }
      const c = target.complaint;
      const advice = {
        'Submitted': 'Nothing is needed from you — an admin will review it shortly.',
        'Under Review': 'Nothing is needed from you while the admin verifies it.',
        'Assigned': 'Nothing is needed from you. The coordinator will begin work shortly.',
        'In Progress': 'Nothing is needed from you while the coordinator works on it.',
        'Resolved': c.feedback?.rating
          ? 'You have already rated this one, so nothing further is needed. If the problem returns you can request a reopen.'
          : 'You can now rate how it was handled from your dashboard. If the problem returns, request a reopen.',
        'Rejected': 'You can review the rejection reason on your dashboard, and submit a new complaint with more detail or evidence if you disagree.',
        'Reopen Requested': 'Nothing is needed from you — an admin is reviewing your reopen request.',
      }[c.status] || '';
      return `For **${c.complaintId}** (currently ${c.status}):\n${advice}`;
    }
    return handlers['data.stats.workload']({ user });
  },

  /* ---------- listing and counting ---------- */

  async 'data.complaint.list'({ user, entities }) {
    const { query, applied } = filtersFrom(entities, scopeFor(user));
    const [complaints, total] = await Promise.all([
      Complaint.find(query).sort({ createdAt: -1 }).limit(8),
      Complaint.countDocuments(query),
    ]);
    if (!total) return emptyPhrase(user, applied.join(' '));

    const noun = qualifiedNoun(entities);
    const heading = noun
      ? countSentence(user, total, noun)
      : `${countSentence(user, total)}${describeFilters(applied)}`;
    return `${heading}:\n${listOf(complaints, user)}${moreNote(total, complaints.length)}`;
  },

  async 'data.complaint.count'({ user, entities }) {
    const { query, applied } = filtersFrom(entities, scopeFor(user));
    const total = await Complaint.countDocuments(query);
    if (!total) return emptyPhrase(user, applied.join(' '));

    // With a filter the number itself is the answer; without one, break it down.
    if (applied.length) {
      const noun = qualifiedNoun(entities);
      return noun
        ? `${countSentence(user, total, noun)}.`
        : `${countSentence(user, total)}${describeFilters(applied)}.`;
    }
    const grouped = await Complaint.aggregate([
      { $match: scopeFor(user) },
      { $group: { _id: '$status', count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);
    const breakdown = grouped.map((g) => `${g.count} ${g._id}`).join(', ');
    return `${countSentence(user, total)} — ${breakdown}.`;
  },

  async 'data.complaint.pending'({ user, entities }) {
    const { query, applied } = filtersFrom(entities, scopeFor(user));
    if (!query.status) query.status = { $in: OPEN_STATUSES };
    const [complaints, total] = await Promise.all([
      Complaint.find(query).sort({ createdAt: 1 }).limit(8),
      Complaint.countDocuments(query),
    ]);
    if (!total) {
      return isStudent(user)
        ? 'Good news — nothing of yours is pending. Everything has been closed.'
        : `Nothing is pending${describeFilters(applied)} — everything is closed.`;
    }
    return `${plural(total, 'complaint')} ${total === 1 ? 'is' : 'are'} still open${describeFilters(applied)}, oldest first:\n${listOf(complaints, user)}${moreNote(total, complaints.length)}`;
  },

  async 'data.complaint.resolved'({ user, entities }) {
    const { query, applied } = filtersFrom(entities, scopeFor(user));
    query.status = 'Resolved';
    const [complaints, total] = await Promise.all([
      Complaint.find(query).sort({ resolvedAt: -1 }).limit(8),
      Complaint.countDocuments(query),
    ]);
    if (!total) return emptyPhrase(user, 'resolved');
    return `${countSentence(user, total)} resolved${describeFilters(applied.filter((a) => a !== 'resolved'))}:\n${listOf(complaints, user)}${moreNote(total, complaints.length)}`;
  },

  async 'data.complaint.rejected'({ user }) {
    const query = { ...scopeFor(user), status: 'Rejected' };
    const [complaints, total] = await Promise.all([
      Complaint.find(query).sort({ createdAt: -1 }).limit(5),
      Complaint.countDocuments(query),
    ]);
    if (!total) {
      return isStudent(user)
        ? 'None of your complaints have been rejected.'
        : 'There are no rejected complaints in your view.';
    }
    const detail = complaints.map((c) =>
      `• **${c.complaintId}** — ${c.title}\n   Reason: ${c.rejectionReason || 'no reason recorded'}`).join('\n');
    return `${countSentence(user, total)} rejected:\n${detail}${moreNote(total, complaints.length)}`;
  },

  async 'data.complaint.latest'({ user }) {
    const c = await Complaint.findOne(scopeFor(user)).sort({ createdAt: -1 });
    if (!c) return emptyPhrase(user);
    return `The most recent is:\n${describe(c, user)}`;
  },

  async 'data.complaint.oldest'({ user }) {
    const c = await Complaint.findOne({ ...scopeFor(user), status: { $in: OPEN_STATUSES } }).sort({ createdAt: 1 });
    if (!c) {
      const any = await Complaint.findOne(scopeFor(user)).sort({ createdAt: 1 });
      if (!any) return emptyPhrase(user);
      return `Nothing is still open. The oldest overall was:\n${describe(any, user)}`;
    }
    return `The longest-waiting open complaint is:\n${describe(c, user)}`;
  },

  async 'data.complaint.urgent'({ user }) {
    const query = { ...scopeFor(user), status: { $in: OPEN_STATUSES }, priority: { $in: ['Urgent', 'High'] } };
    const complaints = await Complaint.find(query).sort({ priority: 1, createdAt: 1 }).limit(6);
    if (!complaints.length) {
      return isStudent(user)
        ? 'None of your open complaints are marked high or urgent priority.'
        : 'Nothing open is marked high or urgent priority right now.';
    }
    const urgent = complaints.filter((c) => c.priority === 'Urgent');
    const rest = complaints.filter((c) => c.priority !== 'Urgent');
    const sections = [];
    if (urgent.length) sections.push(`**Urgent (${urgent.length})**\n${listOf(urgent, user)}`);
    if (rest.length) sections.push(`**High priority (${rest.length})**\n${listOf(rest, user)}`);
    return sections.join('\n\n');
  },

  /* ---------- history and breakdowns ---------- */

  async 'data.complaint.timeline'({ target, user }) {
    if (!target?.complaint) {
      if (target?.notFound) return notFoundMessage(target, user);
      const latest = await Complaint.findOne(scopeFor(user)).sort({ createdAt: -1 });
      if (!latest) return emptyPhrase(user);
      return `I was not sure which one you meant, so here is the history of your most recent complaint:\n\n${timelineOf(latest)}`;
    }
    return timelineOf(target.complaint);
  },

  async 'data.complaint.breakdown'({ user }) {
    const scope = scopeFor(user);
    const total = await Complaint.countDocuments(scope);
    if (!total) return emptyPhrase(user);

    const rows = await Complaint.aggregate([
      { $match: scope },
      { $group: {
        _id: '$category',
        count: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
      } },
      { $sort: { count: -1 } },
    ]);

    const lines = rows.map((r) => {
      const share = Math.round((r.count / total) * 100);
      return `• **${r._id}** — ${plural(r.count, 'complaint')} (${share}%), ${r.resolved} resolved`;
    }).join('\n');

    const top = rows[0];
    const lead = isStudent(user)
      ? `Across your ${plural(total, 'complaint')}, **${top._id}** comes up most often.`
      : `Across ${plural(total, 'complaint')}, **${top._id}** is the largest category.`;
    return `${lead}\n${lines}`;
  },

  async 'data.complaint.feedback'({ user }) {
    if (!isStudent(user)) {
      // For staff this reads as "what feedback have we received?"
      const rated = await Complaint.find({ ...scopeFor(user), 'feedback.rating': { $exists: true } })
        .sort({ 'feedback.submittedAt': -1 }).limit(6);
      if (!rated.length) return 'No students have left feedback on your complaints yet.';
      const avg = (rated.reduce((s, c) => s + c.feedback.rating, 0) / rated.length).toFixed(1);
      const lines = rated.map((c) =>
        `• **${c.complaintId}** — ${c.feedback.rating}/5 ${c.feedback.satisfaction}${c.feedback.comment ? ` — "${c.feedback.comment}"` : ''}`).join('\n');
      return `Most recent feedback (averaging ${avg}/5):\n${lines}`;
    }

    const closed = await Complaint.find({ student: user._id, status: { $in: ['Resolved', 'Rejected'] } }).sort({ resolvedAt: -1 });
    const awaiting = closed.filter((c) => !c.feedback?.rating);
    const done = closed.filter((c) => c.feedback?.rating);

    if (!closed.length) {
      return 'None of your complaints are closed yet, so there is nothing to rate. Feedback opens once a complaint is Resolved or Rejected.';
    }
    if (!awaiting.length) {
      const avg = (done.reduce((s, c) => s + c.feedback.rating, 0) / done.length).toFixed(1);
      return `You have rated all ${plural(done.length, 'closed complaint')} — an average of ${avg}/5. Nothing is waiting for your feedback.`;
    }

    const lines = awaiting.slice(0, 6).map((c) => `• **${c.complaintId}** — ${c.title} · ${c.status}`).join('\n');
    const doneNote = done.length ? ` You have already rated ${done.length}.` : '';
    return `${plural(awaiting.length, 'complaint')} ${awaiting.length === 1 ? 'is' : 'are'} waiting for your rating.${doneNote}\n${lines}\nOpen one from your dashboard to leave a rating out of 5.`;
  },

  /* ---------- notifications ---------- */

  async 'data.notifications'({ user }) {
    if (!isStudent(user)) {
      return 'Notifications are sent to students when their complaint status changes. As staff you can see all activity directly on your dashboard — ask me "what should I work on next" for a summary.';
    }
    const notifications = await Notification.find({ user: user._id }).sort({ createdAt: -1 }).limit(5);
    if (!notifications.length) return 'You have no notifications right now.';
    const unread = notifications.filter((n) => !n.read).length;
    const lines = notifications.map((n) => `• **${n.title}** — ${n.message}`).join('\n');
    return `You have ${plural(notifications.length, 'recent notification')}${unread ? ` (${unread} unread)` : ''}:\n${lines}`;
  },

  /* ---------- analytics ---------- */

  async 'data.stats.departments'({ user }) {
    if (isStudent(user)) {
      return 'Department statistics are only available to staff. I can tell you about your own complaints though — try "show my complaints".';
    }
    const rows = await Complaint.aggregate([
      { $match: scopeFor(user) },
      { $group: {
        _id: '$department',
        total: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
        rating: { $avg: '$feedback.rating' },
      } },
      { $sort: { total: -1 } },
    ]);
    if (!rows.length) return 'There is no department data to report yet.';
    const lines = rows.slice(0, 8).map((r) => {
      const rate = r.total ? Math.round((r.resolved / r.total) * 100) : 0;
      const stars = r.rating ? `${r.rating.toFixed(1)}/5` : 'no ratings';
      return `• **${r._id}** — ${r.total} total, ${rate}% resolved, ${stars}`;
    }).join('\n');
    return `Department breakdown:\n${lines}`;
  },

  async 'data.stats.coordinators'({ user }) {
    // A coordinator asking this means "how am I doing?"
    if (isCoordinator(user)) {
      const mine = await Complaint.find({ assignedCoordinator: user._id });
      if (!mine.length) return 'You have no complaints assigned to you yet, so there is nothing to report.';
      const resolved = mine.filter((c) => c.status === 'Resolved');
      const rated = mine.filter((c) => c.feedback?.rating);
      const avg = rated.length ? (rated.reduce((s, c) => s + c.feedback.rating, 0) / rated.length).toFixed(1) : null;
      const avgDays = resolved.length
        ? (resolved.reduce((s, c) => s + daysOpen(c), 0) / resolved.length).toFixed(1) : null;
      const bits = [
        `You have ${plural(mine.length, 'complaint')} assigned, ${resolved.length} resolved.`,
        avg ? `Your average student rating is **${avg}/5** from ${plural(rated.length, 'review')}.` : 'You have not received any ratings yet.',
      ];
      if (avgDays) bits.push(`Average resolution time: ${avgDays} days.`);
      const open = mine.filter((c) => OPEN_STATUSES.includes(c.status)).length;
      if (open) bits.push(`${plural(open, 'complaint')} still open.`);
      return bits.join('\n');
    }

    if (isStudent(user)) {
      return 'Coordinator statistics are only available to staff. Ask me "who is handling my complaint" if you want to know who has yours.';
    }

    const rows = await Complaint.aggregate([
      { $match: { assignedCoordinatorName: { $ne: '' } } },
      { $group: {
        _id: '$assignedCoordinatorName',
        total: { $sum: 1 },
        resolved: { $sum: { $cond: [{ $eq: ['$status', 'Resolved'] }, 1, 0] } },
        rating: { $avg: '$feedback.rating' },
      } },
      { $sort: { rating: -1, total: -1 } },
    ]);
    if (!rows.length) return 'No complaints have been assigned to coordinators yet.';
    const lines = rows.slice(0, 8).map((r) => {
      const stars = r.rating ? `${r.rating.toFixed(1)}/5` : 'no ratings';
      return `• **${r._id}** — ${r.total} assigned, ${r.resolved} resolved, ${stars}`;
    }).join('\n');
    return `Coordinator performance:\n${lines}`;
  },

  async 'data.stats.performance'({ user }) {
    const scope = scopeFor(user);
    const all = await Complaint.find(scope);
    if (!all.length) return emptyPhrase(user);

    const resolved = all.filter((c) => c.resolvedAt);
    const rated = all.filter((c) => c.feedback?.rating);
    const open = all.filter((c) => OPEN_STATUSES.includes(c.status));
    const avgRating = rated.length ? (rated.reduce((s, c) => s + c.feedback.rating, 0) / rated.length).toFixed(1) : null;
    const avgDays = resolved.length ? (resolved.reduce((s, c) => s + daysOpen(c), 0) / resolved.length).toFixed(1) : null;
    const rate = Math.round((resolved.length / all.length) * 100);

    const lines = [
      `${countSentence(user, all.length)} in total.`,
      `${resolved.length} resolved (${rate}%), ${open.length} still open.`,
    ];
    if (avgDays) lines.push(`Average resolution time: **${avgDays} days**.`);
    if (avgRating) lines.push(`Average satisfaction: **${avgRating}/5** from ${plural(rated.length, 'rating')}.`);
    else lines.push('No feedback ratings have been submitted yet.');

    if (isAdmin(user)) {
      const reopen = all.filter((c) => c.reopenRequest?.status === 'Pending').length;
      if (reopen) lines.push(`${plural(reopen, 'reopen request')} awaiting your review.`);
    }
    return lines.join('\n');
  },

  async 'data.stats.unassigned'({ user }) {
    if (isStudent(user)) {
      return 'That view is only available to staff. Try "show my pending complaints" to see what of yours is still open.';
    }
    if (isCoordinator(user)) {
      const waiting = await Complaint.find({ assignedCoordinator: user._id, status: 'Assigned' }).sort({ createdAt: 1 }).limit(6);
      if (!waiting.length) return 'You have nothing waiting to be started — everything assigned to you is already in progress or closed.';
      return `${plural(waiting.length, 'complaint')} assigned to you ${waiting.length === 1 ? 'has' : 'have'} not been started yet:\n${listOf(waiting, user)}`;
    }
    const query = { status: { $in: ['Submitted', 'Under Review'] } };
    const [pending, total] = await Promise.all([
      Complaint.find(query).sort({ createdAt: 1 }).limit(8),
      Complaint.countDocuments(query),
    ]);
    if (!total) return 'Nothing is waiting for review — every complaint has been actioned.';
    const reopen = await Complaint.countDocuments({ 'reopenRequest.status': 'Pending' });
    const extra = reopen ? `\nAlso, ${plural(reopen, 'reopen request')} awaiting your decision.` : '';
    return `**${plural(total, 'complaint')}** waiting for admin action, oldest first:\n${listOf(pending, user)}${moreNote(total, pending.length)}${extra}`;
  },

  async 'data.stats.workload'({ user }) {
    if (isStudent(user)) {
      const open = await Complaint.find({ student: user._id, status: { $in: OPEN_STATUSES } }).sort({ createdAt: 1 }).limit(5);
      if (!open.length) return 'You have nothing outstanding — all of your complaints are closed.';
      return `You have ${plural(open.length, 'complaint')} still open:\n${listOf(open, user)}\nNothing is needed from you while they are being processed.`;
    }

    const scope = scopeFor(user);
    const urgent = await Complaint.find({ ...scope, status: { $in: OPEN_STATUSES }, priority: { $in: ['Urgent', 'High'] } })
      .sort({ createdAt: 1 }).limit(3);
    const oldest = await Complaint.find({ ...scope, status: { $in: OPEN_STATUSES } }).sort({ createdAt: 1 }).limit(3);
    const reopen = await Complaint.find({ ...scope, 'reopenRequest.status': 'Pending' }).limit(3);

    const sections = [];
    if (reopen.length) sections.push(`**Reopen requests needing a decision (${reopen.length})**\n${listOf(reopen, user)}`);
    if (urgent.length) sections.push(`**High and urgent priority (${urgent.length})**\n${listOf(urgent, user)}`);
    if (oldest.length) sections.push(`**Waiting longest (${oldest.length})**\n${listOf(oldest, user)}`);

    if (!sections.length) return 'Your queue is clear — nothing is waiting on you right now.';
    return `Here is what I would prioritise:\n\n${sections.join('\n\n')}`;
  },
};

/**
 * Shared implementation for "what is the status" / "is it resolved" /
 * "what about my X complaint". These are the same question with
 * different framing, so they share one code path.
 */
async function statusLike({ text, entities, user, ctx, target }, { yesNo, requireTarget = false }) {
  // A filter-style question ("are my hostel complaints resolved?") with no
  // single target is better answered as a filtered summary.
  if (!target?.complaint) {
    if (target?.notFound) {
      return target.existsElsewhere
        ? `I could not find **${target.requestedId}** among ${ownerPhrase(user)}. It may belong to another student or another coordinator.`
        : `I could not find a complaint with the ID **${target.requestedId}**. Please double-check the number.`;
    }
    if (requireTarget) {
      const total = await Complaint.countDocuments(scopeFor(user));
      if (!total) return emptyPhrase(user);
      return `I could not work out which complaint you meant. You can give me the ID (for example "status of CMP-1042"), or ask me to "show my complaints" and I will list them.`;
    }

    /*
     * In a yes/no question the status word is the thing being ASKED
     * ("is my complaint resolved?"), not a filter. Using it as a filter
     * would make the answer circular — filtering to resolved complaints
     * and then reporting they are all resolved. Other entities such as
     * category still narrow the set correctly.
     */
    const forSummary = { ...entities };
    if (yesNo) delete forSummary.status;

    return summariseMany({ user, entities: forSummary, yesNo });
  }

  const c = target.complaint;
  remember(user._id, { lastComplaintId: c.complaintId });

  const prefix = target.ambiguous
    ? `I think you mean **${c.complaintId}**. If not, give me the ID and I will check that one instead.\n\n`
    : '';

  if (!yesNo) return prefix + describe(c, user);

  // Direct yes/no, then the supporting detail.
  const verdict = c.status === 'Resolved'
    ? `**Yes** — ${c.complaintId} has been resolved.`
    : c.status === 'Rejected'
      ? `**No** — ${c.complaintId} was rejected rather than resolved.`
      : `**Not yet** — ${c.complaintId} is currently **${c.status}**.`;

  return `${prefix}${verdict}\n${describe(c, user, { includeNext: false })}\n${statusHint(c, user)}`;
}

/** Fallback for status questions that are about a set rather than one complaint. */
async function summariseMany({ user, entities, yesNo }) {
  const { query, applied } = filtersFrom(entities, scopeFor(user));
  const total = await Complaint.countDocuments(query);
  if (!total) return emptyPhrase(user, applied.join(' '));

  const complaints = await Complaint.find(query).sort({ createdAt: -1 }).limit(5);

  if (yesNo) {
    const resolved = await Complaint.countDocuments({ ...query, status: 'Resolved' });
    const closed = await Complaint.countDocuments({ ...query, status: { $in: ['Resolved', 'Rejected'] } });
    const open = total - closed;
    const scopeWord = applied.length ? `${applied.join(', ')} ` : '';

    let verdict;
    if (open === 0) {
      verdict = `**Yes** — all ${plural(total, `${scopeWord}complaint`)} of yours are closed (${resolved} resolved).`;
    } else if (resolved === 0) {
      verdict = `**Not yet** — none of your ${plural(total, `${scopeWord}complaint`)} have been resolved.`;
    } else {
      verdict = `**Partly** — ${resolved} of ${total} resolved, ${plural(open, 'complaint')} still open.`;
    }

    // Lead with what is still open, since that is what the asker cares about.
    const focus = open > 0
      ? await Complaint.find({ ...query, status: { $nin: ['Resolved', 'Rejected'] } }).sort({ createdAt: -1 }).limit(5)
      : complaints;
    const heading = open > 0 ? '\nStill open:' : '';
    return `${verdict}${heading}\n${listOf(focus, user, 5)}`;
  }

  return `${countSentence(user, total)}${describeFilters(applied)}. Here are the most recent:\n${listOf(complaints, user, 5)}${moreNote(total, complaints.length)}`;
}

/* ============================================================
   Entry point
   ============================================================ */

/** Intents that are about one specific complaint. */
const TARGETED = new Set([
  'data.complaint.status', 'data.complaint.check', 'data.complaint.about',
  'data.complaint.handler', 'data.complaint.duration', 'data.complaint.next',
  'data.complaint.timeline',
]);

/**
 * Runs the handler for `intent` and returns a reply string,
 * or null when the intent has no data handler.
 */
async function answerFromData(intent, { text, result, user }) {
  const handler = handlers[intent];
  if (!handler) return null;

  const entities = collectEntities(result);
  const ctx = recall(user._id);

  let target = null;
  if (TARGETED.has(intent)) {
    target = await resolveTarget(text, entities, user, ctx);
  }

  let reply = await handler({ text, entities, user, ctx, target });

  /*
   * Safety net. A data intent was recognised confidently, so replying
   * "I did not understand" would be wrong — the bot understood perfectly,
   * it just could not narrow the question down. Fall back to a useful
   * overview instead of letting the caller treat this as unanswered.
   */
  if (!reply) {
    reply = await handlers['data.complaint.list']({ text, entities: {}, user, ctx, target: null });
    if (reply) {
      reply = `I could not narrow that down to one complaint, so here is where everything stands:\n${reply}`;
    }
  }

  // Remember any filters so follow-ups feel connected.
  if (entities.category || entities.status) {
    remember(user._id, { lastCategory: entities.category, lastStatus: entities.status });
  }
  return reply;
}

module.exports = { answerFromData, scopeFor, ownerPhrase, handlers };
