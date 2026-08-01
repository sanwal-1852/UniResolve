/**
 * ============================================================
 * UniBot — chat widget
 * ------------------------------------------------------------
 * Injects a floating chat button + panel into any logged-in page
 * and talks to /api/chatbot, which classifies the question with
 * NLP.js on the server (no LLM, no external API).
 *
 * Features:
 *   • conversation survives page navigation (sessionStorage)
 *   • complaint IDs in replies are clickable and open the
 *     complaint detail modal on pages that have one
 *   • "did you mean…?" chips when the bot is unsure
 *   • typing indicator, quick replies, timestamps
 *
 * Depends on helpers from main.js: apiFetch, escapeHtml,
 * getStoredUser, getToken, openDetailModal.
 * ============================================================ */

(function () {
  'use strict';

  const HISTORY_KEY = 'usp_chat_history';
  const OPEN_KEY = 'usp_chat_open';
  const MAX_HISTORY = 40;

  let opened = false;
  let booted = false;
  let sending = false;

  /* ---------- History persistence ---------- */

  function loadHistory() {
    try {
      return JSON.parse(sessionStorage.getItem(HISTORY_KEY)) || [];
    } catch {
      return [];
    }
  }

  function saveHistory(history) {
    try {
      sessionStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(-MAX_HISTORY)));
    } catch {
      /* storage full or unavailable — the chat still works, it just won't persist */
    }
  }

  function pushHistory(entry) {
    const history = loadHistory();
    history.push(entry);
    saveHistory(history);
  }

  function clearHistory() {
    sessionStorage.removeItem(HISTORY_KEY);
  }

  /* ---------- Markup ---------- */

  function buildWidget() {
    const wrap = document.createElement('div');
    wrap.innerHTML = `
      <button class="chat-fab" id="chatFab" type="button"
              aria-label="Open UniBot assistant" aria-expanded="false" aria-controls="chatPanel">
        <i class="bi bi-chat-dots-fill"></i>
      </button>

      <section class="chat-panel" id="chatPanel" role="dialog" aria-label="UniBot assistant" aria-hidden="true">
        <header class="chat-header">
          <div class="chat-avatar"><i class="bi bi-robot"></i></div>
          <div>
            <div class="chat-title">UniBot</div>
            <div class="chat-status">Complaint Assistant</div>
          </div>
          <button class="chat-reset" id="chatReset" type="button" title="Start a new conversation" aria-label="Clear conversation">
            <i class="bi bi-arrow-clockwise"></i>
          </button>
          <button class="chat-close" id="chatClose" type="button" aria-label="Close chat">
            <i class="bi bi-x-lg"></i>
          </button>
        </header>

        <div class="chat-body" id="chatBody" role="log" aria-live="polite" aria-atomic="false"></div>

        <div class="chat-suggestions" id="chatSuggestions"></div>

        <form class="chat-input-bar" id="chatForm" autocomplete="off">
          <input class="chat-input" id="chatInput" type="text"
                 placeholder="Ask about your complaints…" maxlength="500" aria-label="Your message">
          <button class="chat-send" id="chatSend" type="submit" aria-label="Send message">
            <i class="bi bi-send-fill"></i>
          </button>
        </form>
      </section>
    `;
    document.body.appendChild(wrap);
  }

  /* ---------- Rendering ---------- */

  /**
   * Renders the bot's lightweight markdown: **bold**, bullet lines, and
   * complaint IDs as clickable chips. Text is escaped first, so bot output
   * can never inject HTML.
   */
  function renderText(text) {
    return escapeHtml(text)
      .split('\n')
      .map((raw) => {
        const html = raw
          .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
          .replace(/\b(CMP-\d+)\b/g, '<button type="button" class="chat-ref chat-ref-link" data-complaint="$1">$1</button>');
        return `<span class="chat-line">${html}</span>`;
      })
      .join('');
  }

  function timeLabel(iso) {
    const d = iso ? new Date(iso) : new Date();
    return d.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  }

  function appendMessage(text, from, at) {
    const body = document.getElementById('chatBody');
    const msg = document.createElement('div');
    msg.className = `chat-msg from-${from}`;
    msg.innerHTML = `
      <div>
        <div class="chat-bubble">${renderText(text)}</div>
        <div class="chat-time">${timeLabel(at)}</div>
      </div>`;
    body.appendChild(msg);
    body.scrollTop = body.scrollHeight;
    return msg;
  }

  function addMessage(text, from) {
    const at = new Date().toISOString();
    pushHistory({ text, from, at });
    return appendMessage(text, from, at);
  }

  function showTyping() {
    const body = document.getElementById('chatBody');
    const el = document.createElement('div');
    el.className = 'chat-msg from-bot';
    el.id = 'chatTyping';
    el.innerHTML = '<div class="chat-bubble chat-typing"><span></span><span></span><span></span></div>';
    body.appendChild(el);
    body.scrollTop = body.scrollHeight;
  }

  function hideTyping() {
    document.getElementById('chatTyping')?.remove();
  }

  function renderSuggestions(list) {
    const box = document.getElementById('chatSuggestions');
    if (!box) return;
    const chips = list || [];
    box.classList.toggle('d-none', chips.length === 0);
    box.innerHTML = chips.map((s) => `<button type="button" class="chat-chip">${escapeHtml(s)}</button>`).join('');
    box.querySelectorAll('.chat-chip').forEach((chip) => {
      chip.addEventListener('click', () => send(chip.textContent));
    });
  }

  /* ---------- Behaviour ---------- */

  async function boot() {
    if (booted) return;
    booted = true;

    const history = loadHistory();
    if (history.length) {
      // Replay the existing conversation without re-saving it.
      history.forEach((m) => appendMessage(m.text, m.from, m.at));
      try {
        const data = await apiFetch('/api/chatbot/greeting');
        renderSuggestions(data.suggestions);
      } catch { /* keep the replayed conversation even if this fails */ }
      return;
    }

    try {
      const data = await apiFetch('/api/chatbot/greeting');
      addMessage(data.greeting, 'bot');
      renderSuggestions(data.suggestions);
    } catch {
      appendMessage('I could not connect right now. Please refresh the page and try again.', 'bot');
    }
  }

  async function send(text) {
    const message = String(text || '').trim();
    if (!message || sending) return;

    const input = document.getElementById('chatInput');
    const sendBtn = document.getElementById('chatSend');
    input.value = '';
    sending = true;
    sendBtn.disabled = true;

    addMessage(message, 'user');
    showTyping();

    try {
      // Small floor on the delay so the typing indicator is perceptible.
      const [data] = await Promise.all([
        apiFetch('/api/chatbot/message', {
          method: 'POST',
          body: JSON.stringify({ message }),
        }),
        new Promise((r) => setTimeout(r, 380)),
      ]);
      hideTyping();
      addMessage(data.reply, 'bot');

      // When the bot was unsure it returns follow-up questions to offer.
      if (Array.isArray(data.suggestions) && data.suggestions.length) {
        renderSuggestions(data.suggestions);
      }
    } catch (err) {
      hideTyping();
      addMessage(err.message || 'Something went wrong. Please try again.', 'bot');
    } finally {
      sending = false;
      sendBtn.disabled = false;
      input.focus();
    }
  }

  /** Clicking a complaint ID opens its detail modal where one exists. */
  function handleRefClick(e) {
    const btn = e.target.closest('.chat-ref-link');
    if (!btn) return;
    const id = btn.dataset.complaint;
    if (!id) return;

    if (typeof openDetailModal === 'function' && document.getElementById('detailModal')) {
      openDetailModal(id);
    } else {
      // Pages without a detail modal (e.g. Submit Complaint) send the user
      // to the dashboard, where the modal exists.
      const user = getStoredUser();
      const page = user?.role === 'admin' ? 'admin-dashboard.html'
        : user?.role === 'coordinator' ? 'coordinator-dashboard.html'
          : 'view-complaints.html';
      window.location.href = page;
    }
  }

  function toggle(open) {
    const panel = document.getElementById('chatPanel');
    const fab = document.getElementById('chatFab');
    opened = open === undefined ? !opened : open;

    panel.classList.toggle('open', opened);
    panel.setAttribute('aria-hidden', String(!opened));
    fab.classList.toggle('open', opened);
    fab.setAttribute('aria-expanded', String(opened));
    fab.innerHTML = opened ? '<i class="bi bi-x-lg"></i>' : '<i class="bi bi-chat-dots-fill"></i>';

    try { sessionStorage.setItem(OPEN_KEY, opened ? '1' : '0'); } catch { /* ignore */ }

    if (opened) {
      boot();
      setTimeout(() => document.getElementById('chatInput')?.focus(), 260);
    }
  }

  function resetConversation() {
    clearHistory();
    booted = false;
    document.getElementById('chatBody').innerHTML = '';
    boot();
  }

  /* ---------- Init ---------- */

  function init() {
    // Only for signed-in users — the bot answers from their own records.
    if (typeof getStoredUser !== 'function' || !getStoredUser() || !getToken()) return;

    buildWidget();

    document.getElementById('chatFab').addEventListener('click', () => toggle());
    document.getElementById('chatClose').addEventListener('click', () => toggle(false));
    document.getElementById('chatReset').addEventListener('click', resetConversation);
    document.getElementById('chatBody').addEventListener('click', handleRefClick);

    document.getElementById('chatForm').addEventListener('submit', (e) => {
      e.preventDefault();
      send(document.getElementById('chatInput').value);
    });

    document.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && opened) toggle(false);
    });

    // Reopen automatically if the user had the panel open before navigating.
    if (sessionStorage.getItem(OPEN_KEY) === '1') toggle(true);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
