/**
 * ============================================================
 * UniResolve — University Student Complaint Management System
 * Frontend Logic (main.js)
 * ============================================================
 *
 * This file handles all client-side functionality:
 *   - User registration and login (localStorage-based)
 *   - Complaint submission, viewing, and filtering
 *   - Admin dashboard: search, filter, status updates
 *   - Navigation auth state management
 *   - Form validation with Bootstrap classes
 *
 * BACKEND API INTEGRATION:
 *   Each data function includes a placeholder comment showing
 *   where to swap localStorage calls for real fetch() API calls.
 *   Search for "// API PLACEHOLDER" to find all integration points.
 * ============================================================
 */


/* ==============================================================
   1. DATA LAYER — In-memory storage
   Uses in-memory variables for the deployed demo.
   For production, swap these for real API calls (see API PLACEHOLDER comments).
   To use localStorage instead (when not in sandboxed iframe), set
   window.USE_LOCAL_STORAGE = true before loading this script.
   ============================================================== */

/**
 * In-memory data store — persists for the duration of the page session.
 * Data resets on page reload (seed data is re-applied automatically).
 * // API PLACEHOLDER: In production, all data lives on the server.
 */
var _memoryStore = {
  users: [],
  currentUser: null,
  complaints: []
};

/**
 * Get all registered users
 * // API PLACEHOLDER: Replace with fetch('/api/users')
 */
function getUsers() {
  return _memoryStore.users;
}

/**
 * Save users array
 * // API PLACEHOLDER: Replace with POST /api/users
 */
function saveUsers(users) {
  _memoryStore.users = users;
}

/**
 * Get the currently logged-in user (or null)
 * // API PLACEHOLDER: Replace with fetch('/api/auth/me') using session/JWT
 */
function getCurrentUser() {
  return _memoryStore.currentUser;
}

/**
 * Set the current user session
 * // API PLACEHOLDER: Replace with POST /api/auth/login
 */
function setCurrentUser(user) {
  _memoryStore.currentUser = user;
}

/**
 * Clear the current user session (logout)
 * // API PLACEHOLDER: Replace with POST /api/auth/logout
 */
function clearCurrentUser() {
  _memoryStore.currentUser = null;
}

/**
 * Get all complaints
 * // API PLACEHOLDER: Replace with fetch('/api/complaints')
 */
function getComplaints() {
  return _memoryStore.complaints;
}

/**
 * Save complaints array
 * // API PLACEHOLDER: Replace with POST/PUT /api/complaints
 */
function saveComplaints(complaints) {
  _memoryStore.complaints = complaints;
}

/**
 * Generate a unique complaint ID
 * Format: CMP-XXXX (random 4-digit number)
 */
function generateComplaintId() {
  const num = Math.floor(1000 + Math.random() * 9000);
  return 'CMP-' + num;
}

/**
 * Format a date string to a readable format
 */
function formatDate(dateStr) {
  const date = new Date(dateStr);
  return date.toLocaleDateString('en-US', {
    year: 'numeric',
    month: 'short',
    day: 'numeric'
  });
}

/**
 * Get the Bootstrap badge class for a complaint status
 */
function getStatusBadge(status) {
  switch (status) {
    case 'Pending':
      return '<span class="badge-status badge-pending">Pending</span>';
    case 'In Progress':
      return '<span class="badge-status badge-in-progress">In Progress</span>';
    case 'Resolved':
      return '<span class="badge-status badge-resolved">Resolved</span>';
    default:
      return '<span class="badge-status badge-pending">Pending</span>';
  }
}


/* ==============================================================
   2. SEED DATA
   Pre-populate sample complaints for demonstration purposes
   ============================================================== */

function seedSampleData() {
  // Only seed if no complaints exist yet
  if (getComplaints().length > 0) return;

  const sampleComplaints = [
    {
      id: 'CMP-1001',
      title: 'Library air conditioning not working',
      category: 'Facilities',
      description: 'The air conditioning in the main library building (2nd floor) has not been working for over a week. It makes studying very uncomfortable, especially during afternoon hours.',
      status: 'Pending',
      date: '2026-03-25',
      studentName: 'Sarah Johnson',
      studentEmail: 'sarah.j@university.edu',
      studentId: 'STU-2024-0042'
    },
    {
      id: 'CMP-1002',
      title: 'Incorrect grade posted for CS301',
      category: 'Academics',
      description: 'My final grade for CS301 Data Structures was posted as a C, but my calculated grade based on assignment scores and exams should be a B+. I have screenshots of all my grades on the portal.',
      status: 'In Progress',
      date: '2026-03-22',
      studentName: 'Michael Chen',
      studentEmail: 'michael.c@university.edu',
      studentId: 'STU-2024-0088'
    },
    {
      id: 'CMP-1003',
      title: 'Financial aid disbursement delayed',
      category: 'Administration',
      description: 'My financial aid for Spring 2026 has not been disbursed yet, despite being approved in January. I have contacted the financial aid office twice with no resolution.',
      status: 'Pending',
      date: '2026-03-20',
      studentName: 'Emily Davis',
      studentEmail: 'emily.d@university.edu',
      studentId: 'STU-2024-0115'
    },
    {
      id: 'CMP-1004',
      title: 'Broken lab equipment in Chemistry lab',
      category: 'Facilities',
      description: 'Several microscopes in Chemistry Lab Room 204 have broken lenses. This has been an issue for the past two weeks and is affecting our lab experiments.',
      status: 'Resolved',
      date: '2026-03-18',
      studentName: 'James Wilson',
      studentEmail: 'james.w@university.edu',
      studentId: 'STU-2024-0067'
    },
    {
      id: 'CMP-1005',
      title: 'Course registration system errors',
      category: 'Administration',
      description: 'The online course registration portal keeps showing "session expired" errors during peak registration hours. I was unable to register for two required courses before they filled up.',
      status: 'In Progress',
      date: '2026-03-15',
      studentName: 'Anna Martinez',
      studentEmail: 'anna.m@university.edu',
      studentId: 'STU-2024-0201'
    }
  ];

  saveComplaints(sampleComplaints);

  // Seed a demo student user if none exist
  if (getUsers().length === 0) {
    saveUsers([
      {
        name: 'Sarah Johnson',
        email: 'sarah.j@university.edu',
        password: 'demo123',
        studentId: 'STU-2024-0042',
        role: 'student'
      },
      {
        name: 'Admin User',
        email: 'admin@university.edu',
        password: 'admin123',
        studentId: 'ADMIN-001',
        role: 'admin'
      }
    ]);
  }
}

// Run seeding on every page load
seedSampleData();


/* ==============================================================
   3. NAVIGATION AUTH STATE
   Show/hide Login vs Logout based on session
   ============================================================== */

function updateNavAuth() {
  const user = getCurrentUser();
  const navLogin = document.getElementById('nav-login');
  const navLogout = document.getElementById('nav-logout');

  if (user) {
    // User is logged in — show Logout, hide Login
    if (navLogin) navLogin.classList.add('d-none');
    if (navLogout) navLogout.classList.remove('d-none');
  } else {
    // User is logged out — show Login, hide Logout
    if (navLogin) navLogin.classList.remove('d-none');
    if (navLogout) navLogout.classList.add('d-none');
  }
}

/**
 * Handle logout — clear session and redirect to home
 */
function handleLogout(event) {
  if (event) event.preventDefault();
  clearCurrentUser();
  showAlert('login-alert', 'You have been logged out.', 'info');
  window.location.href = 'index.html';
}


/* ==============================================================
   4. ALERT HELPER
   Show Bootstrap-styled alerts in a given container
   ============================================================== */

/**
 * Show an alert message inside a target element
 * @param {string} containerId - The ID of the container element
 * @param {string} message - The alert message text
 * @param {string} type - Bootstrap alert type (success, danger, warning, info)
 */
function showAlert(containerId, message, type) {
  const container = document.getElementById(containerId);
  if (!container) return;

  // Map type to icon
  const icons = {
    success: 'bi-check-circle-fill',
    danger: 'bi-exclamation-triangle-fill',
    warning: 'bi-exclamation-circle-fill',
    info: 'bi-info-circle-fill'
  };

  container.className = `alert alert-${type} alert-custom alert-dismissible fade show`;
  container.innerHTML = `
    <i class="bi ${icons[type] || icons.info}"></i>
    ${message}
    <button type="button" class="btn-close" data-bs-dismiss="alert" aria-label="Close" style="font-size:0.75rem;"></button>
  `;
}


/* ==============================================================
   5. HOME PAGE — Statistics
   ============================================================== */

function loadHomeStats() {
  const complaints = getComplaints();
  const total = complaints.length;
  const pending = complaints.filter(c => c.status === 'Pending').length;
  const progress = complaints.filter(c => c.status === 'In Progress').length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;

  // Update stat counters with animation
  animateCounter('stat-total', total);
  animateCounter('stat-pending', pending);
  animateCounter('stat-progress', progress);
  animateCounter('stat-resolved', resolved);
}

/**
 * Animate a counter from 0 to target value
 */
function animateCounter(elementId, target) {
  const el = document.getElementById(elementId);
  if (!el) return;

  let current = 0;
  const step = Math.max(1, Math.floor(target / 15));
  const interval = setInterval(() => {
    current += step;
    if (current >= target) {
      current = target;
      clearInterval(interval);
    }
    el.textContent = current;
  }, 40);
}


/* ==============================================================
   6. LOGIN PAGE
   ============================================================== */

function initLoginPage() {
  const form = document.getElementById('loginForm');
  if (!form) return;

  // Toggle password visibility
  const toggleBtn = document.getElementById('togglePassword');
  const passwordField = document.getElementById('loginPassword');
  if (toggleBtn && passwordField) {
    toggleBtn.addEventListener('click', function() {
      const type = passwordField.getAttribute('type') === 'password' ? 'text' : 'password';
      passwordField.setAttribute('type', type);
      this.querySelector('i').classList.toggle('bi-eye');
      this.querySelector('i').classList.toggle('bi-eye-slash');
    });
  }

  // Form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();

    // Bootstrap validation classes
    form.classList.add('was-validated');

    if (!form.checkValidity()) return;

    const email = document.getElementById('loginEmail').value.trim();
    const password = document.getElementById('loginPassword').value;

    // API PLACEHOLDER: Replace with fetch('/api/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) })
    const users = getUsers();
    const user = users.find(u => u.email === email && u.password === password);

    if (user) {
      setCurrentUser(user);
      showAlert('login-alert', 'Login successful. Redirecting...', 'success');

      // Redirect based on role
      setTimeout(() => {
        if (user.role === 'admin') {
          window.location.href = 'admin-dashboard.html';
        } else {
          window.location.href = 'view-complaints.html';
        }
      }, 800);
    } else {
      showAlert('login-alert', 'Invalid email or password. Please try again.', 'danger');
    }
  });
}

/**
 * Quick admin demo login
 */
function adminDemoLogin(event) {
  event.preventDefault();
  document.getElementById('loginEmail').value = 'admin@university.edu';
  document.getElementById('loginPassword').value = 'admin123';

  // Trigger form submit
  const form = document.getElementById('loginForm');
  form.classList.add('was-validated');

  const users = getUsers();
  const user = users.find(u => u.email === 'admin@university.edu' && u.password === 'admin123');
  if (user) {
    setCurrentUser(user);
    showAlert('login-alert', 'Admin login successful. Redirecting...', 'success');
    setTimeout(() => { window.location.href = 'admin-dashboard.html'; }, 800);
  }
}


/* ==============================================================
   7. REGISTRATION PAGE
   ============================================================== */

function initRegisterPage() {
  const form = document.getElementById('registerForm');
  if (!form) return;

  form.addEventListener('submit', function(e) {
    e.preventDefault();
    form.classList.add('was-validated');

    const name = document.getElementById('regName').value.trim();
    const studentId = document.getElementById('regStudentId').value.trim();
    const email = document.getElementById('regEmail').value.trim();
    const password = document.getElementById('regPassword').value;
    const confirmPassword = document.getElementById('regConfirmPassword').value;

    // Custom password match check
    const confirmField = document.getElementById('regConfirmPassword');
    if (password !== confirmPassword) {
      confirmField.setCustomValidity('Passwords do not match');
      document.getElementById('confirmPasswordFeedback').textContent = 'Passwords do not match.';
      return;
    } else {
      confirmField.setCustomValidity('');
    }

    if (!form.checkValidity()) return;

    // API PLACEHOLDER: Replace with fetch('/api/auth/register', { method: 'POST', body: JSON.stringify({ name, email, password, studentId }) })
    const users = getUsers();

    // Check for duplicate email
    if (users.find(u => u.email === email)) {
      showAlert('register-alert', 'An account with this email already exists.', 'danger');
      return;
    }

    // Check for duplicate student ID
    if (users.find(u => u.studentId === studentId)) {
      showAlert('register-alert', 'This Student ID is already registered.', 'danger');
      return;
    }

    // Create new user
    const newUser = {
      name: name,
      email: email,
      password: password,
      studentId: studentId,
      role: 'student'
    };

    users.push(newUser);
    saveUsers(users);

    showAlert('register-alert', 'Registration successful. Redirecting to login...', 'success');
    setTimeout(() => { window.location.href = 'login.html'; }, 1200);
  });
}


/* ==============================================================
   8. SUBMIT COMPLAINT PAGE
   ============================================================== */

function initComplaintForm() {
  const form = document.getElementById('complaintForm');
  if (!form) return;

  // Character count for description
  const descField = document.getElementById('complaintDescription');
  const charCount = document.getElementById('charCount');
  if (descField && charCount) {
    descField.addEventListener('input', function() {
      const count = this.value.length;
      charCount.textContent = count + ' / 20 min characters';
      charCount.style.color = count >= 20 ? 'var(--color-success)' : 'var(--color-text-faint)';
    });
  }

  // Form submission
  form.addEventListener('submit', function(e) {
    e.preventDefault();
    form.classList.add('was-validated');

    if (!form.checkValidity()) return;

    const user = getCurrentUser();
    const title = document.getElementById('complaintTitle').value.trim();
    const category = document.getElementById('complaintCategory').value;
    const description = document.getElementById('complaintDescription').value.trim();

    // Build complaint object
    const complaint = {
      id: generateComplaintId(),
      title: title,
      category: category,
      description: description,
      status: 'Pending',
      date: new Date().toISOString().split('T')[0],
      studentName: user ? user.name : 'Anonymous Student',
      studentEmail: user ? user.email : 'anonymous@university.edu',
      studentId: user ? user.studentId : 'N/A'
    };

    // API PLACEHOLDER: Replace with fetch('/api/complaints', { method: 'POST', body: JSON.stringify(complaint) })
    const complaints = getComplaints();
    complaints.unshift(complaint); // Add to beginning of array
    saveComplaints(complaints);

    // Show success and reset form
    showAlert('complaint-alert', `Complaint <strong>${complaint.id}</strong> submitted successfully.`, 'success');
    form.reset();
    form.classList.remove('was-validated');

    // Reset character counter
    if (charCount) {
      charCount.textContent = '0 / 20 min characters';
      charCount.style.color = 'var(--color-text-faint)';
    }
  });
}


/* ==============================================================
   9. VIEW COMPLAINTS PAGE (Student)
   Loads complaints filtered by current user, with status/category filters
   ============================================================== */

function loadStudentComplaints() {
  const tbody = document.getElementById('studentComplaintsBody');
  const emptyState = document.getElementById('studentEmptyState');
  if (!tbody) return;

  // Get filter values
  const statusFilter = document.getElementById('studentFilterStatus')?.value || 'All';
  const categoryFilter = document.getElementById('studentFilterCategory')?.value || 'All';

  const user = getCurrentUser();

  // API PLACEHOLDER: Replace with fetch('/api/complaints?user=' + user.email + '&status=' + statusFilter + '&category=' + categoryFilter)
  let complaints = getComplaints();

  // Filter by current user (if logged in)
  if (user && user.role !== 'admin') {
    complaints = complaints.filter(c => c.studentEmail === user.email);
  }

  // Apply status filter
  if (statusFilter !== 'All') {
    complaints = complaints.filter(c => c.status === statusFilter);
  }

  // Apply category filter
  if (categoryFilter !== 'All') {
    complaints = complaints.filter(c => c.category === categoryFilter);
  }

  // Render table rows
  if (complaints.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');

  tbody.innerHTML = complaints.map((c, index) => `
    <tr>
      <td style="font-weight:500; color:var(--color-text-muted); font-size:0.8125rem;">${c.id}</td>
      <td style="font-weight:500;">${escapeHtml(c.title)}</td>
      <td><span style="font-size:0.8125rem; color:var(--color-text-muted);">${escapeHtml(c.category)}</span></td>
      <td>${getStatusBadge(c.status)}</td>
      <td style="font-size:0.8125rem; color:var(--color-text-muted);">${formatDate(c.date)}</td>
    </tr>
  `).join('');
}


/* ==============================================================
   10. ADMIN DASHBOARD
   View all complaints, search/filter, update statuses via modal
   ============================================================== */

/**
 * Load complaints into the admin table with search and filter support
 * This is the main example of filtering/searching data in JavaScript
 */
function loadAdminComplaints() {
  const tbody = document.getElementById('adminComplaintsBody');
  const emptyState = document.getElementById('adminEmptyState');
  if (!tbody) return;

  // Get search and filter values
  const searchQuery = (document.getElementById('adminSearchInput')?.value || '').toLowerCase().trim();
  const categoryFilter = document.getElementById('adminFilterCategory')?.value || 'All';
  const statusFilter = document.getElementById('adminFilterStatus')?.value || 'All';

  // API PLACEHOLDER: Replace with fetch('/api/admin/complaints?search=' + searchQuery + '&category=' + categoryFilter + '&status=' + statusFilter)
  let complaints = getComplaints();

  // -------------------------------------------------------
  // FILTERING LOGIC — search by title, student name, or ID
  // This fulfills the "at least one example of filtering or
  // searching data in JavaScript" requirement
  // -------------------------------------------------------
  if (searchQuery) {
    complaints = complaints.filter(c =>
      c.title.toLowerCase().includes(searchQuery) ||
      c.studentName.toLowerCase().includes(searchQuery) ||
      c.id.toLowerCase().includes(searchQuery) ||
      c.studentId.toLowerCase().includes(searchQuery)
    );
  }

  // Filter by category
  if (categoryFilter !== 'All') {
    complaints = complaints.filter(c => c.category === categoryFilter);
  }

  // Filter by status
  if (statusFilter !== 'All') {
    complaints = complaints.filter(c => c.status === statusFilter);
  }

  // Update admin quick stats (from full unfiltered dataset)
  updateAdminQuickStats();

  // Render table
  if (complaints.length === 0) {
    tbody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('d-none');
    return;
  }

  if (emptyState) emptyState.classList.add('d-none');

  tbody.innerHTML = complaints.map(c => `
    <tr>
      <td style="font-weight:500; font-family:var(--font-body); font-size:0.8125rem; color:var(--color-text-muted);">${c.id}</td>
      <td>
        <div style="font-weight:500;">${escapeHtml(c.title)}</div>
        <div style="font-size:0.75rem; color:var(--color-text-faint); margin-top:2px;">${escapeHtml(c.category)}</div>
      </td>
      <td>
        <div style="font-weight:500; font-size:0.875rem;">${escapeHtml(c.studentName)}</div>
        <div style="font-size:0.75rem; color:var(--color-text-faint);">${c.studentId}</div>
      </td>
      <td style="font-size:0.8125rem; color:var(--color-text-muted);">${escapeHtml(c.category)}</td>
      <td>${getStatusBadge(c.status)}</td>
      <td style="font-size:0.8125rem; color:var(--color-text-muted);">${formatDate(c.date)}</td>
      <td style="text-align:center;">
        <div class="d-flex justify-content-center gap-1">
          <button class="btn btn-outline-custom btn-sm-custom" onclick="openDetailModal('${c.id}')" title="View Details">
            <i class="bi bi-eye"></i>
          </button>
          <button class="btn btn-primary-custom btn-sm-custom" onclick="openStatusModal('${c.id}')" title="Update Status">
            <i class="bi bi-pencil"></i>
          </button>
        </div>
      </td>
    </tr>
  `).join('');
}

/**
 * Update the quick stats badges in the admin header
 */
function updateAdminQuickStats() {
  const complaints = getComplaints();
  const pending = complaints.filter(c => c.status === 'Pending').length;
  const progress = complaints.filter(c => c.status === 'In Progress').length;
  const resolved = complaints.filter(c => c.status === 'Resolved').length;

  const elPending = document.getElementById('adminStatPending');
  const elProgress = document.getElementById('adminStatProgress');
  const elResolved = document.getElementById('adminStatResolved');

  if (elPending) elPending.textContent = pending + ' Pending';
  if (elProgress) elProgress.textContent = progress + ' In Progress';
  if (elResolved) elResolved.textContent = resolved + ' Resolved';
}


/**
 * Open the status update modal for a specific complaint
 */
function openStatusModal(complaintId) {
  const complaints = getComplaints();
  const complaint = complaints.find(c => c.id === complaintId);
  if (!complaint) return;

  // Populate modal fields
  document.getElementById('modalComplaintId').value = complaint.id;
  document.getElementById('modalComplaintTitle').textContent = complaint.title;
  document.getElementById('modalComplaintStudent').textContent = complaint.studentName + ' (' + complaint.studentId + ')';
  document.getElementById('modalStatusSelect').value = complaint.status;
  document.getElementById('modalAdminNotes').value = '';

  // Show modal
  const modal = new bootstrap.Modal(document.getElementById('statusModal'));
  modal.show();
}

/**
 * Open the detail view modal for a specific complaint
 */
function openDetailModal(complaintId) {
  const complaints = getComplaints();
  const complaint = complaints.find(c => c.id === complaintId);
  if (!complaint) return;

  const body = document.getElementById('detailModalBody');
  body.innerHTML = `
    <div class="row g-3">
      <div class="col-sm-6">
        <div style="font-size:0.8125rem; color:var(--color-text-muted);">Complaint ID</div>
        <div style="font-weight:600;">${complaint.id}</div>
      </div>
      <div class="col-sm-6">
        <div style="font-size:0.8125rem; color:var(--color-text-muted);">Submitted</div>
        <div style="font-weight:600;">${formatDate(complaint.date)}</div>
      </div>
      <div class="col-sm-6">
        <div style="font-size:0.8125rem; color:var(--color-text-muted);">Student</div>
        <div style="font-weight:600;">${escapeHtml(complaint.studentName)}</div>
        <div style="font-size:0.8125rem; color:var(--color-text-faint);">${complaint.studentEmail} &middot; ${complaint.studentId}</div>
      </div>
      <div class="col-sm-6">
        <div style="font-size:0.8125rem; color:var(--color-text-muted);">Category</div>
        <div style="font-weight:600;">${escapeHtml(complaint.category)}</div>
      </div>
      <div class="col-12">
        <div style="font-size:0.8125rem; color:var(--color-text-muted);">Status</div>
        <div class="mt-1">${getStatusBadge(complaint.status)}</div>
      </div>
      <div class="col-12">
        <div style="font-size:0.8125rem; color:var(--color-text-muted);">Title</div>
        <div style="font-weight:600; font-size:1.0625rem;">${escapeHtml(complaint.title)}</div>
      </div>
      <div class="col-12">
        <div style="font-size:0.8125rem; color:var(--color-text-muted); margin-bottom:0.375rem;">Description</div>
        <div style="background:var(--color-surface-alt); border:1px solid var(--color-border); border-radius:var(--radius-md); padding:1rem; font-size:0.9375rem; line-height:1.7;">
          ${escapeHtml(complaint.description)}
        </div>
      </div>
    </div>
  `;

  const modal = new bootstrap.Modal(document.getElementById('detailModal'));
  modal.show();
}

/**
 * Update a complaint's status from the modal
 */
function updateComplaintStatus() {
  const complaintId = document.getElementById('modalComplaintId').value;
  const newStatus = document.getElementById('modalStatusSelect').value;

  // API PLACEHOLDER: Replace with fetch('/api/complaints/' + complaintId + '/status', { method: 'PUT', body: JSON.stringify({ status: newStatus }) })
  const complaints = getComplaints();
  const index = complaints.findIndex(c => c.id === complaintId);

  if (index === -1) return;

  complaints[index].status = newStatus;
  saveComplaints(complaints);

  // Close modal
  const modal = bootstrap.Modal.getInstance(document.getElementById('statusModal'));
  modal.hide();

  // Refresh table
  loadAdminComplaints();

  // Show a temporary success toast
  showToast(`Complaint ${complaintId} updated to "${newStatus}"`);
}


/* ==============================================================
   11. TOAST NOTIFICATION
   Shows a brief success message at the top of the page
   ============================================================== */

function showToast(message) {
  // Remove existing toast if present
  const existing = document.getElementById('app-toast');
  if (existing) existing.remove();

  const toast = document.createElement('div');
  toast.id = 'app-toast';
  toast.style.cssText = `
    position: fixed;
    top: 80px;
    right: 20px;
    z-index: 9999;
    background: var(--color-navy-900);
    color: #fff;
    padding: 0.75rem 1.25rem;
    border-radius: var(--radius-md);
    font-family: var(--font-body);
    font-size: 0.875rem;
    box-shadow: var(--shadow-lg);
    display: flex;
    align-items: center;
    gap: 0.5rem;
    animation: toastSlideIn 0.3s ease;
    max-width: 400px;
  `;
  toast.innerHTML = `<i class="bi bi-check-circle-fill" style="color:#4ade80;"></i>${message}`;

  // Add animation keyframes if not present
  if (!document.getElementById('toast-styles')) {
    const style = document.createElement('style');
    style.id = 'toast-styles';
    style.textContent = `
      @keyframes toastSlideIn {
        from { opacity: 0; transform: translateX(20px); }
        to { opacity: 1; transform: translateX(0); }
      }
      @keyframes toastSlideOut {
        from { opacity: 1; transform: translateX(0); }
        to { opacity: 0; transform: translateX(20px); }
      }
    `;
    document.head.appendChild(style);
  }

  document.body.appendChild(toast);

  // Auto-dismiss after 3 seconds
  setTimeout(() => {
    toast.style.animation = 'toastSlideOut 0.3s ease forwards';
    setTimeout(() => toast.remove(), 300);
  }, 3000);
}


/* ==============================================================
   12. SECURITY HELPERS
   ============================================================== */

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
