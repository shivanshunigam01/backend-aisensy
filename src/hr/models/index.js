const mongoose = require('mongoose');
const { ROLE_VALUES, ROLES, EMPLOYMENT_STATUSES, EMPLOYMENT_TYPES, ATTENDANCE_STATUSES, LEAVE_STATUSES } = require('../constants');

const addressSchema = new mongoose.Schema(
  {
    line1: { type: String, default: '' },
    line2: { type: String, default: '' },
    city: { type: String, default: '' },
    state: { type: String, default: '' },
    postalCode: { type: String, default: '' },
    country: { type: String, default: '' }
  },
  { _id: false }
);

const OrganizationSchema = new mongoose.Schema(
  {
    name: { type: String, required: true, trim: true },
    slug: { type: String, required: true, unique: true, lowercase: true, trim: true },
    logo: { type: String, default: '' },
    industry: { type: String, default: '' },
    email: { type: String, default: '' },
    phone: { type: String, default: '' },
    website: { type: String, default: '' },
    address: { type: addressSchema, default: () => ({}) },
    workingDays: { type: [String], default: ['monday', 'tuesday', 'wednesday', 'thursday', 'friday'] },
    workingHours: {
      start: { type: String, default: '09:30' },
      end: { type: String, default: '18:30' }
    },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'hr_organizations' }
);

const UserSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrOrganization', required: true, index: true },
    employeeId: { type: String, default: null },
    name: { type: String, required: true, trim: true },
    email: { type: String, required: true, unique: true, lowercase: true, trim: true },
    profileImage: { type: String, default: '' },
    passwordHash: { type: String, required: true, select: false },
    role: { type: String, enum: ROLE_VALUES, default: ROLES.EMPLOYEE },
    isActive: { type: Boolean, default: true },
    lastLogin: { type: Date, default: null }
  },
  { timestamps: true, collection: 'hr_users' }
);

const DepartmentSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrOrganization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, default: '' },
    description: { type: String, default: '' },
    headEmployeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', default: null },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'hr_departments' }
);

const DesignationSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrOrganization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, trim: true, uppercase: true, default: '' },
    level: { type: Number, default: 1 },
    description: { type: String, default: '' },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'hr_designations' }
);

const EmployeeSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrOrganization', required: true, index: true },
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrUser', required: true, unique: true },
    employeeCode: { type: String, required: true, trim: true, uppercase: true },
    firstName: { type: String, required: true, trim: true },
    lastName: { type: String, required: true, trim: true },
    profileImage: { type: String, default: '' },
    phone: { type: String, default: '' },
    personalEmail: { type: String, default: '' },
    departmentId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrDepartment', default: null },
    designationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrDesignation', default: null },
    managerId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', default: null },
    dateOfJoining: { type: String, default: '' },
    employmentType: { type: String, enum: EMPLOYMENT_TYPES, default: 'full_time' },
    employmentStatus: { type: String, enum: EMPLOYMENT_STATUSES, default: 'active' },
    workLocation: { type: String, default: 'office' },
    dateOfBirth: { type: String, default: '' },
    gender: { type: String, default: '' },
    address: { type: addressSchema, default: () => ({}) },
    notes: { type: String, default: '' }
  },
  { timestamps: true, collection: 'hr_employees' }
);
EmployeeSchema.index({ organizationId: 1, employeeCode: 1 }, { unique: true });

const AttendanceSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrOrganization', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true, index: true },
    date: { type: String, required: true },
    status: { type: String, enum: ATTENDANCE_STATUSES, default: 'present' },
    checkInAt: { type: Date, default: null },
    checkOutAt: { type: Date, default: null },
    workMinutes: { type: Number, default: 0 },
    notes: { type: String, default: '' }
  },
  { timestamps: true, collection: 'hr_attendance' }
);
AttendanceSchema.index({ organizationId: 1, employeeId: 1, date: 1 }, { unique: true });

const LeaveTypeSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrOrganization', required: true, index: true },
    name: { type: String, required: true, trim: true },
    code: { type: String, required: true, trim: true, uppercase: true },
    daysPerYear: { type: Number, default: 12 },
    isPaid: { type: Boolean, default: true },
    isActive: { type: Boolean, default: true }
  },
  { timestamps: true, collection: 'hr_leave_types' }
);

const LeaveRequestSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrOrganization', required: true, index: true },
    employeeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrEmployee', required: true, index: true },
    leaveTypeId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrLeaveType', required: true },
    startDate: { type: String, required: true },
    endDate: { type: String, required: true },
    days: { type: Number, required: true },
    reason: { type: String, default: '' },
    status: { type: String, enum: LEAVE_STATUSES, default: 'pending' },
    reviewedBy: { type: mongoose.Schema.Types.ObjectId, ref: 'HrUser', default: null },
    reviewedAt: { type: Date, default: null },
    reviewNote: { type: String, default: '' }
  },
  { timestamps: true, collection: 'hr_leave_requests' }
);

const AnnouncementSchema = new mongoose.Schema(
  {
    organizationId: { type: mongoose.Schema.Types.ObjectId, ref: 'HrOrganization', required: true, index: true },
    title: { type: String, required: true, trim: true },
    body: { type: String, required: true },
    published: { type: Boolean, default: true },
    createdBy: { type: mongoose.Schema.Types.ObjectId, ref: 'HrUser', default: null }
  },
  { timestamps: true, collection: 'hr_announcements' }
);

function toPublicOrg(doc) {
  if (!doc) return null;
  return {
    id: doc._id.toString(),
    name: doc.name,
    slug: doc.slug,
    logo: doc.logo || '',
    industry: doc.industry || '',
    email: doc.email || '',
    phone: doc.phone || '',
    website: doc.website || '',
    address: doc.address || {},
    workingDays: doc.workingDays || [],
    workingHours: doc.workingHours || { start: '09:30', end: '18:30' },
    isActive: doc.isActive !== false,
    createdAt: doc.createdAt
  };
}

function toPublicUser(doc, orgName) {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    organizationName: orgName || null,
    employeeId: doc.employeeId || null,
    name: doc.name,
    email: doc.email,
    profileImage: doc.profileImage || '',
    role: doc.role,
    isActive: doc.isActive !== false,
    lastLogin: doc.lastLogin || null
  };
}

function toPublicEmployee(doc) {
  return {
    id: doc._id.toString(),
    organizationId: doc.organizationId.toString(),
    userId: doc.userId.toString(),
    employeeCode: doc.employeeCode,
    firstName: doc.firstName,
    lastName: doc.lastName,
    fullName: `${doc.firstName} ${doc.lastName}`.trim(),
    profileImage: doc.profileImage || '',
    phone: doc.phone || '',
    personalEmail: doc.personalEmail || '',
    departmentId: doc.departmentId ? doc.departmentId.toString() : null,
    designationId: doc.designationId ? doc.designationId.toString() : null,
    managerId: doc.managerId ? doc.managerId.toString() : null,
    dateOfJoining: doc.dateOfJoining || '',
    employmentType: doc.employmentType,
    employmentStatus: doc.employmentStatus,
    workLocation: doc.workLocation || 'office',
    dateOfBirth: doc.dateOfBirth || '',
    gender: doc.gender || '',
    address: doc.address || {},
    notes: doc.notes || '',
    createdAt: doc.createdAt
  };
}

const HrOrganization = mongoose.models.HrOrganization || mongoose.model('HrOrganization', OrganizationSchema);
const HrUser = mongoose.models.HrUser || mongoose.model('HrUser', UserSchema);
const HrDepartment = mongoose.models.HrDepartment || mongoose.model('HrDepartment', DepartmentSchema);
const HrDesignation = mongoose.models.HrDesignation || mongoose.model('HrDesignation', DesignationSchema);
const HrEmployee = mongoose.models.HrEmployee || mongoose.model('HrEmployee', EmployeeSchema);
const HrAttendance = mongoose.models.HrAttendance || mongoose.model('HrAttendance', AttendanceSchema);
const HrLeaveType = mongoose.models.HrLeaveType || mongoose.model('HrLeaveType', LeaveTypeSchema);
const HrLeaveRequest = mongoose.models.HrLeaveRequest || mongoose.model('HrLeaveRequest', LeaveRequestSchema);
const HrAnnouncement = mongoose.models.HrAnnouncement || mongoose.model('HrAnnouncement', AnnouncementSchema);

module.exports = {
  HrOrganization,
  HrUser,
  HrDepartment,
  HrDesignation,
  HrEmployee,
  HrAttendance,
  HrLeaveType,
  HrLeaveRequest,
  HrAnnouncement,
  toPublicOrg,
  toPublicUser,
  toPublicEmployee
};
