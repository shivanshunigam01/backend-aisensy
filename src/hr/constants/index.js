const ROLES = {
  SUPER_ADMIN: 'SUPER_ADMIN',
  HR_ADMIN: 'HR_ADMIN',
  MANAGER: 'MANAGER',
  EMPLOYEE: 'EMPLOYEE'
};

const ROLE_VALUES = Object.values(ROLES);

const EMPLOYMENT_STATUSES = ['active', 'probation', 'notice', 'terminated', 'resigned'];
const EMPLOYMENT_TYPES = ['full_time', 'part_time', 'contract', 'intern'];
const ATTENDANCE_STATUSES = ['present', 'absent', 'half_day', 'on_leave', 'holiday', 'weekend'];
const LEAVE_STATUSES = ['pending', 'approved', 'rejected', 'cancelled'];

module.exports = {
  ROLES,
  ROLE_VALUES,
  EMPLOYMENT_STATUSES,
  EMPLOYMENT_TYPES,
  ATTENDANCE_STATUSES,
  LEAVE_STATUSES
};
