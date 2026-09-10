const express = require('express');
const { requireMongo } = require('../../middleware/requireMongo');
const { requireHrAuth, requireRoles } = require('../middleware/auth');
const c = require('../controllers/hrController');
const { ok } = require('../utils/helpers');

const router = express.Router();

router.get('/health', (_req, res) => ok(res, { module: 'hr', status: 'up' }));

router.post('/auth/register', requireMongo, c.postRegister);
router.post('/auth/login', requireMongo, c.postLogin);

router.use(requireMongo, requireHrAuth);

router.get('/auth/me', c.getMe);
router.patch('/users/profile', c.patchProfile);

router.get('/platform/overview', requireRoles('SUPER_ADMIN'), c.getPlatformOverview);
router.get('/organizations', requireRoles('SUPER_ADMIN'), c.getOrganizations);

router.get('/dashboard', c.getDashboard);
router.get('/organization', c.getOrganization);
router.patch('/organization', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), c.patchOrganization);

router.get('/departments', c.getDepartments);
router.post('/departments', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), c.postDepartment);
router.get('/designations', c.getDesignations);
router.post('/designations', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), c.postDesignation);

router.get('/employees', c.getEmployees);
router.get('/employees/me', c.getEmployeesMe);
router.post('/employees', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), c.postEmployee);
router.get('/employees/:id', c.getEmployee);
router.patch('/employees/:id', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), c.patchEmployee);

router.get('/attendance/today', c.getAttendanceToday);
router.post('/attendance/check-in', c.postCheckIn);
router.post('/attendance/check-out', c.postCheckOut);
router.get('/attendance', c.getAttendance);

router.get('/leave/types', c.getLeaveTypes);
router.post('/leave/types', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), c.postLeaveType);
router.get('/leave/requests', c.getLeaveRequests);
router.post('/leave/requests', c.postLeaveRequest);
router.post('/leave/requests/:id/review', requireRoles('SUPER_ADMIN', 'HR_ADMIN', 'MANAGER'), c.postLeaveReview);

router.get('/announcements', c.getAnnouncements);
router.post('/announcements', requireRoles('SUPER_ADMIN', 'HR_ADMIN'), c.postAnnouncement);

module.exports = router;
