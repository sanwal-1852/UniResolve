/**
 * Seed script — populates the database with sample data.
 * Run with: npm run seed
 */
require('dotenv').config();
const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const connectDB = require('./db');
const User = require('../models/User');
const Complaint = require('../models/Complaint');

const seed = async () => {
  await connectDB();

  // Clear existing data
  await User.deleteMany({});
  await Complaint.deleteMany({});
  console.log('🗑   Cleared existing data');

  // Create users
  const salt = await bcrypt.genSalt(10);

  const admin = await User.create({
    name: 'Admin User',
    email: 'admin@university.edu',
    password: await bcrypt.hash('admin123', salt),
    studentId: 'ADMIN-001',
    role: 'admin',
  });

  const sarah = await User.create({
    name: 'Sarah Johnson',
    email: 'sarah.j@university.edu',
    password: await bcrypt.hash('demo123', salt),
    studentId: 'STU-2024-0042',
    role: 'student',
  });

  const otherStudents = await User.insertMany([
    {
      name: 'Michael Chen',
      email: 'michael.c@university.edu',
      password: await bcrypt.hash('demo123', salt),
      studentId: 'STU-2024-0088',
      role: 'student',
    },
    {
      name: 'Emily Davis',
      email: 'emily.d@university.edu',
      password: await bcrypt.hash('demo123', salt),
      studentId: 'STU-2024-0115',
      role: 'student',
    },
    {
      name: 'James Wilson',
      email: 'james.w@university.edu',
      password: await bcrypt.hash('demo123', salt),
      studentId: 'STU-2024-0067',
      role: 'student',
    },
    {
      name: 'Anna Martinez',
      email: 'anna.m@university.edu',
      password: await bcrypt.hash('demo123', salt),
      studentId: 'STU-2024-0201',
      role: 'student',
    },
  ]);

  const [michael, emily, james, anna] = otherStudents;

  // Create complaints
  await Complaint.insertMany([
    {
      complaintId: 'CMP-1001',
      title: 'Library air conditioning not working',
      category: 'Facilities',
      description:
        'The air conditioning in the main library building (2nd floor) has not been working for over a week. It makes studying very uncomfortable, especially during afternoon hours.',
      status: 'Pending',
      student: sarah._id,
      studentName: sarah.name,
      studentEmail: sarah.email,
      studentId: sarah.studentId,
      createdAt: new Date('2026-03-25'),
    },
    {
      complaintId: 'CMP-1002',
      title: 'Incorrect grade posted for CS301',
      category: 'Academics',
      description:
        'My final grade for CS301 Data Structures was posted as a C, but my calculated grade based on assignment scores and exams should be a B+. I have screenshots of all my grades on the portal.',
      status: 'In Progress',
      student: michael._id,
      studentName: michael.name,
      studentEmail: michael.email,
      studentId: michael.studentId,
      createdAt: new Date('2026-03-22'),
    },
    {
      complaintId: 'CMP-1003',
      title: 'Financial aid disbursement delayed',
      category: 'Administration',
      description:
        'My financial aid for Spring 2026 has not been disbursed yet, despite being approved in January. I have contacted the financial aid office twice with no resolution.',
      status: 'Pending',
      student: emily._id,
      studentName: emily.name,
      studentEmail: emily.email,
      studentId: emily.studentId,
      createdAt: new Date('2026-03-20'),
    },
    {
      complaintId: 'CMP-1004',
      title: 'Broken lab equipment in Chemistry lab',
      category: 'Facilities',
      description:
        'Several microscopes in Chemistry Lab Room 204 have broken lenses. This has been an issue for the past two weeks and is affecting our lab experiments.',
      status: 'Resolved',
      student: james._id,
      studentName: james.name,
      studentEmail: james.email,
      studentId: james.studentId,
      adminNotes: 'Equipment has been repaired. New microscopes ordered for Room 204.',
      createdAt: new Date('2026-03-18'),
    },
    {
      complaintId: 'CMP-1005',
      title: 'Course registration system errors',
      category: 'Administration',
      description:
        'The online course registration portal keeps showing "session expired" errors during peak registration hours. I was unable to register for two required courses before they filled up.',
      status: 'In Progress',
      student: anna._id,
      studentName: anna.name,
      studentEmail: anna.email,
      studentId: anna.studentId,
      createdAt: new Date('2026-03-15'),
    },
  ]);

  console.log('🌱  Seed data inserted successfully');
  console.log('\nDemo accounts:');
  console.log('  Admin  → admin@university.edu  / admin123');
  console.log('  Student→ sarah.j@university.edu / demo123');

  await mongoose.disconnect();
  process.exit(0);
};

seed().catch((err) => {
  console.error(err);
  process.exit(1);
});
