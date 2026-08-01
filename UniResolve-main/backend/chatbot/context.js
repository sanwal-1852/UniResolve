/**
 * ============================================================
 * UniBot — short-term conversation memory
 * ------------------------------------------------------------
 * Remembers the last complaint each user was talking about, so a
 * follow-up like "is it resolved?" or "who is handling it?"
 * refers to the right record instead of starting from scratch.
 *
 * Deliberately in-memory and short lived: this is a helper for a
 * single sitting, not a stored conversation history. Entries
 * expire after 30 minutes and are swept periodically so the map
 * cannot grow without bound.
 * ============================================================
 */

const TTL_MS = 30 * 60 * 1000;      // 30 minutes
const SWEEP_MS = 10 * 60 * 1000;    // clean up every 10 minutes

const store = new Map();

function remember(userId, patch) {
  const key = String(userId);
  const current = store.get(key) || {};
  store.set(key, { ...current, ...patch, updatedAt: Date.now() });
}

function recall(userId) {
  const key = String(userId);
  const entry = store.get(key);
  if (!entry) return {};
  if (Date.now() - entry.updatedAt > TTL_MS) {
    store.delete(key);
    return {};
  }
  return entry;
}

function forget(userId) {
  store.delete(String(userId));
}

/** Drops expired entries. Runs on a timer that never keeps the process alive. */
const sweeper = setInterval(() => {
  const cutoff = Date.now() - TTL_MS;
  for (const [key, entry] of store) {
    if (entry.updatedAt < cutoff) store.delete(key);
  }
}, SWEEP_MS);

if (typeof sweeper.unref === 'function') sweeper.unref();

module.exports = { remember, recall, forget, _store: store };
