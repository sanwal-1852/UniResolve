/**
 * ============================================================
 * UniResolve — demo data seeder
 * ------------------------------------------------------------
 * Generates a full-sized dataset so every dashboard looks like
 * a live system: ~200 complaints spread over all 7 statuses,
 * 8 categories, 8 departments and 4 priorities, with feedback
 * ratings, reopen requests, attachments, anonymous complaints
 * and matching notifications.
 *
 * Every student gets 10-15 complaints and every coordinator a
 * realistic caseload, so tables paginate and charts have shape.
 *
 * The generator is seeded with a fixed value, so running it
 * twice produces exactly the same data — useful for screenshots
 * and for writing up results in a report.
 *
 * Run with:  npm run seed      (WIPES existing data first)
 * ============================================================
 */

require('dotenv').config();
const connectDB = require('./db');
const User = require('../models/User');
const Complaint = require('../models/Complaint');
const Category = require('../models/Category');
const Department = require('../models/Department');
const Notification = require('../models/Notification');
const TEMPLATES = require('./complaint-templates');

/* ------------------------------------------------------------
   Reference data
   ------------------------------------------------------------ */

const CATEGORIES = [
  'Academics', 'Facilities', 'Administration', 'IT Services',
  'Examination', 'Transport', 'Hostel', 'Fee/Accounts',
];

const DEPARTMENTS = [
  'IT Department', 'Examination Department', 'Accounts Department', 'Transport Office',
  'Hostel Office', 'Academic Office', 'Maintenance Department', 'Administration Office',
];

/** Each category is handled by exactly one department. */
const CATEGORY_DEPARTMENT = {
  'Academics': 'Academic Office',
  'Facilities': 'Maintenance Department',
  'Administration': 'Administration Office',
  'IT Services': 'IT Department',
  'Examination': 'Examination Department',
  'Transport': 'Transport Office',
  'Hostel': 'Hostel Office',
  'Fee/Accounts': 'Accounts Department',
};

const COORDINATORS = [
  { key: 'it',        name: 'Bilal Ahmed',    email: 'coordinator@university.edu',    department: 'IT Department' },
  { key: 'maint',     name: 'Imran Shah',     email: 'maintenance@university.edu',    department: 'Maintenance Department' },
  { key: 'exams',     name: 'Ayesha Khan',    email: 'exams@university.edu',          department: 'Examination Department' },
  { key: 'hostel',    name: 'Usman Tariq',    email: 'hostel@university.edu',         department: 'Hostel Office' },
  { key: 'accounts',  name: 'Hina Sethi',     email: 'accounts@university.edu',       department: 'Accounts Department' },
  { key: 'transport', name: 'Kamran Ali',     email: 'transport@university.edu',      department: 'Transport Office' },
  { key: 'academic',  name: 'Nadia Iqbal',    email: 'academics@university.edu',      department: 'Academic Office' },
  { key: 'admin_off', name: 'Faisal Mehmood', email: 'administration@university.edu', department: 'Administration Office' },
];

const DEPARTMENT_COORDINATOR = Object.fromEntries(COORDINATORS.map((c) => [c.department, c.key]));

const STUDENTS = [
  { key: 'sarah',   name: 'Sarah Johnson',   email: 'sarah.j@university.edu',   studentId: 'STU-2024-0042', department: 'Computer Science' },
  { key: 'michael', name: 'Michael Chen',    email: 'michael.c@university.edu', studentId: 'STU-2024-0088', department: 'Information Technology' },
  { key: 'ali',     name: 'Ali Raza',        email: 'ali.raza@university.edu',  studentId: 'STU-2024-0101', department: 'Computer Science' },
  { key: 'fatima',  name: 'Fatima Noor',     email: 'fatima.n@university.edu',  studentId: 'STU-2024-0112', department: 'Business Administration' },
  { key: 'hassan',  name: 'Hassan Mehmood',  email: 'hassan.m@university.edu',  studentId: 'STU-2024-0123', department: 'Electrical Engineering' },
  { key: 'zainab',  name: 'Zainab Ahmed',    email: 'zainab.a@university.edu',  studentId: 'STU-2024-0134', department: 'Computer Science' },
  { key: 'omar',    name: 'Omar Farooq',     email: 'omar.f@university.edu',    studentId: 'STU-2024-0145', department: 'Mechanical Engineering' },
  { key: 'ayeshaS', name: 'Ayesha Siddiqui', email: 'ayesha.s@university.edu',  studentId: 'STU-2023-0209', department: 'English Literature' },
  { key: 'bilalK',  name: 'Bilal Khan',      email: 'bilal.k@university.edu',   studentId: 'STU-2023-0217', department: 'Information Technology' },
  { key: 'maryam',  name: 'Maryam Javed',    email: 'maryam.j@university.edu',  studentId: 'STU-2023-0225', department: 'Business Administration' },
  { key: 'daniyal', name: 'Daniyal Hussain', email: 'daniyal.h@university.edu', studentId: 'STU-2023-0238', department: 'Civil Engineering' },
  { key: 'sana',    name: 'Sana Tariq',      email: 'sana.t@university.edu',    studentId: 'STU-2025-0301', department: 'Computer Science' },
  { key: 'rehan',   name: 'Rehan Qureshi',   email: 'rehan.q@university.edu',   studentId: 'STU-2025-0312', department: 'Electrical Engineering' },
  { key: 'hira',    name: 'Hira Baig',       email: 'hira.b@university.edu',    studentId: 'STU-2025-0324', department: 'Pharmacy' },
  { key: 'talha',   name: 'Talha Iqbal',     email: 'talha.i@university.edu',   studentId: 'STU-2025-0333', department: 'Mechanical Engineering' },
  { key: 'nimra',   name: 'Nimra Waheed',    email: 'nimra.w@university.edu',   studentId: 'STU-2025-0347', department: 'English Literature' },
];

/** Files already present in backend/uploads, reused as demo attachments. */
const SAMPLE_FILES = [
  { originalName: 'evidence-photo.jpeg',     fileName: '1780910159189-pic.jpeg',                mimetype: 'image/jpeg', size: 126551 },
  { originalName: 'course-outline.jpeg',     fileName: '1780910159191-pk_studies.jpeg',         mimetype: 'image/jpeg', size: 127759 },
  { originalName: 'hostel-room.jpg',         fileName: '1782725750293-IMG_20220531_183928.jpg', mimetype: 'image/jpeg', size: 2551540 },
  { originalName: 'lab-condition.jpg',       fileName: '1782725750367-IMG_20220623_215405.jpg', mimetype: 'image/jpeg', size: 2026113 },
  { originalName: 'fee-receipt.jpg',         fileName: '1782725750430-IMG_20221213_162727.jpg', mimetype: 'image/jpeg', size: 625499 },
  { originalName: 'bus-timing-notice.jpg',   fileName: '1782725750450-IMG_20221214_193713.jpg', mimetype: 'image/jpeg', size: 4026980 },
  { originalName: 'result-card.jpg',         fileName: '1782725750587-IMG_20221228_201003.jpg', mimetype: 'image/jpeg', size: 221818 },
];

/* ------------------------------------------------------------
   Generation settings
   ------------------------------------------------------------ */

const COMPLAINTS_PER_STUDENT = [10, 15];   // inclusive range

/** Weighted status funnel — mirrors how a real system looks. */
const STATUS_WEIGHTS = [
  ['Resolved', 36], ['Submitted', 15], ['Assigned', 13],
  ['In Progress', 12], ['Under Review', 8], ['Rejected', 8], ['Reopen Requested', 5],
];

const PRIORITY_WEIGHTS = [['Low', 20], ['Medium', 45], ['High', 25], ['Urgent', 10]];

const PLACEHOLDERS = {
  BLOCK:  ['A', 'B', 'C', 'D', 'E', 'F'],
  ROOM:   ['104', '112', '203', '214', '227', '305', '318', '402', '411'],
  LAB:    ['1', '2', '3', '4', '5'],
  HALL:   ['2', '3', '5', '7', '8', '11'],
  ROUTE:  ['1', '2', '3', '4', '5', '6', '7'],
  FLOOR:  ['ground floor', 'first floor', 'second floor', 'third floor'],
  HOSTEL: ['boys hostel block A', 'boys hostel block B', 'girls hostel block A', 'girls hostel block B'],
  COURSE: ['CS301', 'CS305', 'CS402', 'MATH201', 'MATH301', 'PHY202', 'EE201', 'EE305',
           'ENG204', 'ENG301', 'STAT202', 'LIT204', 'LIT305', 'ME210', 'CE304', 'BBA202'],
};

const FEEDBACK_COMMENTS = {
  5: ['Resolved quickly and properly, thank you.', 'Excellent response from the department.',
      'Very satisfied, the issue was handled professionally.', 'Sorted out the same week I complained.'],
  4: ['Resolved well, though it took a little longer than expected.', 'Good handling overall, thank you.',
      'Happy with the outcome, communication could be slightly better.', 'Issue fixed and staff were helpful.'],
  3: ['Partially resolved, the underlying issue still needs monitoring.', 'Acceptable but the process was slow.',
      'It was addressed but not fully to my satisfaction.', 'Improved for a while but needs follow up.'],
  2: ['Took far too long and required repeated follow ups.', 'The outcome did not really address my concern.',
      'Resolved on paper but the problem largely remains.', 'Poor communication throughout the process.'],
  1: ['The issue was never actually fixed.', 'Very disappointed with how this was handled.',
      'Closed without any real action being taken.', 'No proper explanation was given at any point.'],
};

const REJECTION_REASONS = [
  'This falls outside the scope of the complaint system. Please raise it directly with your departmental office.',
  'This is a duplicate of an existing complaint that is already being actioned by the concerned department.',
  'The request is not supported by current university policy. Please consult the student handbook for alternatives.',
  'Insufficient detail was provided to investigate. Please resubmit with specific dates, locations and evidence.',
  'The matter has already been resolved through a separate request raised earlier this semester.',
];

const REOPEN_REASONS = [
  'The same problem has returned within a few days of this being marked resolved.',
  'The issue was only partially fixed and the main problem is still present.',
  'This was closed without anyone actually inspecting the reported problem.',
  'The problem reappeared as soon as the new semester started.',
];

const COORDINATOR_NOTES = [
  'Inspected on site and the required work has been completed by the department team.',
  'Coordinated with the concerned staff and the matter has now been addressed.',
  'Verified the issue, arranged the necessary repair and confirmed with the student.',
  'Actioned through the departmental process and closed after confirmation.',
];

const IN_PROGRESS_NOTES = [
  'Site visit completed, parts have been ordered and work will begin shortly.',
  'Currently under action with the concerned staff member.',
  'Investigation is underway and an update will follow this week.',
  'Escalated to the relevant team and being actively tracked.',
];

/* ------------------------------------------------------------
   Deterministic RNG (mulberry32) so seeding is reproducible
   ------------------------------------------------------------ */

function makeRng(seed) {
  let a = seed >>> 0;
  return function rng() {
    a |= 0; a = (a + 0x6D2B79F5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const rng = makeRng(20260801);
const randInt = (min, max) => min + Math.floor(rng() * (max - min + 1));
const pick = (arr) => arr[Math.floor(rng() * arr.length)];
const chance = (pct) => rng() * 100 < pct;

function weightedPick(pairs) {
  const total = pairs.reduce((s, [, w]) => s + w, 0);
  let r = rng() * total;
  for (const [value, weight] of pairs) {
    r -= weight;
    if (r <= 0) return value;
  }
  return pairs[pairs.length - 1][0];
}

/** Fisher-Yates using the seeded RNG. */
function shuffle(arr) {
  const a = [...arr];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

function fillPlaceholders(text) {
  return text.replace(/\{([A-Z]+)\}/g, (match, key) =>
    PLACEHOLDERS[key] ? pick(PLACEHOLDERS[key]) : match);
}

/* ------------------------------------------------------------
   Date helpers
   ------------------------------------------------------------ */

const NOW = Date.now();
const HOUR = 3600 * 1000;
const DAY = 24 * HOUR;
const daysAgo = (n) => new Date(NOW - n * DAY);
const addHours = (date, h) => new Date(date.getTime() + h * HOUR);

/* ------------------------------------------------------------
   Complaint generation
   ------------------------------------------------------------ */

/**
 * Every (category, template) pair, used to give each student a
 * shuffled pool so no student ever files the same complaint twice.
 */
function allTemplatePairs() {
  const pairs = [];
  CATEGORIES.forEach((category) => {
    TEMPLATES[category].forEach((template) => pairs.push({ category, template }));
  });
  return pairs;
}

/**
 * Builds one complaint spec for a student. `age` is how many days
 * ago it was submitted; older complaints are biased towards being
 * closed so the history reads naturally.
 */
function buildSpec(student, age, choice) {
  const { category, template } = choice;
  const department = CATEGORY_DEPARTMENT[category];

  // Recent complaints cannot realistically be resolved already.
  let status;
  if (age <= 2) {
    status = weightedPick([['Submitted', 60], ['Under Review', 40]]);
  } else if (age <= 6) {
    status = weightedPick([['Submitted', 25], ['Under Review', 25], ['Assigned', 35], ['In Progress', 15]]);
  } else if (age <= 14) {
    status = weightedPick([['Assigned', 25], ['In Progress', 35], ['Resolved', 25], ['Rejected', 15]]);
  } else {
    status = weightedPick(STATUS_WEIGHTS);
  }

  const spec = {
    student,
    category,
    department,
    title: fillPlaceholders(template.t),
    description: fillPlaceholders(template.d),
    status,
    priority: weightedPick(PRIORITY_WEIGHTS),
    age,
    anonymous: chance(8),
    attachmentCount: chance(22) ? randInt(1, 2) : 0,
  };

  const assigned = ['Assigned', 'In Progress', 'Resolved', 'Reopen Requested'].includes(status);
  if (assigned) spec.coordinatorKey = DEPARTMENT_COORDINATOR[department];

  if (status === 'Rejected') spec.rejectionReason = pick(REJECTION_REASONS);

  /*
   * Timeline offsets in hours from submission. These are computed once
   * here and reused by buildTimeline and resolvedAt, which guarantees
   * every event is strictly later than the one before it.
   */
  const ageHours = age * 24;
  const review = randInt(3, 10);
  const assign = review + randInt(2, 14);
  const progress = assign + randInt(2, 20);
  spec.offsets = { review, assign, progress };

  if (status === 'Resolved' || status === 'Reopen Requested') {
    // Work time scales with priority: urgent things move faster.
    const band = { Urgent: [6, 30], High: [12, 60], Medium: [24, 110], Low: [48, 180] }[spec.priority];
    let work = randInt(band[0], band[1]);
    // Never let resolution land in the future.
    const latest = ageHours - 2;
    if (progress + work > latest) work = Math.max(2, latest - progress);
    spec.offsets.resolve = progress + work;
    spec.resolveHours = spec.offsets.resolve;
  }

  // Feedback on most resolved complaints and a few rejected ones.
  const wantsFeedback = (status === 'Resolved' && chance(72)) || (status === 'Rejected' && chance(30));
  if (wantsFeedback) {
    const rating = status === 'Rejected'
      ? weightedPick([['1', 30], ['2', 45], ['3', 25]])
      : weightedPick([['5', 38], ['4', 32], ['3', 18], ['2', 8], ['1', 4]]);
    const r = Number(rating);
    spec.feedback = {
      rating: r,
      satisfaction: r >= 4 ? 'Satisfied' : r === 3 ? 'Neutral' : 'Unsatisfied',
      comment: pick(FEEDBACK_COMMENTS[r]),
    };
  }

  if (status === 'Reopen Requested') spec.reopenReason = pick(REOPEN_REASONS);

  return spec;
}

/**
 * Timeline consistent with where the complaint ended up. All timestamps
 * come from spec.offsets, which is strictly increasing by construction.
 */
function buildTimeline(spec, ctx) {
  const { admin, coordinator, student } = ctx;
  const created = daysAgo(spec.age);
  const { review, assign, progress, resolve } = spec.offsets;

  const events = [{
    status: 'Submitted', message: 'Complaint submitted by student.',
    actorRole: 'student', actorName: student.name, createdAt: created,
  }];

  if (spec.status === 'Submitted') return events;

  events.push({
    status: 'Under Review', message: 'Complaint is being verified by admin.',
    actorRole: 'admin', actorName: admin.name, createdAt: addHours(created, review),
  });

  if (spec.status === 'Under Review') return events;

  if (spec.status === 'Rejected') {
    events.push({
      status: 'Rejected', message: `Complaint rejected: ${spec.rejectionReason}`,
      actorRole: 'admin', actorName: admin.name, createdAt: addHours(created, assign),
    });
    return events;
  }

  events.push({
    status: 'Assigned', message: `Complaint assigned to ${coordinator.name}.`,
    actorRole: 'admin', actorName: admin.name, createdAt: addHours(created, assign),
  });

  if (spec.status === 'Assigned') return events;

  events.push({
    status: 'In Progress', message: spec.progressNote,
    actorRole: 'coordinator', actorName: coordinator.name, createdAt: addHours(created, progress),
  });

  if (spec.status === 'In Progress') return events;

  const resolvedAt = addHours(created, resolve);
  events.push({
    status: 'Resolved', message: spec.resolutionNote,
    actorRole: 'coordinator', actorName: coordinator.name, createdAt: resolvedAt,
  });

  // Feedback and reopen happen after resolution but never in the future.
  const hoursSinceResolved = Math.max(0, (NOW - resolvedAt.getTime()) / HOUR);

  if (spec.feedback) {
    const delay = Math.min(randInt(2, 40), Math.max(1, hoursSinceResolved - 1));
    events.push({
      status: 'Feedback Submitted', message: `Student submitted ${spec.feedback.rating}/5 feedback.`,
      actorRole: 'student', actorName: student.name, createdAt: addHours(resolvedAt, delay),
    });
    spec.feedbackDelay = delay;
  }

  if (spec.status === 'Reopen Requested') {
    const delay = Math.min(randInt(30, 96), Math.max((spec.feedbackDelay || 0) + 1, hoursSinceResolved - 1));
    events.push({
      status: 'Reopen Requested', message: `Student requested reopening: ${spec.reopenReason}`,
      actorRole: 'student', actorName: student.name, createdAt: addHours(resolvedAt, delay),
    });
    spec.reopenDelay = delay;
  }

  return events;
}

/* ------------------------------------------------------------
   Seeder
   ------------------------------------------------------------ */

const seed = async () => {
  await connectDB();

  await Promise.all([
    User.deleteMany({}), Complaint.deleteMany({}), Category.deleteMany({}),
    Department.deleteMany({}), Notification.deleteMany({}),
  ]);
  console.log('Cleared existing data');

  await Category.insertMany(CATEGORIES.map((name) => ({ name })));
  await Department.insertMany(DEPARTMENTS.map((name) => ({ name })));

  // User.create (not insertMany) so the bcrypt pre-save hook runs.
  const admin = await User.create({
    name: 'Dr. Rashid Mahmood', email: 'admin@university.edu', password: 'admin123',
    studentId: 'ADMIN-001', role: 'admin', department: 'Administration Office',
  });

  const coordinators = {};
  for (let i = 0; i < COORDINATORS.length; i++) {
    const c = COORDINATORS[i];
    coordinators[c.key] = await User.create({
      name: c.name, email: c.email, password: 'coord123',
      studentId: `COORD-${String(i + 1).padStart(3, '0')}`,
      role: 'coordinator', department: c.department,
    });
  }

  const students = {};
  for (const s of STUDENTS) {
    students[s.key] = await User.create({
      name: s.name, email: s.email, password: 'demo123',
      studentId: s.studentId, role: 'student', department: s.department,
    });
  }
  console.log(`Created ${1 + COORDINATORS.length + STUDENTS.length} users`);

  /* ---- Generate specs: every student gets 10-15 complaints ---- */
  const templatePairs = allTemplatePairs();
  const specs = [];

  for (const s of STUDENTS) {
    const count = randInt(COMPLAINTS_PER_STUDENT[0], COMPLAINTS_PER_STUDENT[1]);

    // A private shuffled pool per student, drawn without replacement,
    // so nobody ever files the same complaint twice.
    const pool = shuffle(templatePairs).slice(0, count);

    // Spread this student's complaints across the last ~6 months.
    const ages = shuffle(Array.from({ length: count }, (_, i) =>
      Math.round(2 + (i * (175 / count)) + randInt(0, 6))
    ));

    ages.forEach((age, i) => specs.push(buildSpec(students[s.key], age, pool[i])));
  }

  // Oldest first so complaint IDs read chronologically.
  specs.sort((a, b) => b.age - a.age);

  // Attach notes now that ordering is fixed (keeps RNG stream tidy).
  specs.forEach((spec) => {
    spec.progressNote = pick(IN_PROGRESS_NOTES);
    spec.resolutionNote = pick(COORDINATOR_NOTES);
  });

  const complaintDocs = [];
  const notificationSpecs = [];
  let fileCursor = 0;

  specs.forEach((spec, index) => {
    const student = spec.student;
    const coordinator = spec.coordinatorKey ? coordinators[spec.coordinatorKey] : null;
    const complaintId = `CMP-${1001 + index}`;
    const created = daysAgo(spec.age);
    const isClosed = ['Resolved', 'Reopen Requested'].includes(spec.status);

    // buildTimeline also records feedback/reopen delays, so run it first.
    const timeline = buildTimeline(spec, { admin, coordinator, student });
    const resolvedAt = isClosed ? addHours(created, spec.offsets.resolve) : undefined;

    const attachments = Array.from({ length: spec.attachmentCount }, () => {
      const f = SAMPLE_FILES[fileCursor++ % SAMPLE_FILES.length];
      return { ...f, path: `/uploads/${f.fileName}`, uploadedAt: created };
    });

    const doc = {
      complaintId,
      title: spec.title,
      category: spec.category,
      department: spec.department,
      description: spec.description,
      status: spec.status,
      priority: spec.priority,
      student: student._id,
      studentName: student.name,
      studentEmail: student.email,
      studentId: student.studentId,
      isAnonymous: spec.anonymous,
      attachments,
      timeline,
      createdAt: created,
      updatedAt: timeline[timeline.length - 1].createdAt,
    };

    if (coordinator) {
      doc.assignedCoordinator = coordinator._id;
      doc.assignedCoordinatorName = coordinator.name;
      if (spec.status === 'In Progress') doc.coordinatorNotes = spec.progressNote;
      if (isClosed) doc.coordinatorNotes = spec.resolutionNote;
    }

    if (spec.status !== 'Submitted') {
      doc.adminNotes = 'Verified by the admin office and routed to the concerned department.';
    }
    if (spec.rejectionReason) doc.rejectionReason = spec.rejectionReason;
    if (resolvedAt) doc.resolvedAt = resolvedAt;

    if (spec.feedback) {
      doc.feedback = {
        ...spec.feedback,
        submittedAt: addHours(resolvedAt || created, spec.feedbackDelay ?? 6),
      };
    }

    if (spec.status === 'Reopen Requested') {
      doc.reopenRequest = {
        requested: true, reason: spec.reopenReason, status: 'Pending',
        requestedAt: addHours(resolvedAt, spec.reopenDelay ?? 48), adminResponse: '',
      };
    }

    complaintDocs.push(doc);

    /* Notifications mirror events the student would really have received. */
    const push = (title, message, type, when) =>
      notificationSpecs.push({ user: student._id, complaintId, title, message, type, createdAt: when });

    if (spec.status === 'Under Review') {
      push('Complaint Under Review', `${complaintId} is now being reviewed by the admin office.`, 'info', addHours(created, 6));
    }
    if (coordinator) {
      push('Complaint Assigned', `${complaintId} was accepted and assigned to ${coordinator.name}.`, 'info', addHours(created, 14));
    }
    if (spec.rejectionReason) {
      push('Complaint Rejected', `${complaintId} was rejected. Reason: ${spec.rejectionReason}`, 'danger', addHours(created, 12));
    }
    if (isClosed) {
      push('Complaint Resolved', `${complaintId} has been resolved by the department.`, 'success', resolvedAt);
    }
  });

  const savedComplaints = await Complaint.insertMany(complaintDocs);
  console.log(`Created ${savedComplaints.length} complaints`);

  const byComplaintId = new Map(savedComplaints.map((c) => [c.complaintId, c._id]));
  const notifications = notificationSpecs.map((n) => ({
    user: n.user,
    complaint: byComplaintId.get(n.complaintId),
    complaintId: n.complaintId,
    title: n.title,
    message: n.message,
    type: n.type,
    read: n.createdAt < daysAgo(10),   // anything older than ~10 days is already read
    createdAt: n.createdAt,
  }));
  await Notification.insertMany(notifications);
  console.log(`Created ${notifications.length} notifications`);

  /* ---------------- Summary ---------------- */
  const tally = (list, keyFn) => list.reduce((acc, x) => {
    const k = keyFn(x); acc[k] = (acc[k] || 0) + 1; return acc;
  }, {});

  const byStatus = tally(complaintDocs, (c) => c.status);
  const byCategory = tally(complaintDocs, (c) => c.category);
  const perStudent = tally(complaintDocs, (c) => c.studentName);
  const perCoordinator = tally(complaintDocs.filter((c) => c.assignedCoordinatorName), (c) => c.assignedCoordinatorName);

  const show = (title, obj) => {
    console.log(`\n${title}`);
    Object.entries(obj).sort((a, b) => b[1] - a[1]).forEach(([k, v]) =>
      console.log(`  ${String(v).padStart(3)}  ${k}`));
  };

  show('Complaints by status:', byStatus);
  show('Complaints by category:', byCategory);
  show('Complaints per student:', perStudent);
  show('Caseload per coordinator:', perCoordinator);

  const rated = complaintDocs.filter((c) => c.feedback?.rating);
  const avg = rated.reduce((s, c) => s + c.feedback.rating, 0) / (rated.length || 1);
  console.log('\nExtras:');
  console.log(`  ${rated.length} feedback ratings, average ${avg.toFixed(1)}/5`);
  console.log(`  ${complaintDocs.filter((c) => c.feedback?.rating <= 2).length} low rated (2 or below)`);
  console.log(`  ${complaintDocs.filter((c) => c.reopenRequest?.status === 'Pending').length} pending reopen requests`);
  console.log(`  ${complaintDocs.filter((c) => c.isAnonymous).length} anonymous complaints`);
  console.log(`  ${complaintDocs.filter((c) => c.attachments.length).length} complaints with attachments`);

  console.log('\nDemo accounts:');
  console.log('  Admin        admin@university.edu           admin123');
  console.log('  Coordinator  coordinator@university.edu     coord123   (IT Department)');
  console.log('  Coordinator  maintenance@university.edu     coord123   (Maintenance)');
  console.log('  Coordinator  exams@university.edu           coord123   (Examination)');
  console.log('  Coordinator  hostel@university.edu          coord123   (Hostel Office)');
  console.log('  Coordinator  accounts@university.edu        coord123   (Accounts)');
  console.log('  Coordinator  transport@university.edu       coord123   (Transport)');
  console.log('  Coordinator  academics@university.edu       coord123   (Academic Office)');
  console.log('  Coordinator  administration@university.edu  coord123   (Administration)');
  console.log('  Student      sarah.j@university.edu         demo123');
  console.log('  Student      michael.c@university.edu       demo123    (+ 14 more, all demo123)');

  console.log('\nSeed complete.\n');
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
