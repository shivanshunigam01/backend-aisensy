const {
  HrOrganization,
  HrUser,
  HrEmployee,
  HrDepartment,
  HrDesignation,
  HrAttendance,
  HrLeaveType,
  HrLeaveRequest,
  HrAnnouncement,
  toPublicOrg,
  toPublicUser,
  toPublicEmployee
} = require('../models');
const { ROLES } = require('../constants');
const { slugify, todayISO, daysBetween, isHrAdminRole } = require('../utils/helpers');
const { hashPassword, verifyPassword, signHrToken } = require('../middleware/auth');

async function seedDefaultLeaveTypes(organizationId) {
  const defaults = [
    { name: 'Casual Leave', code: 'CL', daysPerYear: 12 },
    { name: 'Sick Leave', code: 'SL', daysPerYear: 12 },
    { name: 'Earned Leave', code: 'EL', daysPerYear: 15 }
  ];
  for (const d of defaults) {
    await HrLeaveType.findOneAndUpdate(
      { organizationId, code: d.code },
      { ...d, organizationId, isPaid: true, isActive: true },
      { upsert: true, new: true, setDefaultsOnInsert: true }
    );
  }
}

async function registerOrg({ organizationName, name, email, password }) {
  if (!organizationName || !name || !email || !password) {
    const err = new Error('organizationName, name, email and password are required.');
    err.status = 400;
    throw err;
  }
  const existing = await HrUser.findOne({ email: email.toLowerCase() });
  if (existing) {
    const err = new Error('Email already registered.');
    err.status = 409;
    throw err;
  }

  const org = await HrOrganization.create({
    name: organizationName,
    slug: slugify(organizationName)
  });

  const user = await HrUser.create({
    organizationId: org._id,
    name,
    email: email.toLowerCase(),
    passwordHash: await hashPassword(password),
    role: ROLES.SUPER_ADMIN
  });

  const [firstName, ...rest] = name.trim().split(/\s+/);
  const employee = await HrEmployee.create({
    organizationId: org._id,
    userId: user._id,
    employeeCode: 'EMP001',
    firstName: firstName || name,
    lastName: rest.join(' ') || 'Admin',
    employmentStatus: 'active',
    dateOfJoining: todayISO()
  });

  user.employeeId = employee._id.toString();
  await user.save();
  await seedDefaultLeaveTypes(org._id);

  const token = signHrToken(user);
  return {
    token,
    user: toPublicUser(user, org.name),
    organization: toPublicOrg(org),
    employee: toPublicEmployee(employee)
  };
}

async function login({ email, password }) {
  const user = await HrUser.findOne({ email: String(email || '').toLowerCase() }).select('+passwordHash');
  if (!user || !user.isActive) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }
  const okPass = await verifyPassword(password, user.passwordHash);
  if (!okPass) {
    const err = new Error('Invalid email or password.');
    err.status = 401;
    throw err;
  }
  user.lastLogin = new Date();
  await user.save();
  const org = await HrOrganization.findById(user.organizationId);
  const employee = await HrEmployee.findOne({ userId: user._id });
  return {
    token: signHrToken(user),
    user: toPublicUser(user, org?.name),
    organization: toPublicOrg(org),
    employee: employee ? toPublicEmployee(employee) : null
  };
}

async function platformOverview() {
  const [organizations, employees, users, leavePending] = await Promise.all([
    HrOrganization.countDocuments(),
    HrEmployee.countDocuments({ employmentStatus: { $in: ['active', 'probation'] } }),
    HrUser.countDocuments({ isActive: true }),
    HrLeaveRequest.countDocuments({ status: 'pending' })
  ]);
  return { organizations, employees, users, leavePending };
}

async function listOrganizations() {
  const docs = await HrOrganization.find().sort({ createdAt: -1 }).limit(200);
  return docs.map(toPublicOrg);
}

async function dashboard(organizationId) {
  const today = todayISO();
  const [employees, presentToday, pendingLeave, departments, announcements] = await Promise.all([
    HrEmployee.countDocuments({ organizationId, employmentStatus: { $in: ['active', 'probation'] } }),
    HrAttendance.countDocuments({ organizationId, date: today, status: 'present' }),
    HrLeaveRequest.countDocuments({ organizationId, status: 'pending' }),
    HrDepartment.countDocuments({ organizationId, isActive: true }),
    HrAnnouncement.find({ organizationId, published: true }).sort({ createdAt: -1 }).limit(5)
  ]);
  return {
    employees,
    presentToday,
    pendingLeave,
    departments,
    announcements: announcements.map((a) => ({
      id: a._id.toString(),
      title: a.title,
      body: a.body,
      createdAt: a.createdAt
    }))
  };
}

async function getOrganization(organizationId) {
  const org = await HrOrganization.findById(organizationId);
  return toPublicOrg(org);
}

async function updateOrganization(organizationId, body) {
  const org = await HrOrganization.findByIdAndUpdate(organizationId, body, { new: true });
  return toPublicOrg(org);
}

async function listDepartments(organizationId) {
  const docs = await HrDepartment.find({ organizationId }).sort({ name: 1 });
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    code: d.code || '',
    description: d.description || '',
    isActive: d.isActive !== false
  }));
}

async function createDepartment(organizationId, body) {
  const doc = await HrDepartment.create({
    organizationId,
    name: body.name,
    code: body.code || '',
    description: body.description || ''
  });
  return { id: doc._id.toString(), name: doc.name, code: doc.code, description: doc.description, isActive: true };
}

async function listDesignations(organizationId) {
  const docs = await HrDesignation.find({ organizationId }).sort({ name: 1 });
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    code: d.code || '',
    level: d.level || 1,
    description: d.description || '',
    isActive: d.isActive !== false
  }));
}

async function createDesignation(organizationId, body) {
  const doc = await HrDesignation.create({
    organizationId,
    name: body.name,
    code: body.code || '',
    level: body.level || 1,
    description: body.description || ''
  });
  return {
    id: doc._id.toString(),
    name: doc.name,
    code: doc.code,
    level: doc.level,
    description: doc.description,
    isActive: true
  };
}

async function listEmployees(organizationId, q) {
  const filter = { organizationId };
  if (q) {
    filter.$or = [
      { firstName: new RegExp(q, 'i') },
      { lastName: new RegExp(q, 'i') },
      { employeeCode: new RegExp(q, 'i') },
      { phone: new RegExp(q, 'i') }
    ];
  }
  const docs = await HrEmployee.find(filter).sort({ createdAt: -1 }).limit(500);
  return docs.map(toPublicEmployee);
}

async function getEmployee(organizationId, id) {
  const doc = await HrEmployee.findOne({ _id: id, organizationId });
  return doc ? toPublicEmployee(doc) : null;
}

async function createEmployee(organizationId, body) {
  if (!body.email || !body.password || !body.firstName || !body.lastName) {
    const err = new Error('firstName, lastName, email and password are required.');
    err.status = 400;
    throw err;
  }
  const email = String(body.email).toLowerCase();
  if (await HrUser.findOne({ email })) {
    const err = new Error('Email already in use.');
    err.status = 409;
    throw err;
  }

  const count = await HrEmployee.countDocuments({ organizationId });
  const employeeCode = body.employeeCode || `EMP${String(count + 1).padStart(3, '0')}`;

  const user = await HrUser.create({
    organizationId,
    name: `${body.firstName} ${body.lastName}`.trim(),
    email,
    passwordHash: await hashPassword(body.password),
    role: body.role && Object.values(ROLES).includes(body.role) ? body.role : ROLES.EMPLOYEE
  });

  const employee = await HrEmployee.create({
    organizationId,
    userId: user._id,
    employeeCode,
    firstName: body.firstName,
    lastName: body.lastName,
    phone: body.phone || '',
    personalEmail: body.personalEmail || '',
    departmentId: body.departmentId || null,
    designationId: body.designationId || null,
    managerId: body.managerId || null,
    dateOfJoining: body.dateOfJoining || todayISO(),
    employmentType: body.employmentType || 'full_time',
    employmentStatus: body.employmentStatus || 'active',
    workLocation: body.workLocation || 'office',
    dateOfBirth: body.dateOfBirth || '',
    gender: body.gender || '',
    address: body.address || {},
    notes: body.notes || ''
  });

  user.employeeId = employee._id.toString();
  await user.save();
  return toPublicEmployee(employee);
}

async function updateEmployee(organizationId, id, body) {
  const allowed = [
    'firstName', 'lastName', 'phone', 'personalEmail', 'departmentId', 'designationId', 'managerId',
    'dateOfJoining', 'employmentType', 'employmentStatus', 'workLocation', 'dateOfBirth', 'gender',
    'address', 'notes', 'profileImage', 'employeeCode'
  ];
  const patch = {};
  for (const k of allowed) {
    if (body[k] !== undefined) patch[k] = body[k];
  }
  const doc = await HrEmployee.findOneAndUpdate({ _id: id, organizationId }, patch, { new: true });
  if (!doc) return null;
  if (body.firstName || body.lastName) {
    await HrUser.findByIdAndUpdate(doc.userId, {
      name: `${doc.firstName} ${doc.lastName}`.trim()
    });
  }
  return toPublicEmployee(doc);
}

async function getMyEmployee(userId) {
  const doc = await HrEmployee.findOne({ userId });
  return doc ? toPublicEmployee(doc) : null;
}

async function updateProfile(userId, body) {
  const patch = {};
  if (body.name) patch.name = body.name;
  if (body.profileImage !== undefined) patch.profileImage = body.profileImage;
  const user = await HrUser.findByIdAndUpdate(userId, patch, { new: true });
  if (!user) return null;
  if (body.phone !== undefined || body.profileImage !== undefined) {
    const empPatch = {};
    if (body.phone !== undefined) empPatch.phone = body.phone;
    if (body.profileImage !== undefined) empPatch.profileImage = body.profileImage;
    await HrEmployee.findOneAndUpdate({ userId }, empPatch);
  }
  const org = await HrOrganization.findById(user.organizationId).select('name');
  return toPublicUser(user, org?.name);
}

async function attendanceToday(organizationId, employeeId) {
  const doc = await HrAttendance.findOne({ organizationId, employeeId, date: todayISO() });
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    date: doc.date,
    status: doc.status,
    checkInAt: doc.checkInAt,
    checkOutAt: doc.checkOutAt,
    workMinutes: doc.workMinutes
  };
}

async function checkIn(organizationId, employeeId) {
  const date = todayISO();
  let doc = await HrAttendance.findOne({ organizationId, employeeId, date });
  if (doc?.checkInAt) {
    const err = new Error('Already checked in today.');
    err.status = 400;
    throw err;
  }
  if (!doc) {
    doc = await HrAttendance.create({
      organizationId,
      employeeId,
      date,
      status: 'present',
      checkInAt: new Date()
    });
  } else {
    doc.checkInAt = new Date();
    doc.status = 'present';
    await doc.save();
  }
  return attendanceToday(organizationId, employeeId);
}

async function checkOut(organizationId, employeeId) {
  const date = todayISO();
  const doc = await HrAttendance.findOne({ organizationId, employeeId, date });
  if (!doc?.checkInAt) {
    const err = new Error('Check in first.');
    err.status = 400;
    throw err;
  }
  if (doc.checkOutAt) {
    const err = new Error('Already checked out today.');
    err.status = 400;
    throw err;
  }
  doc.checkOutAt = new Date();
  doc.workMinutes = Math.max(0, Math.round((doc.checkOutAt - doc.checkInAt) / 60000));
  await doc.save();
  return attendanceToday(organizationId, employeeId);
}

async function listAttendance(organizationId, { employeeId, from, to } = {}) {
  const filter = { organizationId };
  if (employeeId) filter.employeeId = employeeId;
  if (from || to) {
    filter.date = {};
    if (from) filter.date.$gte = from;
    if (to) filter.date.$lte = to;
  }
  const docs = await HrAttendance.find(filter).sort({ date: -1 }).limit(500);
  return docs.map((d) => ({
    id: d._id.toString(),
    employeeId: d.employeeId.toString(),
    date: d.date,
    status: d.status,
    checkInAt: d.checkInAt,
    checkOutAt: d.checkOutAt,
    workMinutes: d.workMinutes
  }));
}

async function listLeaveTypes(organizationId) {
  const docs = await HrLeaveType.find({ organizationId, isActive: true }).sort({ name: 1 });
  return docs.map((d) => ({
    id: d._id.toString(),
    name: d.name,
    code: d.code,
    daysPerYear: d.daysPerYear,
    isPaid: d.isPaid
  }));
}

async function createLeaveType(organizationId, body) {
  const doc = await HrLeaveType.create({
    organizationId,
    name: body.name,
    code: String(body.code || body.name).slice(0, 10).toUpperCase(),
    daysPerYear: body.daysPerYear ?? 12,
    isPaid: body.isPaid !== false
  });
  return {
    id: doc._id.toString(),
    name: doc.name,
    code: doc.code,
    daysPerYear: doc.daysPerYear,
    isPaid: doc.isPaid
  };
}

async function listLeaveRequests(organizationId, { employeeId, status } = {}) {
  const filter = { organizationId };
  if (employeeId) filter.employeeId = employeeId;
  if (status) filter.status = status;
  const docs = await HrLeaveRequest.find(filter).sort({ createdAt: -1 }).limit(500);
  return docs.map((d) => ({
    id: d._id.toString(),
    employeeId: d.employeeId.toString(),
    leaveTypeId: d.leaveTypeId.toString(),
    startDate: d.startDate,
    endDate: d.endDate,
    days: d.days,
    reason: d.reason || '',
    status: d.status,
    reviewedAt: d.reviewedAt,
    reviewNote: d.reviewNote || '',
    createdAt: d.createdAt
  }));
}

async function createLeaveRequest(organizationId, employeeId, body) {
  const days = body.days || daysBetween(body.startDate, body.endDate);
  if (!body.leaveTypeId || !body.startDate || !body.endDate || days <= 0) {
    const err = new Error('leaveTypeId, startDate and endDate are required.');
    err.status = 400;
    throw err;
  }
  const doc = await HrLeaveRequest.create({
    organizationId,
    employeeId,
    leaveTypeId: body.leaveTypeId,
    startDate: body.startDate,
    endDate: body.endDate,
    days,
    reason: body.reason || '',
    status: 'pending'
  });
  return {
    id: doc._id.toString(),
    employeeId: doc.employeeId.toString(),
    leaveTypeId: doc.leaveTypeId.toString(),
    startDate: doc.startDate,
    endDate: doc.endDate,
    days: doc.days,
    reason: doc.reason,
    status: doc.status,
    createdAt: doc.createdAt
  };
}

async function reviewLeaveRequest(organizationId, id, reviewerUserId, status, reviewNote = '') {
  if (!['approved', 'rejected'].includes(status)) {
    const err = new Error('status must be approved or rejected.');
    err.status = 400;
    throw err;
  }
  const doc = await HrLeaveRequest.findOneAndUpdate(
    { _id: id, organizationId, status: 'pending' },
    { status, reviewedBy: reviewerUserId, reviewedAt: new Date(), reviewNote },
    { new: true }
  );
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    status: doc.status,
    reviewedAt: doc.reviewedAt,
    reviewNote: doc.reviewNote || ''
  };
}

async function listAnnouncements(organizationId) {
  const docs = await HrAnnouncement.find({ organizationId }).sort({ createdAt: -1 }).limit(100);
  return docs.map((a) => ({
    id: a._id.toString(),
    title: a.title,
    body: a.body,
    published: a.published,
    createdAt: a.createdAt
  }));
}

async function createAnnouncement(organizationId, userId, body) {
  const doc = await HrAnnouncement.create({
    organizationId,
    title: body.title,
    body: body.body,
    published: body.published !== false,
    createdBy: userId
  });
  return {
    id: doc._id.toString(),
    title: doc.title,
    body: doc.body,
    published: doc.published,
    createdAt: doc.createdAt
  };
}

module.exports = {
  registerOrg,
  login,
  platformOverview,
  listOrganizations,
  dashboard,
  getOrganization,
  updateOrganization,
  listDepartments,
  createDepartment,
  listDesignations,
  createDesignation,
  listEmployees,
  getEmployee,
  createEmployee,
  updateEmployee,
  getMyEmployee,
  updateProfile,
  attendanceToday,
  checkIn,
  checkOut,
  listAttendance,
  listLeaveTypes,
  createLeaveType,
  listLeaveRequests,
  createLeaveRequest,
  reviewLeaveRequest,
  listAnnouncements,
  createAnnouncement,
  isHrAdminRole
};
