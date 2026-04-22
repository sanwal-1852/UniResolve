/**
 * ============================================================
 * UniResolve — Frontend Logic (main.js)
 * API-connected version — talks to the Node.js/Express backend
 * ============================================================
 */

/* ==============================================================
   CONFIG
   ============================================================== */
// In production the frontend is served from the same origin as the API,
// so an empty base URL works for relative paths. In development (e.g. using
// VS Code Live Server on port 5500), set this to the backend URL.
const API_BASE = window.location.port === '5000'
  ? ''                          // same-origin (production)
  : 'http://localhost:5000';    // separate dev server


/* ==============================================================
   AUTH HELPERS — token stored in localStorage
   ============================================================== */
function getToken() {
  return localStorage.getItem('uniresolve_token');
}

function setToken(token) {
  localStorage.setItem('uniresolve_token', token);
}

function removeToken() {
  localStorage.removeItem('uniresolve_token');
  localStorage.removeItem('uniresolve_user');
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('uniresolve_user'));
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem('uniresolve_user', JSON.stringify(user));
}

/**
 * Authenticated fetch wrapper
 */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const headers = {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  const res = await fetch(API_BASE + path, { ...options, headers });
  const data = await res.json();
  if (!res.ok) {
    throw Object.assign(new Error(data.message || 'Request failed'), { status: res.status });
  }
  return data;
}


/* ==============================================================
   UTILITY HELPERS
   ============================================================== */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', { year: 'numeric', month: 'short', day: 'numeric' });
}

function getStatusBadge(status) {
  const map = {
    'Pending':     'badge-pending',
    'In Progress': 'badge-in-progress',
    'Resolved':    'badge-resolved',
  };
  const cls = map[status] || 'badge-pending';
  return `<span class="badge-status ${cls}">${status}</span>`;
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function showAlert(containerId, message, type = 'danger') {
  const el = document.getElementById(containerId);
  if (!el) return;
  const icons = { danger: 'bi-exclamation-circle-fill', success: 'bi-check-circle-fill', warning: 'bi-exclamation-triangle-fill' };
  el.className = `alert alert-${type} alert-custom`;
  el.innerHTML = `<i class="bi ${icons[type] || icons.danger} me-2"></i>${escapeHtml(message)}`;
  el.classList.remove('d-none');
}

function hideAlert(containerId) {
  const el = document.getElementById(containerId);
  if (el) el.classList.add('d-none');
}

function showToast(message) {
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();
  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.style.cssText = `
    position:fixed;top:80px;right:20px;z-index:9999;
    background:var(--color-navy-900);color:#fff;
    padding:0.75rem 1.25rem;border-radius:var(--radius-md);
    font-family:var(--font-body);font-size:0.875rem;
    box-shadow:var(--shadow-lg);display:flex;align-items:center;
    gap:0.5rem;animation:toastSlideIn 0.3s ease;max-width:400px;`;
  toast.innerHTML = `<i class="bi bi-check-circle-fill" style="color:#4ade80;"></i>${escapeHtml(message)}`;
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes toastSlideIn{from{opacity:0;transform:translateX(20px)}to{opacity:1;transform:translateX(0)}}
      @keyframes toastSlideOut{from{opacity:1;transform:translateX(0)}to{opacity:0;transform:translateX(20px)}}`;
    document.head.appendChild(style);
  }
  document.body.appendChild(toast);
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}


/* ==============================================================
   NAVIGATION AUTH STATE
   ============================================================== */
function updateNavAuth() {
  const user = getStoredUser();
  const navLogin  = document.getElementById('nav-login');
  const navLogout = document.getElementById('nav-logout');
  if (user) {
    navLogin?.classList.add('d-none');
    navLogout?.classList.remove('d-none');
  } else {
    navLogin?.classList.remove('d-none');
    navLogout?.classList.add('d-none');
  }
}

function handleLogout(e) {
  e?.preventDefault();
  removeToken();
  showToast('Logged out successfully');
  setTimeout(() => window.location.href = 'index.html', 500);
}


/* ==============================================================
   HOME PAGE — load stats
   ============================================================== */
async function loadHomeStats() {
  const user = getStoredUser();
  if (!user) return; // Stats only meaningful when logged in

  try {
    const data = await apiFetch('/api/complaints/stats');
    const s = data.stats;
    const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
    set('stat-total',    s.total);
    set('stat-pending',  s.Pending);
    set('stat-progress', s['In Progress']);
    set('stat-resolved', s.Resolved);
  } catch (err) {
    console.error('Could not load stats:', err.message);
  }
}


/* ==============================================================
   LOGIN PAGE
   ============================================================== */
function initLoginPage() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  // Toggle password visibility
  document.getElementById('togglePassword')?.addEventListener('click', function () {
    const input = document.getElementById('loginPassword');
    const icon  = this.querySelector('i');
    if (input.type === 'password') {
      input.type = 'text';
      icon.className = 'bi bi-eye-slash';
    } else {
      input.type = 'password';
      icon.className = 'bi bi-eye';
    }
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const email    = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;
    const btn      = form.querySelector('button[type="submit"]');

    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Signing in…';
    hideAlert('login-alert');

    try {
      const data = await apiFetch('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({ email, password }),
      });
      setToken(data.token);
      setStoredUser(data.user);
      showToast(`Welcome back, ${data.user.name}!`);
      setTimeout(() => {
        window.location.href = data.user.role === 'admin' ? 'admin-dashboard.html' : 'view-complaints.html';
      }, 600);
    } catch (err) {
      showAlert('login-alert', err.message || 'Login failed — please check your credentials');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> Sign In';
    }
  });
}

async function adminDemoLogin(e) {
  e?.preventDefault();
  document.getElementById('loginEmail').value    = 'admin@university.edu';
  document.getElementById('loginPassword').value = 'admin123';
  document.getElementById('loginForm').dispatchEvent(new Event('submit'));
}


/* ==============================================================
   REGISTER PAGE
   ============================================================== */
function initRegisterPage() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', async function (e) {
    e.preventDefault();

    const name            = document.getElementById('regName').value.trim();
    const studentId       = document.getElementById('regStudentId').value.trim();
    const email           = document.getElementById('regEmail').value.trim();
    const password        = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    // Password match check
    const confirmInput = document.getElementById('regConfirmPassword');
    if (password !== confirmPassword) {
      confirmInput.setCustomValidity('Passwords do not match');
      form.classList.add('was-validated');
      return;
    } else {
      confirmInput.setCustomValidity('');
    }

    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Creating account…';
    hideAlert('register-alert');

    try {
      const data = await apiFetch('/api/auth/register', {
        method: 'POST',
        body: JSON.stringify({ name, email, password, studentId }),
      });
      setToken(data.token);
      setStoredUser(data.user);
      showToast('Account created! Welcome to UniResolve.');
      setTimeout(() => window.location.href = 'submit-complaint.html', 600);
    } catch (err) {
      showAlert('register-alert', err.message || 'Registration failed — please try again');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-person-plus me-1"></i> Create Account';
    }
  });
}


/* ==============================================================
   SUBMIT COMPLAINT FORM
   ============================================================== */
function initComplaintForm() {
  const form = document.getElementById('complaintForm');
  if (!form) return;

  // Redirect to login if not authenticated
  if (!getToken()) {
    showAlert('complaint-alert', 'Please log in to submit a complaint.', 'warning');
    setTimeout(() => window.location.href = 'login.html', 2000);
    return;
  }

  // Character counter
  const textarea  = document.getElementById('complaintDescription');
  const charCount = document.getElementById('charCount');
  textarea?.addEventListener('input', function () {
    if (charCount) charCount.textContent = `${this.value.length} / 20 min characters`;
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const title       = document.getElementById('complaintTitle').value.trim();
    const category    = document.getElementById('complaintCategory').value;
    const description = document.getElementById('complaintDescription').value.trim();

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Submitting…';
    hideAlert('complaint-alert');

    try {
      const data = await apiFetch('/api/complaints', {
        method: 'POST',
        body: JSON.stringify({ title, category, description }),
      });
      showAlert('complaint-alert', `Complaint submitted successfully! ID: ${data.complaint.complaintId}`, 'success');
      form.reset();
      form.classList.remove('was-validated');
      if (charCount) charCount.textContent = '0 / 20 min characters';
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send me-1"></i> Submit Complaint';
    } catch (err) {
      if (err.status === 401) {
        showAlert('complaint-alert', 'Session expired — please log in again.', 'warning');
        setTimeout(() => window.location.href = 'login.html', 2000);
      } else {
        showAlert('complaint-alert', err.message || 'Submission failed — please try again');
        btn.disabled = false;
        btn.innerHTML = '<i class="bi bi-send me-1"></i> Submit Complaint';
      }
    }
  });
}


/* ==============================================================
   VIEW MY COMPLAINTS (student)
   ============================================================== */
async function loadStudentComplaints() {
  if (!getToken()) {
    window.location.href = 'login.html';
    return;
  }

  const tbody      = document.getElementById('studentComplaintsBody');
  const emptyState = document.getElementById('studentEmptyState');
  if (!tbody) return;

  const statusFilter   = document.getElementById('studentFilterStatus')?.value   || 'All';
  const categoryFilter = document.getElementById('studentFilterCategory')?.value || 'All';

  tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-muted">
    <span class="spinner-border spinner-border-sm me-2"></span>Loading…</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (statusFilter   !== 'All') params.set('status',   statusFilter);
    if (categoryFilter !== 'All') params.set('category', categoryFilter);

    const data = await apiFetch(`/api/complaints?${params}`);
    const complaints = data.complaints;

    if (complaints.length === 0) {
      tbody.innerHTML = '';
      emptyState?.classList.remove('d-none');
      return;
    }
    emptyState?.classList.add('d-none');

    tbody.innerHTML = complaints.map((c, i) => `
      <tr>
        <td style="color:var(--color-text-muted);font-size:0.8125rem;">${i + 1}</td>
        <td>
          <div style="font-weight:500;">${escapeHtml(c.title)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-faint);margin-top:2px;">${c.complaintId}</div>
        </td>
        <td style="font-size:0.875rem;color:var(--color-text-muted);">${escapeHtml(c.category)}</td>
        <td>${getStatusBadge(c.status)}</td>
        <td style="font-size:0.8125rem;color:var(--color-text-muted);">${formatDate(c.createdAt)}</td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="5" class="text-center py-4 text-danger">
      <i class="bi bi-exclamation-circle me-1"></i>${escapeHtml(err.message)}</td></tr>`;
  }
}


/* ==============================================================
   ADMIN DASHBOARD
   ============================================================== */
async function loadAdminComplaints() {
  const user = getStoredUser();
  if (!user || user.role !== 'admin') {
    document.querySelector('.page-content')?.insertAdjacentHTML('afterbegin',
      '<div class="container pt-3"><div class="alert alert-danger">Access denied — admin only.</div></div>');
    return;
  }

  const tbody      = document.getElementById('adminComplaintsBody');
  const emptyState = document.getElementById('adminEmptyState');
  if (!tbody) return;

  const search         = document.getElementById('adminSearchInput')?.value     || '';
  const categoryFilter = document.getElementById('adminFilterCategory')?.value  || 'All';
  const statusFilter   = document.getElementById('adminFilterStatus')?.value    || 'All';

  tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-muted">
    <span class="spinner-border spinner-border-sm me-2"></span>Loading…</td></tr>`;

  try {
    const params = new URLSearchParams();
    if (search)                    params.set('search',   search);
    if (statusFilter   !== 'All')  params.set('status',   statusFilter);
    if (categoryFilter !== 'All')  params.set('category', categoryFilter);

    const data = await apiFetch(`/api/complaints?${params}`);
    const complaints = data.complaints;

    updateAdminQuickStats(complaints);

    if (complaints.length === 0) {
      tbody.innerHTML = '';
      emptyState?.classList.remove('d-none');
      return;
    }
    emptyState?.classList.add('d-none');

    tbody.innerHTML = complaints.map(c => `
      <tr>
        <td style="font-weight:500;font-size:0.8125rem;color:var(--color-text-muted);">${c.complaintId}</td>
        <td>
          <div style="font-weight:500;">${escapeHtml(c.title)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-faint);margin-top:2px;">${escapeHtml(c.category)}</div>
        </td>
        <td>
          <div style="font-weight:500;font-size:0.875rem;">${escapeHtml(c.studentName)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-faint);">${c.studentId}</div>
        </td>
        <td style="font-size:0.8125rem;color:var(--color-text-muted);">${escapeHtml(c.category)}</td>
        <td>${getStatusBadge(c.status)}</td>
        <td style="font-size:0.8125rem;color:var(--color-text-muted);">${formatDate(c.createdAt)}</td>
        <td style="text-align:center;">
          <div class="d-flex justify-content-center gap-1">
            <button class="btn btn-outline-custom btn-sm-custom" onclick="openDetailModal('${c.complaintId}')" title="View Details">
              <i class="bi bi-eye"></i>
            </button>
            <button class="btn btn-primary-custom btn-sm-custom" onclick="openStatusModal('${c.complaintId}')" title="Update Status">
              <i class="bi bi-pencil"></i>
            </button>
          </div>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">
      <i class="bi bi-exclamation-circle me-1"></i>${escapeHtml(err.message)}</td></tr>`;
  }
}

function updateAdminQuickStats(complaints) {
  const pending  = complaints.filter(c => c.status === 'Pending').length;
  const progress = complaints.filter(c => c.status === 'In Progress').length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;
  const set = (id, val) => { const el = document.getElementById(id); if (el) el.textContent = val; };
  set('adminStatPending',  `${pending} Pending`);
  set('adminStatProgress', `${progress} In Progress`);
  set('adminStatResolved', `${resolved} Resolved`);
}

// ─── Cached complaint for modals ─────────────────────────────────────────────
let _adminComplaintsCache = [];

async function _ensureCache() {
  if (_adminComplaintsCache.length === 0) {
    const data = await apiFetch('/api/complaints');
    _adminComplaintsCache = data.complaints;
  }
}

// Bust cache on any status update so next modal open is fresh
function _bustCache() { _adminComplaintsCache = []; }

async function openStatusModal(complaintId) {
  try {
    await _ensureCache();
    const complaint = _adminComplaintsCache.find(c => c.complaintId === complaintId);
    if (!complaint) return;

    document.getElementById('modalComplaintId').value      = complaint.complaintId;
    document.getElementById('modalComplaintTitle').textContent   = complaint.title;
    document.getElementById('modalComplaintStudent').textContent = `${complaint.studentName} (${complaint.studentId})`;
    document.getElementById('modalStatusSelect').value     = complaint.status;
    document.getElementById('modalAdminNotes').value       = complaint.adminNotes || '';

    new bootstrap.Modal(document.getElementById('statusModal')).show();
  } catch (err) {
    showToast('Could not load complaint details');
  }
}

async function openDetailModal(complaintId) {
  try {
    await _ensureCache();
    const c = _adminComplaintsCache.find(c => c.complaintId === complaintId);
    if (!c) return;

    document.getElementById('detailModalBody').innerHTML = `
      <div class="row g-3">
        <div class="col-sm-6">
          <div style="font-size:0.8125rem;color:var(--color-text-muted);">Complaint ID</div>
          <div style="font-weight:600;">${c.complaintId}</div>
        </div>
        <div class="col-sm-6">
          <div style="font-size:0.8125rem;color:var(--color-text-muted);">Submitted</div>
          <div style="font-weight:600;">${formatDate(c.createdAt)}</div>
        </div>
        <div class="col-sm-6">
          <div style="font-size:0.8125rem;color:var(--color-text-muted);">Student</div>
          <div style="font-weight:600;">${escapeHtml(c.studentName)}</div>
          <div style="font-size:0.8125rem;color:var(--color-text-faint);">${c.studentEmail} · ${c.studentId}</div>
        </div>
        <div class="col-sm-6">
          <div style="font-size:0.8125rem;color:var(--color-text-muted);">Category</div>
          <div style="font-weight:600;">${escapeHtml(c.category)}</div>
        </div>
        <div class="col-12">
          <div style="font-size:0.8125rem;color:var(--color-text-muted);">Status</div>
          <div class="mt-1">${getStatusBadge(c.status)}</div>
        </div>
        <div class="col-12">
          <div style="font-size:0.8125rem;color:var(--color-text-muted);">Title</div>
          <div style="font-weight:600;font-size:1.0625rem;">${escapeHtml(c.title)}</div>
        </div>
        <div class="col-12">
          <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:0.375rem;">Description</div>
          <div style="background:var(--color-surface-alt);border:1px solid var(--color-border);border-radius:var(--radius-md);padding:1rem;font-size:0.9375rem;line-height:1.7;">
            ${escapeHtml(c.description)}
          </div>
        </div>
        ${c.adminNotes ? `
        <div class="col-12">
          <div style="font-size:0.8125rem;color:var(--color-text-muted);margin-bottom:0.375rem;">Admin Notes</div>
          <div style="background:#eff6ff;border:1px solid #bfdbfe;border-radius:var(--radius-md);padding:1rem;font-size:0.875rem;">
            ${escapeHtml(c.adminNotes)}
          </div>
        </div>` : ''}
      </div>`;

    new bootstrap.Modal(document.getElementById('detailModal')).show();
  } catch (err) {
    showToast('Could not load complaint details');
  }
}

async function updateComplaintStatus() {
  const complaintId = document.getElementById('modalComplaintId').value;
  const newStatus   = document.getElementById('modalStatusSelect').value;
  const adminNotes  = document.getElementById('modalAdminNotes').value;

  const btn = document.querySelector('#statusModal .btn-primary-custom');
  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Updating…';

  try {
    await apiFetch(`/api/complaints/${complaintId}/status`, {
      method: 'PUT',
      body: JSON.stringify({ status: newStatus, adminNotes }),
    });

    bootstrap.Modal.getInstance(document.getElementById('statusModal')).hide();
    _bustCache();
    loadAdminComplaints();
    showToast(`Complaint ${complaintId} updated to "${newStatus}"`);
  } catch (err) {
    showToast(`Update failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Update Status';
  }
}
