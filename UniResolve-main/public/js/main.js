/**
 * ============================================================
 * University of Southern Punjab — Frontend Logic (main.js)
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
  return localStorage.getItem('usp_token');
}

function setToken(token) {
  localStorage.setItem('usp_token', token);
}

function removeToken() {
  localStorage.removeItem('usp_token');
  localStorage.removeItem('usp_user');
}

function getStoredUser() {
  try {
    return JSON.parse(localStorage.getItem('usp_user'));
  } catch {
    return null;
  }
}

function setStoredUser(user) {
  localStorage.setItem('usp_user', JSON.stringify(user));
}

function dashboardPath(role) {
  const paths = {
    admin: 'admin-dashboard.html',
    coordinator: 'coordinator-dashboard.html',
    student: 'user-dashboard.html',
  };
  return paths[role] || 'user-dashboard.html';
}

function redirectToDashboard(user = getStoredUser()) {
  window.location.href = dashboardPath(user?.role);
}

function requireRole(roles) {
  const allowed = Array.isArray(roles) ? roles : [roles];
  const user = getStoredUser();

  if (!getToken() || !user) {
    window.location.href = 'login.html';
    return null;
  }

  if (!allowed.includes(user.role)) {
    window.location.href = dashboardPath(user.role);
    return null;
  }

  return user;
}

/**
 * Authenticated fetch wrapper
 */
async function apiFetch(path, options = {}) {
  const token = getToken();
  const isFormData = options.body instanceof FormData;
  const headers = {
    ...(isFormData ? {} : { 'Content-Type': 'application/json' }),
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
    ...options.headers,
  };
  let res;
  try {
    res = await fetch(API_BASE + path, { ...options, headers });
  } catch {
    throw new Error('Could not connect to the local server. Please make sure it is running.');
  }

  const contentType = res.headers.get('content-type') || '';
  const rawText = await res.text();
  let data = {};
  if (rawText && contentType.includes('application/json')) {
    try {
      data = JSON.parse(rawText);
    } catch {
      data = { message: 'The server returned a broken response. Please restart the local server and try again.' };
    }
  } else if (rawText && !res.ok) {
    data = { message: 'The server returned an unexpected response. Please refresh and try again.' };
  }

  if (!res.ok) {
    if (res.status === 401) removeToken();
    throw Object.assign(new Error(data.message || 'Request failed. Please try again.'), { status: res.status });
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
    'Submitted': 'badge-pending',
    'Under Review': 'badge-in-progress',
    'Rejected': 'badge-rejected',
    'Assigned': 'badge-assigned',
    'In Progress': 'badge-in-progress',
    'Resolved': 'badge-resolved',
    'Reopen Requested': 'badge-reopen',
  };
  const cls = map[status] || 'badge-pending';
  return `<span class="badge-status ${cls}">${escapeHtml(status)}</span>`;
}

function getPriorityBadge(priority) {
  const value = priority || 'Medium';
  return `<span class="badge-priority priority-${value.toLowerCase()}">${escapeHtml(value)}</span>`;
}

/** Relative time such as "3 days ago", used in the chatbot and timelines. */
function timeAgo(dateStr) {
  const then = new Date(dateStr).getTime();
  if (!then) return '';
  const secs = Math.max(0, Math.floor((Date.now() - then) / 1000));
  const units = [['year', 31536000], ['month', 2592000], ['week', 604800], ['day', 86400], ['hour', 3600], ['minute', 60]];
  for (const [name, size] of units) {
    const n = Math.floor(secs / size);
    if (n >= 1) return `${n} ${name}${n === 1 ? '' : 's'} ago`;
  }
  return 'just now';
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text || '';
  return div.innerHTML;
}

function setSelectValueIfAvailable(select, value) {
  if (!select) return;
  const hasOption = Array.from(select.options).some((option) => option.value === value);
  select.value = hasOption ? value : '';
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

/**
 * Toast notification. Pass type 'error' for a red accent.
 */
function showToast(message, type = 'success') {
  document.getElementById('app-toast')?.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.className = `app-toast${type === 'error' ? ' toast-error' : ''}`;
  toast.setAttribute('role', 'status');
  toast.setAttribute('aria-live', 'polite');

  const icon = type === 'error' ? 'bi-exclamation-circle-fill' : 'bi-check-circle-fill';
  const color = type === 'error' ? '#f87171' : '#4ade80';
  toast.innerHTML = `<i class="bi ${icon}" style="color:${color};"></i><span>${escapeHtml(message)}</span>`;

  document.body.appendChild(toast);
  setTimeout(() => {
    toast.classList.add('toast-out');
    setTimeout(() => toast.remove(), 280);
  }, 3200);
}

/**
 * Shimmer placeholder rows shown while a table loads.
 */
function skeletonRows(columns, rows = 4) {
  const cell = (i) => {
    if (i === 1) return '<td><span class="skeleton skeleton-text-lg"></span><span class="skeleton skeleton-text-sm"></span></td>';
    if (i === columns - 2) return '<td><span class="skeleton skeleton-pill"></span></td>';
    return '<td><span class="skeleton" style="width:70%;"></span></td>';
  };
  return Array.from({ length: rows }, () =>
    `<tr class="skeleton-row">${Array.from({ length: columns }, (_, i) => cell(i)).join('')}</tr>`
  ).join('');
}

/**
 * Count-up animation for dashboard stat values.
 */
function animateCount(el, target) {
  if (!el) return;
  const end = Number(target) || 0;
  const start = Number(el.textContent) || 0;
  if (start === end) { el.textContent = end; return; }
  if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) { el.textContent = end; return; }

  const duration = 520;
  const t0 = performance.now();
  const step = (now) => {
    const p = Math.min(1, (now - t0) / duration);
    const eased = 1 - Math.pow(1 - p, 3);
    el.textContent = Math.round(start + (end - start) * eased);
    if (p < 1) requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

async function loadMetaOptions() {
  const data = await apiFetch('/api/complaints/meta');
  const categories = Array.isArray(data.categories) ? data.categories : [];
  const departments = Array.isArray(data.departments) ? data.departments : [];
  const coordinators = Array.isArray(data.coordinators) ? data.coordinators : [];
  const categorySelects = document.querySelectorAll('[data-category-select]');
  const departmentSelects = document.querySelectorAll('[data-department-select]');
  const coordinatorSelects = document.querySelectorAll('[data-coordinator-select]');

  categorySelects.forEach((select) => {
    const keepAll = select.dataset.keepAll === 'true';
    select.innerHTML = `${keepAll ? '<option value="All">All Categories</option>' : '<option value="" disabled selected>Choose a category...</option>'}${
      categories.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')
    }`;
  });

  departmentSelects.forEach((select) => {
    const keepAll = select.dataset.keepAll === 'true';
    select.innerHTML = `${keepAll ? '<option value="All">All Departments</option>' : '<option value="" disabled selected>Choose a department...</option>'}${
      departments.map((item) => `<option value="${escapeHtml(item.name)}">${escapeHtml(item.name)}</option>`).join('')
    }`;
  });

  coordinatorSelects.forEach((select) => {
    select.innerHTML = '<option value="" disabled selected>Select coordinator...</option>' + coordinators.map((item) =>
      `<option value="${item._id}">${escapeHtml(item.name)} - ${escapeHtml(item.department || 'General')}</option>`
    ).join('');
  });

  return data;
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
    if (user.role === 'student') refreshNotificationBadge();
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

function handleHomeClick(e) {
  const user = getStoredUser();
  if (!user || !getToken()) return;
  e?.preventDefault();
  redirectToDashboard(user);
}

function redirectLoggedInFromPublicPage() {
  const user = getStoredUser();
  if (user && getToken()) {
    redirectToDashboard(user);
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
      setTimeout(() => redirectToDashboard(data.user), 600);
    } catch (err) {
      showAlert('login-alert', err.message || 'Login failed — please check your credentials');
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-box-arrow-in-right me-1"></i> Sign In';
    }
  });
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
      showToast('Account created! Welcome to University of Southern Punjab.');
      setTimeout(() => redirectToDashboard(data.user), 600);
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

  if (!requireRole('student')) return;
  loadMetaOptions().catch((err) => {
    showAlert('complaint-alert', err.message);
    if (err.status === 401) {
      setTimeout(() => window.location.href = 'login.html', 900);
    }
  });

  // Character counter
  const textarea  = document.getElementById('complaintDescription');
  const charCount = document.getElementById('charCount');
  textarea?.addEventListener('input', function () {
    if (charCount) charCount.textContent = `${this.value.length} / 20 min characters`;
  });

  form.addEventListener('submit', async function (e) {
    e.preventDefault();
    if (!form.checkValidity()) { form.classList.add('was-validated'); return; }

    const title = document.getElementById('complaintTitle').value.trim();
    const category = document.getElementById('complaintCategory').value;
    const department = document.getElementById('complaintDepartment').value;
    const description = document.getElementById('complaintDescription').value.trim();
    const attachments = document.getElementById('complaintAttachments')?.files || [];
    const isAnonymous = document.getElementById('complaintAnonymous')?.checked || false;
    const body = new FormData();
    body.append('title', title);
    body.append('category', category);
    body.append('department', department);
    body.append('description', description);
    body.append('isAnonymous', String(isAnonymous));
    Array.from(attachments).forEach((file) => body.append('attachments', file));

    const btn = form.querySelector('button[type="submit"]');
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Submitting…';
    hideAlert('complaint-alert');

    try {
      const data = await apiFetch('/api/complaints', {
        method: 'POST',
        body,
      });
      showAlert('complaint-alert', `Complaint submitted successfully! ID: ${data.complaint.complaintId}`, 'success');
      form.reset();
      form.classList.remove('was-validated');
      if (charCount) charCount.textContent = '0 / 20 min characters';
      btn.disabled = false;
      btn.innerHTML = '<i class="bi bi-send me-1"></i> Submit Complaint';
      setTimeout(() => window.location.href = 'user-dashboard.html', 900);
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
let _studentCurrentPage = 1;
const STUDENT_PAGE_SIZE = 5;
let _studentNotificationsCache = [];
let _notificationCurrentPage = 1;
const NOTIFICATION_PAGE_SIZE = 5;

async function loadStudentComplaints() {
  if (!requireRole('student')) return;

  const tbody      = document.getElementById('studentComplaintsBody');
  const emptyState = document.getElementById('studentEmptyState');
  if (!tbody) return;

  const statusFilter   = document.getElementById('studentFilterStatus')?.value   || 'All';
  const categoryFilter = document.getElementById('studentFilterCategory')?.value || 'All';
  const departmentFilter = document.getElementById('studentFilterDepartment')?.value || 'All';
  const currentFilters = JSON.stringify({ status: statusFilter, category: categoryFilter, department: departmentFilter });
  if (currentFilters !== loadStudentComplaints._lastFilters) _studentCurrentPage = 1;
  loadStudentComplaints._lastFilters = currentFilters;

  tbody.innerHTML = skeletonRows(6);

  try {
    const params = new URLSearchParams();
    if (statusFilter   !== 'All') params.set('status',   statusFilter);
    if (categoryFilter !== 'All') params.set('category', categoryFilter);
    if (departmentFilter !== 'All') params.set('department', departmentFilter);

    const data = await apiFetch(`/api/complaints?${params}`);
    const complaints = data.complaints;

    if (complaints.length === 0) {
      tbody.innerHTML = '';
      emptyState?.classList.remove('d-none');
      document.getElementById('studentPaginationWrap')?.classList.add('d-none');
      return;
    }
    emptyState?.classList.add('d-none');
    const totalPages = Math.max(1, Math.ceil(complaints.length / STUDENT_PAGE_SIZE));
    if (_studentCurrentPage > totalPages) _studentCurrentPage = totalPages;
    const start = (_studentCurrentPage - 1) * STUDENT_PAGE_SIZE;
    const visibleComplaints = complaints.slice(start, start + STUDENT_PAGE_SIZE);
    renderStudentPagination(complaints.length);

    tbody.innerHTML = visibleComplaints.map((c, i) => `
      <tr>
        <td style="color:var(--color-text-muted);font-size:0.8125rem;">${start + i + 1}</td>
        <td>
          <div style="font-weight:500;">${escapeHtml(c.title)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-faint);margin-top:2px;">${c.complaintId}</div>
          ${c.rejectionReason ? `<div style="font-size:0.75rem;color:var(--color-danger);margin-top:4px;">Rejected: ${escapeHtml(c.rejectionReason)}</div>` : ''}
          ${c.assignedCoordinatorName ? `<div style="font-size:0.75rem;color:var(--color-text-muted);margin-top:4px;">Assigned to ${escapeHtml(c.assignedCoordinatorName)}</div>` : ''}
        </td>
        <td style="font-size:0.875rem;color:var(--color-text-muted);">${escapeHtml(c.category)}</td>
        <td>${getStatusBadge(c.status)}</td>
        <td style="font-size:0.8125rem;color:var(--color-text-muted);">${formatDate(c.createdAt)}</td>
        <td style="text-align:center;">
          <button class="btn btn-outline-custom btn-sm-custom" onclick="openDetailModal('${c.complaintId}')" title="View Complaint">
            <i class="bi bi-eye"></i>
          </button>
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="6" class="text-center py-4 text-danger">
      <i class="bi bi-exclamation-circle me-1"></i>${escapeHtml(err.message)}</td></tr>`;
  }
}

function setStudentPage(page) {
  _studentCurrentPage = Math.max(1, page);
  loadStudentComplaints();
}

function renderStudentPagination(total) {
  const wrap = document.getElementById('studentPaginationWrap');
  const info = document.getElementById('studentPaginationInfo');
  const prev = document.getElementById('studentPrevPage');
  const next = document.getElementById('studentNextPage');
  if (!wrap) return;
  const totalPages = Math.max(1, Math.ceil(total / STUDENT_PAGE_SIZE));
  const start = ((_studentCurrentPage - 1) * STUDENT_PAGE_SIZE) + 1;
  const end = Math.min(total, _studentCurrentPage * STUDENT_PAGE_SIZE);
  wrap.classList.toggle('d-none', total <= STUDENT_PAGE_SIZE);
  if (info) info.textContent = `Showing ${start}-${end} of ${total} complaints. Page ${_studentCurrentPage} of ${totalPages}.`;
  if (prev) prev.disabled = _studentCurrentPage <= 1;
  if (next) next.disabled = _studentCurrentPage >= totalPages;
}

function setStudentStatusFilter(status) {
  const statusFilter = document.getElementById('studentFilterStatus');
  if (!statusFilter) return;
  statusFilter.value = status;

  // Highlight the stat card that triggered this filter.
  document.querySelectorAll('.stat-card-action').forEach((card) => {
    card.classList.toggle('active', card.dataset.status === status);
  });

  _studentCurrentPage = 1;
  loadStudentComplaints();
}

async function loadUserDashboard() {
  const user = requireRole('student');
  if (!user) return;
  await loadMetaOptions();

  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };
  set('userName', user.name);
  set('userStudentId', user.studentId);
  set('userDepartment', user.department || 'General');

  try {
    const statsData = await apiFetch('/api/complaints/stats');
    const s = statsData.stats;

    // These five buckets partition every status, so they always sum to total.
    const pending = (s.Submitted || 0) + (s['Under Review'] || 0) + (s['Reopen Requested'] || 0);
    animateCount(document.getElementById('userStatTotal'), s.total);
    animateCount(document.getElementById('userStatPending'), pending);
    animateCount(document.getElementById('userStatAssigned'), s.Assigned || 0);
    animateCount(document.getElementById('userStatProgress'), s['In Progress'] || 0);
    animateCount(document.getElementById('userStatResolved'), s.Resolved || 0);
    animateCount(document.getElementById('userStatRejected'), s.Rejected || 0);

    // Guard against a status being added later without a matching card.
    const accounted = pending + (s.Assigned || 0) + (s['In Progress'] || 0) + (s.Resolved || 0) + (s.Rejected || 0);
    if (accounted !== s.total) {
      console.warn(`Dashboard cards account for ${accounted} of ${s.total} complaints — a status has no card.`);
    }
  } catch (err) {
    console.error('Could not load dashboard stats:', err.message);
  }

  await loadStudentNotifications();
  await openNotificationsFromHash();
  await loadStudentComplaints();
}

async function loadStudentNotifications() {
  const list = document.getElementById('studentNotifications');
  if (!list) return;

  try {
    const data = await apiFetch('/api/complaints/notifications');
    _studentNotificationsCache = data.notifications || [];
    if (!_studentNotificationsCache.length) {
      list.innerHTML = '<div class="text-muted" style="font-size:0.875rem;">No notifications yet.</div>';
      document.getElementById('notificationPaginationWrap')?.classList.add('d-none');
      return;
    }
    renderStudentNotifications();
  } catch (err) {
    list.innerHTML = `<div class="text-danger" style="font-size:0.875rem;">${escapeHtml(err.message)}</div>`;
  }
}

function renderStudentNotifications() {
  const list = document.getElementById('studentNotifications');
  if (!list) return;
  const total = _studentNotificationsCache.length;
  const totalPages = Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE));
  if (_notificationCurrentPage > totalPages) _notificationCurrentPage = totalPages;
  const start = (_notificationCurrentPage - 1) * NOTIFICATION_PAGE_SIZE;
  const visible = _studentNotificationsCache.slice(start, start + NOTIFICATION_PAGE_SIZE);

  list.innerHTML = visible.map((item) => `
      <div class="alert alert-${item.type === 'danger' ? 'danger' : item.type === 'success' ? 'success' : 'info'} alert-custom mb-2">
        <i class="bi bi-bell-fill me-2"></i>
        <div>
          <div style="font-weight:600;">${escapeHtml(item.title)}</div>
          <div>${escapeHtml(item.message)}</div>
        </div>
      </div>
    `).join('');
  renderNotificationPagination(total);
}

function setNotificationPage(page) {
  _notificationCurrentPage = Math.max(1, page);
  renderStudentNotifications();
}

function renderNotificationPagination(total) {
  const wrap = document.getElementById('notificationPaginationWrap');
  const info = document.getElementById('notificationPaginationInfo');
  const prev = document.getElementById('notificationPrevPage');
  const next = document.getElementById('notificationNextPage');
  if (!wrap) return;
  const totalPages = Math.max(1, Math.ceil(total / NOTIFICATION_PAGE_SIZE));
  const start = ((_notificationCurrentPage - 1) * NOTIFICATION_PAGE_SIZE) + 1;
  const end = Math.min(total, _notificationCurrentPage * NOTIFICATION_PAGE_SIZE);
  wrap.classList.toggle('d-none', total <= NOTIFICATION_PAGE_SIZE);
  if (info) info.textContent = `Showing ${start}-${end} of ${total} notifications. Page ${_notificationCurrentPage} of ${totalPages}.`;
  if (prev) prev.disabled = _notificationCurrentPage <= 1;
  if (next) next.disabled = _notificationCurrentPage >= totalPages;
}

async function refreshNotificationBadge(notifications = null) {
  const badge = document.getElementById('notificationBadge');
  if (!badge || !getToken() || getStoredUser()?.role !== 'student') return;

  try {
    const data = notifications ? { notifications } : await apiFetch('/api/complaints/notifications');
    const unreadCount = data.notifications.filter((item) => !item.read).length;
    badge.textContent = unreadCount > 9 ? '9+' : unreadCount;
    badge.classList.toggle('d-none', unreadCount === 0);
  } catch {
    badge.classList.add('d-none');
  }
}

async function markStudentNotificationsRead() {
  try {
    const data = await apiFetch('/api/complaints/notifications');
    const unread = data.notifications.filter((item) => !item.read);
    await Promise.all(unread.map((item) => apiFetch(`/api/complaints/notifications/${item._id}/read`, { method: 'PUT' })));
    await refreshNotificationBadge(data.notifications.map((item) => ({ ...item, read: true })));
  } catch (err) {
    console.error('Could not mark notifications as read:', err.message);
  }
}

async function toggleStudentNotifications(e) {
  e?.preventDefault();
  const section = document.getElementById('notifications');
  if (!section) {
    window.location.href = 'user-dashboard.html#notifications';
    return;
  }

  const shouldOpen = section.classList.contains('d-none');
  section.classList.toggle('d-none', !shouldOpen);
  if (shouldOpen) {
    await loadStudentNotifications();
    section.scrollIntoView({ behavior: 'smooth', block: 'start' });
    await markStudentNotificationsRead();
  }
}

async function openNotificationsFromHash() {
  if (window.location.hash !== '#notifications') return;
  const section = document.getElementById('notifications');
  if (!section) return;
  section.classList.remove('d-none');
  await loadStudentNotifications();
  await markStudentNotificationsRead();
}


/* ==============================================================
   ADMIN DASHBOARD
   ============================================================== */
// ─── Cached complaint for modals ─────────────────────────────────────────────
let _adminComplaintsCache = [];
let _adminCurrentPage = 1;
const ADMIN_PAGE_SIZE = 5;
let _adminInsightFilter = 'All';
let _adminStudentsCache = [];
let _adminSelectedComplaintIds = new Set();


// Bust cache on any status update so next modal open is fresh
function _bustCache() { _adminComplaintsCache = []; }


/* ==============================================================
   COORDINATOR DASHBOARD
   ============================================================== */
let _coordinatorComplaintsCache = [];
let _coordinatorCurrentPage = 1;
const COORDINATOR_PAGE_SIZE = 5;

async function loadCoordinatorComplaints() {
  if (!requireRole('coordinator')) return;

  const tbody = document.getElementById('coordinatorComplaintsBody');
  const emptyState = document.getElementById('coordinatorEmptyState');
  if (!tbody) return;

  const search = document.getElementById('coordinatorSearchInput')?.value || '';
  const categoryFilter = document.getElementById('coordinatorFilterCategory')?.value || 'All';
  const statusFilter = document.getElementById('coordinatorFilterStatus')?.value || 'All';

  const currentFilters = JSON.stringify({ search, categoryFilter, statusFilter });
  if (loadCoordinatorComplaints._lastFilters && currentFilters !== loadCoordinatorComplaints._lastFilters) {
    _coordinatorCurrentPage = 1;
  }
  loadCoordinatorComplaints._lastFilters = currentFilters;

  tbody.innerHTML = skeletonRows(7);

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'All') params.set('status', statusFilter);
    if (categoryFilter !== 'All') params.set('category', categoryFilter);

    const data = await apiFetch(`/api/complaints?${params}`);
    const complaints = data.complaints;
    _coordinatorComplaintsCache = complaints;

    // Charts and stat cards always reflect the set BEFORE the status filter,
    // so the totals stay stable and the proportions stay meaningful while
    // the user filters the table underneath them.
    let statusScope = complaints;
    if (statusFilter !== 'All') {
      const statsParams = new URLSearchParams();
      if (search) statsParams.set('search', search);
      if (categoryFilter !== 'All') statsParams.set('category', categoryFilter);
      const statsData = await apiFetch(`/api/complaints?${statsParams}`);
      statusScope = statsData.complaints;
    }
    renderCoordinatorCharts(statusScope);
    updateCoordinatorStats(statusScope);

    if (complaints.length === 0) {
      tbody.innerHTML = '';
      emptyState?.classList.remove('d-none');
      document.getElementById('coordinatorPaginationWrap')?.classList.add('d-none');
      return;
    }

    emptyState?.classList.add('d-none');
    const totalPages = Math.max(1, Math.ceil(complaints.length / COORDINATOR_PAGE_SIZE));
    if (_coordinatorCurrentPage > totalPages) _coordinatorCurrentPage = totalPages;
    const start = (_coordinatorCurrentPage - 1) * COORDINATOR_PAGE_SIZE;
    const visible = complaints.slice(start, start + COORDINATOR_PAGE_SIZE);
    renderCoordinatorPagination(complaints.length);

    tbody.innerHTML = visible.map(c => `
      <tr>
        <td style="font-weight:500;font-size:0.8125rem;color:var(--color-text-muted);">${c.complaintId}</td>
        <td>
          <div style="font-weight:500;">${escapeHtml(c.title)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-faint);margin-top:2px;">${escapeHtml(c.category)}</div>
        </td>
        <td>
          <div style="font-weight:500;font-size:0.875rem;">${escapeHtml(c.studentName)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-faint);">${escapeHtml(c.studentId)}</div>
        </td>
        <td>${getPriorityBadge(c.priority)}</td>
        <td>${getStatusBadge(c.status)}</td>
        <td style="font-size:0.8125rem;color:var(--color-text-muted);">${formatDate(c.createdAt)}</td>
        <td style="text-align:center;">
          ${getCoordinatorActionButton(c)}
        </td>
      </tr>
    `).join('');
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="7" class="text-center py-4 text-danger">
      <i class="bi bi-exclamation-circle me-1"></i>${escapeHtml(err.message)}</td></tr>`;
  }
}

/**
 * Stat cards are driven by the unfiltered caseload so the totals stay
 * stable while the user filters the table underneath them.
 */
function updateCoordinatorStats(complaints) {
  const count = (status) => complaints.filter((c) => c.status === status).length;
  animateCount(document.getElementById('coordStatTotal'), complaints.length);
  animateCount(document.getElementById('coordStatAssigned'), count('Assigned'));
  animateCount(document.getElementById('coordStatProgress'), count('In Progress'));
  animateCount(document.getElementById('coordStatReopen'), count('Reopen Requested'));
  animateCount(document.getElementById('coordStatResolved'), count('Resolved'));

  const accounted = count('Assigned') + count('In Progress') + count('Reopen Requested') + count('Resolved');
  if (accounted !== complaints.length) {
    console.warn(`Coordinator cards account for ${accounted} of ${complaints.length} complaints.`);
  }
}

function setCoordinatorPage(page) {
  const totalPages = Math.max(1, Math.ceil(_coordinatorComplaintsCache.length / COORDINATOR_PAGE_SIZE));
  _coordinatorCurrentPage = Math.min(Math.max(1, page), totalPages);
  loadCoordinatorComplaints();
}

function renderCoordinatorPagination(total) {
  const wrap = document.getElementById('coordinatorPaginationWrap');
  const info = document.getElementById('coordinatorPaginationInfo');
  const prev = document.getElementById('coordinatorPrevPage');
  const next = document.getElementById('coordinatorNextPage');
  if (!wrap) return;
  const totalPages = Math.max(1, Math.ceil(total / COORDINATOR_PAGE_SIZE));
  const start = total === 0 ? 0 : ((_coordinatorCurrentPage - 1) * COORDINATOR_PAGE_SIZE) + 1;
  const end = Math.min(total, _coordinatorCurrentPage * COORDINATOR_PAGE_SIZE);
  wrap.classList.toggle('d-none', total <= COORDINATOR_PAGE_SIZE);
  if (info) info.textContent = `Showing ${start}-${end} of ${total} complaints. Page ${_coordinatorCurrentPage} of ${totalPages}.`;
  if (prev) prev.disabled = _coordinatorCurrentPage <= 1;
  if (next) next.disabled = _coordinatorCurrentPage >= totalPages;
}

function renderCoordinatorCharts(complaints) {
  renderStatusDonut({
    key: 'coordinator',
    canvasId: 'coordinatorStatusChart',
    centerId: 'coordinatorPieTotal',
    legendId: 'coordinatorPieLegend',
    currentStatus: document.getElementById('coordinatorFilterStatus')?.value || 'All',
    groups: [
      { label: 'Assigned', statuses: ['Assigned'] },
      { label: 'In Progress', statuses: ['In Progress'] },
      { label: 'Resolved', statuses: ['Resolved'] },
    ],
    onFilter: setCoordinatorStatusFilter,
    complaints,
  });

  renderCategoryBar({ key: 'coordinatorCategory', canvasId: 'coordinatorCategoryChart', complaints });
}

function setCoordinatorStatusFilter(status) {
  const statusFilter = document.getElementById('coordinatorFilterStatus');
  if (!statusFilter) return;
  setSelectValueIfAvailable(statusFilter, status === 'All' ? 'All' : status);
  if (!statusFilter.value) statusFilter.value = 'All';

  // Highlight whichever stat card triggered this filter.
  document.querySelectorAll('.stat-card-action').forEach((card) => {
    card.classList.toggle('active', card.dataset.status === status);
  });

  _coordinatorCurrentPage = 1;
  loadCoordinatorComplaints();
}

function getCoordinatorActionButton(complaint) {
  if (complaint.status === 'Resolved') {
    return `<button class="btn btn-outline-custom btn-sm-custom" onclick="openDetailModal('${complaint.complaintId}')" title="View Details"><i class="bi bi-eye"></i></button>`;
  }
  return `<button class="btn btn-primary-custom btn-sm-custom" onclick="openCoordinatorStatusModal('${complaint.complaintId}')" title="Review Complaint"><i class="bi bi-clipboard-check"></i></button>`;
}

async function openCoordinatorStatusModal(complaintId) {
  try {
    const data = await apiFetch(`/api/complaints/${complaintId}`);
    const complaint = data.complaint;
    if (complaint.status === 'Resolved') {
      openDetailModal(complaintId);
      return;
    }

    document.getElementById('coordComplaintId').value = complaint.complaintId;
    document.getElementById('coordComplaintTitle').textContent = complaint.title;
    document.getElementById('coordComplaintStudent').textContent = `${complaint.studentName} (${complaint.studentId})`;
    document.getElementById('coordStatusSelect').value = complaint.status;
    document.getElementById('coordNotes').value = complaint.coordinatorNotes || '';

    new bootstrap.Modal(document.getElementById('coordinatorStatusModal')).show();
  } catch (err) {
    showToast('Could not load complaint details');
  }
}

async function updateCoordinatorComplaintStatus() {
  const complaintId = document.getElementById('coordComplaintId').value;
  const status = document.getElementById('coordStatusSelect').value;
  const coordinatorNotes = document.getElementById('coordNotes').value;
  const btn = document.querySelector('#coordinatorStatusModal .btn-primary-custom');

  btn.disabled = true;
  btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Updating...';

  try {
    await apiFetch(`/api/complaints/${complaintId}/coordinator-status`, {
      method: 'PUT',
      body: JSON.stringify({ status, coordinatorNotes }),
    });

    bootstrap.Modal.getInstance(document.getElementById('coordinatorStatusModal')).hide();
    loadCoordinatorComplaints();
    showToast(`Complaint ${complaintId} updated`);
  } catch (err) {
    showToast(`Update failed: ${err.message}`);
  } finally {
    btn.disabled = false;
    btn.innerHTML = '<i class="bi bi-check-lg me-1"></i> Update Complaint';
  }
}

async function loadAdminWorkspace() {
  if (!requireRole('admin')) return;
  await loadMetaOptions();
  await loadAdminStudents();
  await loadAdminComplaints();
  await loadAdminAnalytics();
}

async function loadAdminStudents() {
  try {
    const data = await apiFetch('/api/admin/students');
    _adminStudentsCache = Array.isArray(data.students) ? data.students : [];
    renderAdminStudentOptions();
  } catch (err) {
    console.error('Could not load students:', err.message);
  }
}

function renderAdminStudentOptions(query = '') {
  const select = document.getElementById('adminComplaintStudent');
  if (!select) return;
  const normalized = query.trim().toLowerCase();
  const students = normalized
    ? _adminStudentsCache.filter((student) =>
        [student.name, getInitials(student.name), student.email, student.studentId, student.department]
          .some((value) => String(value || '').toLowerCase().includes(normalized))
      )
    : _adminStudentsCache;
  select.innerHTML = '<option value="" disabled selected>Select student...</option>' + students.map((student) =>
    `<option value="${student._id}">${escapeHtml(student.name)} - ${escapeHtml(student.studentId || student.email)}</option>`
  ).join('');
}

function getInitials(name = '') {
  return String(name)
    .split(/\s+/)
    .filter(Boolean)
    .map((part) => part[0])
    .join('');
}

function filterAdminStudentOptions() {
  renderAdminStudentOptions(document.getElementById('adminStudentSearch')?.value || '');
}

async function loadAdminAnalytics() {
  const set = (id, value) => { const el = document.getElementById(id); if (el) el.textContent = value; };

  // Rating rows rendered as a name + progress bar + score.
  const renderRows = (id, rows) => {
    const el = document.getElementById(id);
    if (!el) return;
    if (!rows.length) {
      el.innerHTML = '<div class="text-muted" style="font-size:0.875rem;">No feedback submitted yet.</div>';
      return;
    }
    el.innerHTML = rows.slice(0, 5).map((row) => `
      <div class="rating-row">
        <span style="flex:1;min-width:0;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;">${escapeHtml(row.name)}</span>
        <span class="rating-bar"><i style="width:${(row.average / 5) * 100}%;"></i></span>
        <strong style="white-space:nowrap;">${row.average}/5
          <span style="color:var(--color-text-faint);font-weight:500;font-size:0.75rem;">(${row.count})</span>
        </strong>
      </div>
    `).join('');
  };

  try {
    const data = await apiFetch('/api/complaints/analytics/summary');
    const s = data.summary || {};

    animateCount(document.getElementById('analyticsLowRated'), s.lowRated || 0);
    animateCount(document.getElementById('analyticsReopenPending'), s.reopenPending || 0);
    animateCount(document.getElementById('analyticsFeedbackCount'), s.feedbackCount || 0);
    set('analyticsAvgRating', s.averageRating ? `${s.averageRating}/5` : '—');
    set('analyticsAvgResolution', s.averageResolutionHours ? `${s.averageResolutionHours} hrs` : '—');

    renderRows('departmentFeedbackSummary', s.departmentRatings || []);
    renderRows('coordinatorFeedbackSummary', s.coordinatorRatings || []);
    renderPriorityChart(s.priorityCounts || {});
    renderRatingChart(s.departmentRatings || []);
  } catch (err) {
    console.error('Could not load analytics:', err.message);
  }
}

/** Priority mix across all complaints (admin analytics). */
function renderPriorityChart(counts) {
  const canvas = document.getElementById('adminPriorityChart');
  if (!canvas || typeof Chart === 'undefined') return;

  applyChartDefaults();
  destroyChart('adminPriority');

  const order = ['Low', 'Medium', 'High', 'Urgent'];
  const colors = { Low: '#94a3b8', Medium: '#2563eb', High: '#a16207', Urgent: '#b91c1c' };
  const labels = order.filter((k) => (counts[k] || 0) > 0);

  if (!labels.length) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  _charts.adminPriority = new Chart(canvas, {
    type: 'polarArea',
    data: {
      labels,
      datasets: [{
        data: labels.map((k) => counts[k]),
        backgroundColor: labels.map((k) => `${colors[k]}cc`),
        borderColor: '#ffffff',
        borderWidth: 2,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { position: 'right', labels: { boxWidth: 10, boxHeight: 10, usePointStyle: true, pointStyle: 'circle', padding: 12 } },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.label}: ${ctx.parsed.r}` } },
      },
      scales: { r: { ticks: { display: false }, grid: { color: '#e2e8f0' } } },
    },
  });
}

async function downloadAdminReport() {
  try {
    const format = document.getElementById('adminReportFormat')?.value || 'csv';
    const data = await apiFetch('/api/complaints');
    exportComplaintReport({
      title: 'Admin Complaint Report',
      filename: 'admin-complaints-report',
      format,
      complaints: data.complaints || [],
      includeCoordinator: true,
    });
  } catch (err) {
    showToast(err.message);
  }
}

async function downloadCoordinatorReport() {
  try {
    const scope = document.getElementById('coordinatorReportScope')?.value || 'all';
    const format = document.getElementById('coordinatorReportFormat')?.value || 'csv';
    const params = new URLSearchParams();
    if (scope === 'assigned') params.set('status', 'Assigned');
    if (scope === 'in-progress') params.set('status', 'In Progress');
    if (scope === 'resolved') params.set('status', 'Resolved');
    const data = await apiFetch(`/api/complaints?${params}`);
    exportComplaintReport({
      title: `Coordinator Complaint Report - ${scope.replace('-', ' ')}`,
      filename: `coordinator-${scope}-complaints-report`,
      format,
      complaints: data.complaints || [],
      includeCoordinator: false,
    });
  } catch (err) {
    showToast(err.message);
  }
}

function complaintReportRows(complaints, includeCoordinator = true) {
  const headers = ['ID', 'Title', 'Student', 'Category', 'Department', 'Priority', 'Status'];
  if (includeCoordinator) headers.push('Coordinator');
  headers.push('Rating', 'Satisfaction', 'Submitted', 'Resolved');
  const rows = complaints.map((complaint) => {
    const row = [
      complaint.complaintId,
      complaint.title,
      complaint.studentName,
      complaint.category,
      complaint.department || '',
      complaint.priority || 'Medium',
      complaint.status,
    ];
    if (includeCoordinator) row.push(complaint.assignedCoordinatorName || '');
    row.push(
      complaint.feedback?.rating || '',
      complaint.feedback?.satisfaction || '',
      complaint.createdAt ? formatDate(complaint.createdAt) : '',
      complaint.resolvedAt ? formatDate(complaint.resolvedAt) : ''
    );
    return row;
  });
  return { headers, rows };
}

function exportComplaintReport({ title, filename, format, complaints, includeCoordinator }) {
  const { headers, rows } = complaintReportRows(complaints, includeCoordinator);
  if (format === 'csv') {
    const csv = [headers, ...rows].map((row) => row.map((cell) => `"${String(cell ?? '').replace(/"/g, '""')}"`).join(',')).join('\n');
    downloadTextFile(`${filename}.csv`, csv, 'text/csv');
    return;
  }
  const table = reportTableHtml(headers, rows);
  if (format === 'xls') {
    downloadTextFile(`${filename}.xls`, `<!doctype html><html><head><meta charset="utf-8"></head><body>${table}</body></html>`, 'application/vnd.ms-excel');
    return;
  }
  openPrintableReport(title, table, format === 'pdf');
}

function reportTableHtml(headers, rows) {
  return `
    <table>
      <thead><tr>${headers.map((header) => `<th>${escapeHtml(header)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((row) => `<tr>${row.map((cell) => `<td>${escapeHtml(cell)}</td>`).join('')}</tr>`).join('')}</tbody>
    </table>
  `;
}

function downloadTextFile(filename, content, type) {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

function openPrintableReport(title, table, autoPrint = false) {
  const win = window.open('', '_blank');
  if (!win) {
    showToast('Please allow popups to open the report');
    return;
  }
  win.document.write(`
    <!doctype html>
    <html>
      <head>
        <title>${escapeHtml(title)}</title>
        <style>
          body{font-family:Arial,sans-serif;color:#0f172a;margin:32px;}
          h1{font-size:22px;margin:0 0 4px;}
          p{color:#64748b;margin:0 0 18px;font-size:13px;}
          table{width:100%;border-collapse:collapse;font-size:12px;}
          th,td{border:1px solid #cbd5e1;padding:8px;text-align:left;vertical-align:top;}
          th{background:#f1f5f9;}
          @media print{button{display:none;} body{margin:18px;}}
        </style>
      </head>
      <body>
        <button onclick="window.print()" style="float:right;padding:8px 12px;">Print / Save PDF</button>
        <h1>${escapeHtml(title)}</h1>
        <p>University of Southern Punjab - generated ${new Date().toLocaleString()}</p>
        ${table}
        ${autoPrint ? '<script>setTimeout(function(){window.print()}, 300)<\\/script>' : ''}
      </body>
    </html>
  `);
  win.document.close();
}

async function openDetailModal(complaintId) {
  try {
    const data = await apiFetch(`/api/complaints/${complaintId}`);
    const c = data.complaint;
    const user = getStoredUser();
    const attachments = (c.attachments || []).map((file) =>
      `<a href="${file.path}" target="_blank" class="btn btn-outline-custom btn-sm-custom me-1 mb-1">
        <i class="bi bi-paperclip me-1"></i>${escapeHtml(file.originalName || 'Attachment')}
      </a>`
    ).join('');
    const timeline = (c.timeline || []).map((item, i) => `
      <div class="timeline-item" style="animation-delay:${i * 55}ms;">
        <div class="timeline-status">${escapeHtml(item.status)}</div>
        <div class="timeline-message">${escapeHtml(item.message || '')}</div>
        <div class="timeline-meta">
          ${item.actorName ? `${escapeHtml(item.actorName)} · ` : ''}${item.createdAt ? formatDate(item.createdAt) : ''}
        </div>
      </div>
    `).join('');
    const stars = (n) => '★'.repeat(n) + '☆'.repeat(5 - n);
    const feedback = c.feedback?.rating ? `
      <div class="col-12"><div class="detail-label">Student Feedback</div>
        <div class="detail-panel panel-accent" style="font-size:0.875rem;">
          <span style="color:#c2410c;letter-spacing:2px;font-size:1rem;">${stars(c.feedback.rating)}</span>
          <strong style="margin-left:0.5rem;">${c.feedback.rating}/5</strong>
          <span style="margin-left:0.5rem;">${escapeHtml(c.feedback.satisfaction || '')}</span>
          ${c.feedback.comment ? `<div style="margin-top:0.5rem;">${escapeHtml(c.feedback.comment)}</div>` : ''}
        </div>
      </div>` : '';
    const studentClosureActions = user?.role === 'student' && ['Resolved', 'Rejected'].includes(c.status) && !c.feedback?.rating ? `
      <div class="col-12">
        <div class="detail-label">Rate how this was handled</div>
        <div class="row g-2">
          <div class="col-sm-3"><select class="form-select form-select-custom" id="feedbackRating">
            <option value="5">5 - Excellent</option><option value="4">4 - Good</option><option value="3">3 - Okay</option><option value="2">2 - Poor</option><option value="1">1 - Bad</option>
          </select></div>
          <div class="col-sm-3"><select class="form-select form-select-custom" id="feedbackSatisfaction">
            <option value="Satisfied">Satisfied</option><option value="Neutral">Neutral</option><option value="Unsatisfied">Unsatisfied</option>
          </select></div>
          <div class="col-sm-6"><input class="form-control form-control-custom" id="feedbackComment" placeholder="Optional feedback comment"></div>
          <div class="col-12"><button class="btn btn-primary-custom btn-sm-custom" onclick="submitComplaintFeedback('${c.complaintId}')"><i class="bi bi-star me-1"></i>Submit Feedback</button></div>
        </div>
      </div>` : '';
    const reopenAction = user?.role === 'student' && c.status === 'Resolved' && c.reopenRequest?.status !== 'Pending' ? `
      <div class="col-12">
        <div class="detail-label">Need more help?</div>
        <div class="d-flex gap-2">
          <input class="form-control form-control-custom" id="reopenReason" placeholder="Explain why this should be reopened">
          <button class="btn btn-outline-custom btn-sm-custom" style="white-space:nowrap;" onclick="requestComplaintReopen('${c.complaintId}')">Request Reopen</button>
        </div>
      </div>` : '';
    const reopenInfo = c.reopenRequest?.status && c.reopenRequest.status !== 'None' ? `
      <div class="col-12"><div class="detail-label">Reopen Request</div>
        <div class="detail-panel" style="font-size:0.875rem;">
          <strong>${escapeHtml(c.reopenRequest.status)}</strong>${c.reopenRequest.reason ? ` — ${escapeHtml(c.reopenRequest.reason)}` : ''}
          ${c.reopenRequest.adminResponse ? `<div style="margin-top:0.5rem;">Admin response: ${escapeHtml(c.reopenRequest.adminResponse)}</div>` : ''}
        </div>
      </div>` : '';

    document.getElementById('detailModalBody').innerHTML = `
      <div class="row g-3">
        <div class="col-12">
          <div class="d-flex flex-wrap align-items-center gap-2 mb-1">
            ${getStatusBadge(c.status)}
            ${user?.role === 'student' ? '' : getPriorityBadge(c.priority)}
            <span class="chat-ref">${escapeHtml(c.complaintId)}</span>
          </div>
          <div style="font-weight:700;font-size:1.125rem;line-height:1.35;">${escapeHtml(c.title)}</div>
        </div>

        <div class="col-sm-6"><div class="detail-label">Submitted</div><div class="detail-value">${formatDate(c.createdAt)} <span class="text-muted" style="font-weight:400;">· ${timeAgo(c.createdAt)}</span></div></div>
        <div class="col-sm-6"><div class="detail-label">Category</div><div class="detail-value">${escapeHtml(c.category)}</div></div>
        <div class="col-sm-6"><div class="detail-label">Student</div><div class="detail-value">${escapeHtml(c.studentName)}</div><div style="font-size:0.8125rem;color:var(--color-text-faint);">${escapeHtml(c.studentEmail)} · ${escapeHtml(c.studentId)}</div></div>
        <div class="col-sm-6"><div class="detail-label">Concerned Department</div><div class="detail-value">${escapeHtml(c.department || 'Unassigned')}</div></div>
        <div class="col-12"><div class="detail-label">Assigned Coordinator</div><div class="detail-value">${escapeHtml(c.assignedCoordinatorName || 'Not assigned')}</div></div>

        <div class="col-12"><div class="detail-label">Description</div><div class="detail-panel">${escapeHtml(c.description)}</div></div>

        ${c.rejectionReason ? `<div class="col-12"><div class="detail-label">Rejection Reason</div><div class="detail-panel panel-danger">${escapeHtml(c.rejectionReason)}</div></div>` : ''}
        ${c.adminNotes ? `<div class="col-12"><div class="detail-label">Admin Notes</div><div class="detail-panel panel-info">${escapeHtml(c.adminNotes)}</div></div>` : ''}
        ${c.coordinatorNotes ? `<div class="col-12"><div class="detail-label">Coordinator Notes</div><div class="detail-panel panel-success">${escapeHtml(c.coordinatorNotes)}</div></div>` : ''}
        ${feedback}
        ${reopenInfo}
        ${attachments ? `<div class="col-12"><div class="detail-label">Attachments</div>${attachments}</div>` : ''}
        ${timeline ? `<div class="col-12"><div class="detail-label mb-2">Progress Timeline</div><div class="timeline">${timeline}</div></div>` : ''}
        ${studentClosureActions}
        ${reopenAction}
      </div>`;

    new bootstrap.Modal(document.getElementById('detailModal')).show();
  } catch (err) {
    showToast('Could not load complaint details');
  }
}

async function submitComplaintFeedback(complaintId) {
  const rating = document.getElementById('feedbackRating')?.value;
  const satisfaction = document.getElementById('feedbackSatisfaction')?.value;
  const comment = document.getElementById('feedbackComment')?.value || '';
  try {
    await apiFetch(`/api/complaints/${complaintId}/feedback`, {
      method: 'PUT',
      body: JSON.stringify({ rating, satisfaction, comment }),
    });
    bootstrap.Modal.getInstance(document.getElementById('detailModal'))?.hide();
    showToast('Feedback submitted');
    loadStudentComplaints();
  } catch (err) {
    showToast(`Feedback failed: ${err.message}`);
  }
}

async function requestComplaintReopen(complaintId) {
  const reason = document.getElementById('reopenReason')?.value || '';
  try {
    await apiFetch(`/api/complaints/${complaintId}/reopen-request`, {
      method: 'PUT',
      body: JSON.stringify({ reason }),
    });
    bootstrap.Modal.getInstance(document.getElementById('detailModal'))?.hide();
    showToast('Reopen request sent');
    loadStudentComplaints();
  } catch (err) {
    showToast(`Request failed: ${err.message}`);
  }
}

async function loadAdminComplaints() {
  if (!requireRole('admin')) return;
  const tbody = document.getElementById('adminComplaintsBody');
  const emptyState = document.getElementById('adminEmptyState');
  if (!tbody) return;

  const search = document.getElementById('adminSearchInput')?.value || '';
  const categoryFilter = document.getElementById('adminFilterCategory')?.value || 'All';
  const departmentFilter = document.getElementById('adminFilterDepartment')?.value || 'All';
  const statusFilter = document.getElementById('adminFilterStatus')?.value || 'All';
  const currentFilters = JSON.stringify({ search, categoryFilter, departmentFilter, statusFilter, insight: _adminInsightFilter });
  if (loadAdminComplaints._lastFilters && currentFilters !== loadAdminComplaints._lastFilters) _adminCurrentPage = 1;
  loadAdminComplaints._lastFilters = currentFilters;

  tbody.innerHTML = skeletonRows(9);

  try {
    const params = new URLSearchParams();
    if (search) params.set('search', search);
    if (statusFilter !== 'All') params.set('status', statusFilter);
    if (categoryFilter !== 'All') params.set('category', categoryFilter);
    if (departmentFilter !== 'All') params.set('department', departmentFilter);

    const data = await apiFetch(`/api/complaints?${params}`);
    const allComplaints = data.complaints;
    let chartComplaints = allComplaints;
    if (statusFilter !== 'All') {
      const chartParams = new URLSearchParams();
      if (search) chartParams.set('search', search);
      if (categoryFilter !== 'All') chartParams.set('category', categoryFilter);
      if (departmentFilter !== 'All') chartParams.set('department', departmentFilter);
      const chartData = await apiFetch(`/api/complaints?${chartParams}`);
      chartComplaints = chartData.complaints;
    }
    const complaints = applyAdminInsightFilter(allComplaints);
    renderAdminCharts(chartComplaints);
    updateAdminInsightActiveCard();
    _adminComplaintsCache = complaints;
    syncAdminSelectionWithComplaints(complaints);

    if (complaints.length === 0) {
      tbody.innerHTML = '';
      emptyState?.classList.remove('d-none');
      document.getElementById('adminPaginationWrap')?.classList.add('d-none');
      updateAdminBulkSelectionUi([]);
      return;
    }

    emptyState?.classList.add('d-none');
    const totalPages = Math.max(1, Math.ceil(complaints.length / ADMIN_PAGE_SIZE));
    if (_adminCurrentPage > totalPages) _adminCurrentPage = totalPages;
    const start = (_adminCurrentPage - 1) * ADMIN_PAGE_SIZE;
    const visibleComplaints = complaints.slice(start, start + ADMIN_PAGE_SIZE);
    renderAdminPagination(complaints.length);
    tbody.innerHTML = visibleComplaints.map(c => `
      <tr>
        <td style="text-align:center;">
          <input class="form-check-input admin-complaint-checkbox" type="checkbox" value="${c.complaintId}" onchange="toggleAdminComplaintSelection('${c.complaintId}', this.checked)" ${_adminSelectedComplaintIds.has(c.complaintId) ? 'checked' : ''} aria-label="Select ${c.complaintId}">
        </td>
        <td style="font-weight:500;font-size:0.8125rem;color:var(--color-text-muted);">${c.complaintId}</td>
        <td>
          <div style="font-weight:500;">${escapeHtml(c.title)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-faint);margin-top:2px;">${escapeHtml(c.category)}</div>
        </td>
        <td>
          <div style="font-weight:500;font-size:0.875rem;">${escapeHtml(c.studentName)}</div>
          <div style="font-size:0.75rem;color:var(--color-text-faint);">${escapeHtml(c.studentId)}</div>
        </td>
        <td style="font-size:0.8125rem;color:var(--color-text-muted);">${escapeHtml(c.department || 'Unassigned')}</td>
        <td style="font-size:0.8125rem;color:var(--color-text-muted);">${escapeHtml(c.assignedCoordinatorName || 'Not assigned')}</td>
        <td>${getStatusBadge(c.status)}</td>
        <td style="font-size:0.8125rem;color:var(--color-text-muted);">${formatDate(c.createdAt)}</td>
        <td style="text-align:center;">
          <div class="d-flex justify-content-center gap-1">
            ${getAdminActionButtons(c)}
          </div>
        </td>
      </tr>
    `).join('');
    updateAdminBulkSelectionUi(visibleComplaints);
  } catch (err) {
    tbody.innerHTML = `<tr><td colspan="9" class="text-center py-4 text-danger">
      <i class="bi bi-exclamation-circle me-1"></i>${escapeHtml(err.message)}</td></tr>`;
  }
}

function setAdminPage(page) {
  const total = _adminComplaintsCache.length;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  _adminCurrentPage = Math.min(Math.max(1, page), totalPages);
  loadAdminComplaints();
}

function renderAdminPagination(total) {
  const wrap = document.getElementById('adminPaginationWrap');
  const info = document.getElementById('adminPaginationInfo');
  const prev = document.getElementById('adminPrevPage');
  const next = document.getElementById('adminNextPage');
  if (!wrap) return;
  const totalPages = Math.max(1, Math.ceil(total / ADMIN_PAGE_SIZE));
  wrap.classList.toggle('d-none', total <= ADMIN_PAGE_SIZE);
  const start = total === 0 ? 0 : ((_adminCurrentPage - 1) * ADMIN_PAGE_SIZE) + 1;
  const end = Math.min(total, _adminCurrentPage * ADMIN_PAGE_SIZE);
  if (info) info.textContent = `Showing ${start}-${end} of ${total} complaints. Page ${_adminCurrentPage} of ${totalPages}.`;
  if (prev) prev.disabled = _adminCurrentPage <= 1;
  if (next) next.disabled = _adminCurrentPage >= totalPages;
}

function syncAdminSelectionWithComplaints(complaints) {
  const visibleIds = new Set(complaints.map((complaint) => complaint.complaintId));
  _adminSelectedComplaintIds = new Set([..._adminSelectedComplaintIds].filter((id) => visibleIds.has(id)));
}

function toggleAdminComplaintSelection(complaintId, checked) {
  if (checked) {
    _adminSelectedComplaintIds.add(complaintId);
  } else {
    _adminSelectedComplaintIds.delete(complaintId);
  }
  const currentPageComplaints = Array.from(document.querySelectorAll('.admin-complaint-checkbox')).map((input) => ({ complaintId: input.value }));
  updateAdminBulkSelectionUi(currentPageComplaints);
}

function toggleAllAdminComplaintSelection(checked) {
  document.querySelectorAll('.admin-complaint-checkbox').forEach((input) => {
    input.checked = checked;
    if (checked) {
      _adminSelectedComplaintIds.add(input.value);
    } else {
      _adminSelectedComplaintIds.delete(input.value);
    }
  });
  const currentPageComplaints = Array.from(document.querySelectorAll('.admin-complaint-checkbox')).map((input) => ({ complaintId: input.value }));
  updateAdminBulkSelectionUi(currentPageComplaints);
}

function updateAdminBulkSelectionUi(currentPageComplaints = []) {
  const count = _adminSelectedComplaintIds.size;
  const countEl = document.getElementById('adminSelectedCount');
  const deleteBtn = document.getElementById('adminBulkDeleteBtn');
  const selectAll = document.getElementById('adminSelectAllComplaints');
  if (countEl) countEl.textContent = `(${count})`;
  if (deleteBtn) deleteBtn.disabled = count === 0;
  if (selectAll) {
    const pageIds = currentPageComplaints.map((complaint) => complaint.complaintId);
    const checkedCount = pageIds.filter((id) => _adminSelectedComplaintIds.has(id)).length;
    selectAll.checked = pageIds.length > 0 && checkedCount === pageIds.length;
    selectAll.indeterminate = checkedCount > 0 && checkedCount < pageIds.length;
  }
}

async function deleteSelectedAdminComplaints() {
  const selected = [..._adminSelectedComplaintIds];
  if (!selected.length) return;
  const confirmed = window.confirm(`Delete ${selected.length} selected complaint${selected.length === 1 ? '' : 's'}? This cannot be undone.`);
  if (!confirmed) return;

  const btn = document.getElementById('adminBulkDeleteBtn');
  const originalHtml = btn?.innerHTML;
  if (btn) {
    btn.disabled = true;
    btn.innerHTML = '<span class="spinner-border spinner-border-sm me-1"></span> Deleting...';
  }

  try {
    await Promise.all(selected.map((complaintId) => apiFetch(`/api/complaints/${complaintId}`, { method: 'DELETE' })));
    _adminSelectedComplaintIds.clear();
    _bustCache();
    showToast(`${selected.length} complaint${selected.length === 1 ? '' : 's'} deleted`);
    await loadAdminComplaints();
    await loadAdminAnalytics();
  } catch (err) {
    showToast(`Delete failed: ${err.message}`);
  } finally {
    if (btn) {
      btn.innerHTML = originalHtml || '<i class="bi bi-trash me-1"></i> Delete Selected <span id="adminSelectedCount">(0)</span>';
      updateAdminBulkSelectionUi();
    }
  }
}

function setAdminStatusFilter(status) {
  const statusFilter = document.getElementById('adminFilterStatus');
  if (!statusFilter) return;
  statusFilter.value = status;
  _adminInsightFilter = 'All';
  _adminCurrentPage = 1;
  loadAdminComplaints();
}

function setAdminInsightFilter(filter) {
  _adminInsightFilter = _adminInsightFilter === filter ? 'All' : filter;
  const statusFilter = document.getElementById('adminFilterStatus');
  if (statusFilter && filter === 'reopen') statusFilter.value = 'Reopen Requested';
  if (statusFilter && filter !== 'reopen') statusFilter.value = 'All';
  _adminCurrentPage = 1;
  loadAdminComplaints();
}

function applyAdminInsightFilter(complaints) {
  if (_adminInsightFilter === 'lowRated') return complaints.filter(c => Number(c.feedback?.rating || 0) > 0 && Number(c.feedback.rating) <= 2);
  if (_adminInsightFilter === 'feedback') return complaints.filter(c => c.feedback?.rating);
  if (_adminInsightFilter === 'reopen') return complaints.filter(c => c.reopenRequest?.status === 'Pending');
  return complaints;
}

function updateAdminInsightActiveCard() {
  const activeMap = {
    lowRated: 'adminLowRatedCard',
    reopen: 'adminReopenCard',
    feedback: 'adminFeedbackCard',
  };
  ['adminLowRatedCard', 'adminReopenCard', 'adminFeedbackCard'].forEach((id) => document.getElementById(id)?.classList.remove('active'));
  const activeId = activeMap[_adminInsightFilter];
  if (activeId) document.getElementById(activeId)?.classList.add('active');
}

async function reviewReopenRequest(complaintId, decision) {
  const adminResponse = window.prompt(`${decision} reopen request - optional response`, '') || '';
  try {
    await apiFetch(`/api/complaints/${complaintId}/reopen-review`, {
      method: 'PUT',
      body: JSON.stringify({ decision, adminResponse }),
    });
    showToast(`Reopen request ${decision.toLowerCase()}`);
    _bustCache();
    loadAdminComplaints();
    loadAdminAnalytics();
  } catch (err) {
    showToast(`Reopen review failed: ${err.message}`);
  }
}

function canAdminReviewComplaint(complaint) {
  return ['Submitted', 'Under Review'].includes(complaint.status);
}

function getAdminActionButtons(complaint) {
  const detailButton = `<button class="btn btn-outline-custom btn-sm-custom" onclick="openDetailModal('${complaint.complaintId}')" title="View Details"><i class="bi bi-eye"></i></button>`;
  if (complaint.reopenRequest?.status === 'Pending') {
    return `
      ${detailButton}
      <button class="btn btn-primary-custom btn-sm-custom" onclick="reviewReopenRequest('${complaint.complaintId}', 'Approved')" title="Approve Reopen"><i class="bi bi-arrow-counterclockwise"></i></button>
      <button class="btn btn-outline-custom btn-sm-custom" onclick="reviewReopenRequest('${complaint.complaintId}', 'Rejected')" title="Reject Reopen"><i class="bi bi-slash-circle"></i></button>
    `;
  }
  if (complaint.status === 'Assigned') {
    return `
      ${detailButton}
      <button class="btn btn-primary-custom btn-sm-custom" onclick="openAdminAssignModal('${complaint.complaintId}', 'reassign')" title="Reassign Coordinator"><i class="bi bi-arrow-left-right"></i></button>
    `;
  }
  if (!canAdminReviewComplaint(complaint)) {
    return `${detailButton}<span class="btn btn-outline-custom btn-sm-custom disabled" title="Already handled"><i class="bi bi-lock"></i></span>`;
  }
  const reviewButton = complaint.status === 'Submitted'
    ? `<button class="btn btn-outline-custom btn-sm-custom" onclick="markComplaintUnderReview('${complaint.complaintId}')" title="Mark Under Review"><i class="bi bi-hourglass-split"></i></button>`
    : '';

  return `
    ${detailButton}
    ${reviewButton}
    <button class="btn btn-primary-custom btn-sm-custom" onclick="openAdminAssignModal('${complaint.complaintId}', 'assign')" title="Assign"><i class="bi bi-person-check"></i></button>
    <button class="btn btn-outline-custom btn-sm-custom" onclick="openAdminRejectModal('${complaint.complaintId}')" title="Reject"><i class="bi bi-x-circle"></i></button>
  `;
}

/** Admin marks a newly submitted complaint as being verified. */
async function markComplaintUnderReview(complaintId) {
  try {
    await apiFetch(`/api/complaints/${complaintId}/review`, { method: 'PUT' });
    showToast(`${complaintId} marked Under Review`);
    _bustCache();
    loadAdminComplaints();
    loadAdminAnalytics();
  } catch (err) {
    showToast(err.message || 'Could not update complaint', 'error');
  }
}

function renderAdminCharts(complaints) {
  renderStatusDonut({
    key: 'admin',
    canvasId: 'adminStatusChart',
    centerId: 'adminPieTotal',
    legendId: 'adminPieLegend',
    currentStatus: document.getElementById('adminFilterStatus')?.value || 'All',
    groups: [
      { label: 'Submitted', statuses: ['Submitted'] },
      { label: 'Under Review', statuses: ['Under Review'] },
      { label: 'Assigned', statuses: ['Assigned'] },
      { label: 'In Progress', statuses: ['In Progress'] },
      { label: 'Resolved', statuses: ['Resolved'] },
      { label: 'Rejected', statuses: ['Rejected'] },
      { label: 'Reopen Requested', statuses: ['Reopen Requested'] },
    ],
    onFilter: setAdminStatusFilter,
    complaints,
  });

  renderCategoryBar({ key: 'adminCategory', canvasId: 'adminCategoryChart', complaints });
}


/* ==============================================================
   CHARTS — Chart.js (vendored locally, works offline)
   ============================================================== */
const CHART_COLORS = {
  'Submitted':        '#a16207',
  'Under Review':     '#7c3aed',
  'Assigned':         '#0d6e78',
  'In Progress':      '#2563eb',
  'Resolved':         '#15803d',
  'Rejected':         '#b91c1c',
  'Reopen Requested': '#c2410c',
};

// Live Chart instances, keyed so we can destroy before re-rendering.
const _charts = {};

function destroyChart(key) {
  if (_charts[key]) {
    _charts[key].destroy();
    delete _charts[key];
  }
}

/** Shared Chart.js defaults so every chart looks like one system. */
function applyChartDefaults() {
  if (typeof Chart === 'undefined' || applyChartDefaults._done) return;
  Chart.defaults.font.family = getComputedStyle(document.body).fontFamily;
  Chart.defaults.font.size = 12;
  Chart.defaults.color = '#64748b';
  Chart.defaults.plugins.tooltip.backgroundColor = '#0f172a';
  Chart.defaults.plugins.tooltip.padding = 10;
  Chart.defaults.plugins.tooltip.cornerRadius = 6;
  Chart.defaults.plugins.tooltip.titleFont = { weight: '600', size: 12 };
  Chart.defaults.plugins.tooltip.displayColors = true;
  Chart.defaults.plugins.tooltip.boxPadding = 4;
  applyChartDefaults._done = true;
}

/**
 * Status doughnut with a custom clickable legend.
 * Clicking a slice or a legend row filters the table by that status.
 */
function renderStatusDonut({ key, canvasId, centerId, legendId, currentStatus, groups, onFilter, complaints }) {
  const canvas = document.getElementById(canvasId);
  const legend = document.getElementById(legendId);
  const centerEl = document.getElementById(centerId);
  if (!canvas || typeof Chart === 'undefined') return;

  applyChartDefaults();

  const total = complaints.length;
  if (centerEl) animateCount(centerEl, total);

  const segments = groups
    .map((g) => ({
      label: g.label,
      statuses: g.statuses,
      count: complaints.filter((c) => g.statuses.includes(c.status)).length,
      color: CHART_COLORS[g.label] || '#64748b',
    }))
    .filter((s) => s.count > 0);

  destroyChart(key);

  if (!segments.length) {
    if (legend) legend.innerHTML = '<div class="text-muted" style="font-size:0.875rem;">No complaints match the current filters.</div>';
    const ctx = canvas.getContext('2d');
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  _charts[key] = new Chart(canvas, {
    type: 'doughnut',
    data: {
      labels: segments.map((s) => s.label),
      datasets: [{
        data: segments.map((s) => s.count),
        backgroundColor: segments.map((s) => s.color),
        borderColor: '#ffffff',
        borderWidth: 2,
        hoverOffset: 10,
        hoverBorderColor: '#ffffff',
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '64%',
      animation: { animateRotate: true, animateScale: false, duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: {
          callbacks: {
            label: (ctx) => {
              const pct = total ? Math.round((ctx.parsed / total) * 100) : 0;
              return ` ${ctx.label}: ${ctx.parsed} (${pct}%)`;
            },
          },
        },
      },
      onClick: (_evt, elements) => {
        if (!elements.length || typeof onFilter !== 'function') return;
        onFilter(segments[elements[0].index].label);
      },
      onHover: (evt, elements) => {
        evt.native.target.style.cursor = elements.length ? 'pointer' : 'default';
      },
    },
  });

  if (legend) {
    legend.innerHTML = segments.map((s) => `
      <button type="button" class="pie-legend-btn ${s.statuses.includes(currentStatus) ? 'active' : ''}"
              data-status="${escapeHtml(s.label)}">
        <div style="font-weight:600;font-size:0.875rem;">
          <span class="pie-legend-dot" style="background:${s.color};"></span>${s.count} ${escapeHtml(s.label)}
        </div>
        <div class="text-muted" style="font-size:0.75rem;">${Math.round((s.count / total) * 100)}% of complaints</div>
      </button>
    `).join('');

    legend.querySelectorAll('.pie-legend-btn').forEach((btn) => {
      btn.addEventListener('click', () => onFilter(btn.dataset.status));
    });
  }
}

/** Horizontal bar of complaint volume per category. */
function renderCategoryBar({ key, canvasId, complaints }) {
  const canvas = document.getElementById(canvasId);
  if (!canvas || typeof Chart === 'undefined') return;

  applyChartDefaults();

  const counts = {};
  complaints.forEach((c) => { counts[c.category] = (counts[c.category] || 0) + 1; });
  const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]).slice(0, 6);

  destroyChart(key);

  if (!rows.length) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  _charts[key] = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: rows.map((r) => r[0]),
      datasets: [{
        label: 'Complaints',
        data: rows.map((r) => r[1]),
        backgroundColor: 'rgba(13, 110, 120, 0.85)',
        hoverBackgroundColor: '#0a5c64',
        borderRadius: 5,
        borderSkipped: false,
        barThickness: 18,
      }],
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.x} complaint${ctx.parsed.x === 1 ? '' : 's'}` } },
      },
      scales: {
        x: {
          beginAtZero: true,
          ticks: { precision: 0 },
          grid: { color: '#e2e8f0' }, border: { display: false },
        },
        y: { grid: { display: false }, border: { display: false } },
      },
    },
  });
}

/** Average feedback rating per department (admin analytics). */
function renderRatingChart(rows) {
  const canvas = document.getElementById('adminRatingChart');
  if (!canvas || typeof Chart === 'undefined') return;

  applyChartDefaults();
  destroyChart('adminRating');

  const top = (rows || []).slice(0, 6);
  if (!top.length) {
    canvas.getContext('2d').clearRect(0, 0, canvas.width, canvas.height);
    return;
  }

  _charts.adminRating = new Chart(canvas, {
    type: 'bar',
    data: {
      labels: top.map((r) => r.name),
      datasets: [{
        label: 'Average rating',
        data: top.map((r) => r.average),
        backgroundColor: top.map((r) =>
          r.average >= 4 ? '#15803d' : r.average >= 3 ? '#a16207' : '#b91c1c'),
        borderRadius: 5,
        borderSkipped: false,
        barThickness: 20,
      }],
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      animation: { duration: 700, easing: 'easeOutQuart' },
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: (ctx) => ` ${ctx.parsed.y}/5 average` } },
      },
      scales: {
        y: { beginAtZero: true, max: 5, ticks: { stepSize: 1 }, grid: { color: '#e2e8f0' }, border: { display: false } },
        x: { grid: { display: false }, border: { display: false } },
      },
    },
  });
}

async function openAdminAssignModal(complaintId, mode = 'assign') {
  const complaint = _adminComplaintsCache.find(c => c.complaintId === complaintId);
  if (mode === 'assign' && complaint && !canAdminReviewComplaint(complaint)) {
    showToast('This complaint has already been handled by admin');
    return;
  }
  if (mode === 'reassign' && complaint?.status !== 'Assigned') {
    showToast('Only assigned complaints can be reassigned');
    return;
  }
  document.getElementById('assignComplaintId').value = complaintId;
  document.getElementById('assignMode').value = mode;
  const title = document.getElementById('assignModalTitle');
  const submitBtn = document.getElementById('assignSubmitBtn');
  if (title) title.innerHTML = `<i class="bi bi-person-check text-primary-custom me-2"></i>${mode === 'reassign' ? 'Reassign Coordinator' : 'Assign Valid Complaint'}`;
  if (submitBtn) submitBtn.innerHTML = `<i class="bi bi-check-lg me-1"></i> ${mode === 'reassign' ? 'Reassign' : 'Assign'}`;
  await loadMetaOptions();
  const departmentSelect = document.getElementById('assignDepartment');
  setSelectValueIfAvailable(
    departmentSelect,
    complaint?.department && complaint.department !== 'Unassigned' ? complaint.department : ''
  );
  const prioritySelect = document.getElementById('assignPriority');
  if (prioritySelect) prioritySelect.value = complaint?.priority || 'Medium';
  const notes = document.getElementById('assignAdminNotes');
  if (notes) notes.value = complaint?.adminNotes || '';
  new bootstrap.Modal(document.getElementById('assignModal')).show();
}

async function assignComplaint() {
  const complaintId = document.getElementById('assignComplaintId').value;
  const mode = document.getElementById('assignMode')?.value || 'assign';
  const coordinatorId = document.getElementById('assignCoordinator').value;
  const department = document.getElementById('assignDepartment').value;
  const priority = document.getElementById('assignPriority')?.value || 'Medium';
  const adminNotes = document.getElementById('assignAdminNotes').value;

  try {
    await apiFetch(`/api/complaints/${complaintId}/${mode === 'reassign' ? 'reassign' : 'assign'}`, {
      method: 'PUT',
      body: JSON.stringify({ coordinatorId, department, priority, adminNotes }),
    });
    bootstrap.Modal.getInstance(document.getElementById('assignModal')).hide();
    showToast(`Complaint ${complaintId} ${mode === 'reassign' ? 'reassigned' : 'assigned'}`);
    _bustCache();
    _adminCurrentPage = 1;
    loadAdminComplaints();
    loadAdminAnalytics();
  } catch (err) {
    showToast(`${mode === 'reassign' ? 'Reassignment' : 'Assignment'} failed: ${err.message}`);
  }
}

function openAdminRejectModal(complaintId) {
  const complaint = _adminComplaintsCache.find(c => c.complaintId === complaintId);
  if (complaint && !canAdminReviewComplaint(complaint)) {
    showToast('This complaint has already been handled by admin');
    return;
  }
  document.getElementById('rejectComplaintId').value = complaintId;
  document.getElementById('rejectReason').value = '';
  new bootstrap.Modal(document.getElementById('rejectModal')).show();
}

async function rejectComplaint() {
  const complaintId = document.getElementById('rejectComplaintId').value;
  const rejectionReason = document.getElementById('rejectReason').value;

  try {
    await apiFetch(`/api/complaints/${complaintId}/reject`, {
      method: 'PUT',
      body: JSON.stringify({ rejectionReason }),
    });
    bootstrap.Modal.getInstance(document.getElementById('rejectModal')).hide();
    showToast(`Complaint ${complaintId} rejected`);
    _bustCache();
    _adminCurrentPage = 1;
    loadAdminComplaints();
    loadAdminAnalytics();
  } catch (err) {
    showToast(`Rejection failed: ${err.message}`);
  }
}

async function openCoordinatorCreateModal() {
  hideAlert('coordinatorCreateAlert');
  await loadMetaOptions();
  ['newCoordinatorName', 'newCoordinatorEmail', 'newCoordinatorPassword'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  new bootstrap.Modal(document.getElementById('coordinatorCreateModal')).show();
}

async function createCoordinatorAccount(e) {
  e.preventDefault();
  hideAlert('coordinatorCreateAlert');
  const payload = {
    name: document.getElementById('newCoordinatorName')?.value.trim(),
    email: document.getElementById('newCoordinatorEmail')?.value.trim(),
    password: document.getElementById('newCoordinatorPassword')?.value,
    department: document.getElementById('newCoordinatorDepartment')?.value,
  };

  try {
    await apiFetch('/api/admin/coordinators', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    bootstrap.Modal.getInstance(document.getElementById('coordinatorCreateModal'))?.hide();
    await loadMetaOptions();
    showToast('Coordinator account created');
  } catch (err) {
    showAlert('coordinatorCreateAlert', err.message);
  }
}

async function openAdminComplaintModal() {
  hideAlert('adminComplaintAlert');
  await Promise.all([loadMetaOptions(), loadAdminStudents()]);
  document.querySelector('input[name="adminStudentMode"][value="existing"]').checked = true;
  toggleAdminStudentMode();
  [
    'adminManualStudentName',
    'adminManualStudentEmail',
    'adminManualStudentId',
    'adminManualStudentDepartment',
    'adminManualStudentPassword',
    'adminComplaintTitle',
    'adminComplaintDescription',
    'adminStudentSearch',
    'adminComplaintAssignNotes',
  ].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.value = '';
  });
  renderAdminStudentOptions();
  const assignCheck = document.getElementById('adminAssignImmediately');
  if (assignCheck) assignCheck.checked = false;
  toggleAdminImmediateAssign();
  const priority = document.getElementById('adminComplaintPriority');
  if (priority) priority.value = 'Medium';
  new bootstrap.Modal(document.getElementById('adminComplaintModal')).show();
}

function toggleAdminStudentMode() {
  const mode = document.querySelector('input[name="adminStudentMode"]:checked')?.value || 'existing';
  document.getElementById('existingStudentBlock')?.classList.toggle('d-none', mode !== 'existing');
  document.getElementById('manualStudentBlock')?.classList.toggle('d-none', mode !== 'manual');
}

function toggleAdminImmediateAssign() {
  const checked = document.getElementById('adminAssignImmediately')?.checked;
  document.getElementById('adminImmediateAssignBlock')?.classList.toggle('d-none', !checked);
}

async function createAdminComplaint(e) {
  e.preventDefault();
  hideAlert('adminComplaintAlert');
  const studentMode = document.querySelector('input[name="adminStudentMode"]:checked')?.value || 'existing';
  const payload = {
    studentMode,
    studentId: document.getElementById('adminComplaintStudent')?.value,
    manualStudentName: document.getElementById('adminManualStudentName')?.value.trim(),
    manualStudentEmail: document.getElementById('adminManualStudentEmail')?.value.trim(),
    manualStudentId: document.getElementById('adminManualStudentId')?.value.trim(),
    manualStudentDepartment: document.getElementById('adminManualStudentDepartment')?.value.trim(),
    manualStudentPassword: document.getElementById('adminManualStudentPassword')?.value,
    title: document.getElementById('adminComplaintTitle')?.value.trim(),
    category: document.getElementById('adminComplaintCategory')?.value,
    department: document.getElementById('adminComplaintDepartment')?.value,
    priority: document.getElementById('adminComplaintPriority')?.value || 'Medium',
    description: document.getElementById('adminComplaintDescription')?.value.trim(),
    assignImmediately: document.getElementById('adminAssignImmediately')?.checked || false,
    coordinatorId: document.getElementById('adminComplaintCoordinator')?.value,
    adminNotes: document.getElementById('adminComplaintAssignNotes')?.value.trim(),
  };

  try {
    await apiFetch('/api/complaints/admin-create', {
      method: 'POST',
      body: JSON.stringify(payload),
    });
    bootstrap.Modal.getInstance(document.getElementById('adminComplaintModal'))?.hide();
    await loadAdminStudents();
    _adminCurrentPage = 1;
    _bustCache();
    loadAdminComplaints();
    loadAdminAnalytics();
    showToast('Complaint created for student');
  } catch (err) {
    showAlert('adminComplaintAlert', err.message);
  }
}

async function createCategory(e) {
  e.preventDefault();
  const name = document.getElementById('newCategoryName').value.trim();
  if (!name) return;
  try {
    await apiFetch('/api/admin/categories', { method: 'POST', body: JSON.stringify({ name }) });
    document.getElementById('newCategoryName').value = '';
    await loadMetaOptions();
    showToast('Category added');
  } catch (err) {
    showToast(err.message);
  }
}

async function createDepartment(e) {
  e.preventDefault();
  const name = document.getElementById('newDepartmentName').value.trim();
  if (!name) return;
  try {
    await apiFetch('/api/admin/departments', { method: 'POST', body: JSON.stringify({ name }) });
    document.getElementById('newDepartmentName').value = '';
    await loadMetaOptions();
    showToast('Department added');
  } catch (err) {
    showToast(err.message);
  }
}
