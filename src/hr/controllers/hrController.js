const service = require('../services/hrService');
const { ok, fail } = require('../utils/helpers');
const { publicUserFromId } = require('../middleware/auth');
const { HrEmployee } = require('../models');

function orgId(req) {
  return req.hrUser?.organizationId || req.query.organizationId || req.body.organizationId;
}

async function resolveEmployeeId(req) {
  if (req.hrUser?.employeeId) return req.hrUser.employeeId;
  if (!req.hrUser?.id) return null;
  const emp = await HrEmployee.findOne({ userId: req.hrUser.id }).select('_id');
  return emp ? emp._id.toString() : null;
}

async function postRegister(req, res, next) {
  try {
    const { env } = require('../../config/env');
    if (!env.hrAllowPublicRegister) return fail(res, 'Public HR registration is disabled.', 403);
    const data = await service.registerOrg(req.body);
    return ok(res, data, 'Organization registered', 201);
  } catch (err) {
    if (err.status) return fail(res, err.message, err.status);
    return next(err);
  }
}

async function postLogin(req, res, next) {
  try {
    const data = await service.login(req.body);
    return ok(res, data, 'Logged in');
  } catch (err) {
    if (err.status) return fail(res, err.message, err.status);
    return next(err);
  }
}

async function getMe(req, res, next) {
  try {
    if (req.hrUser.isPlatform) {
      return ok(res, {
        user: {
          id: req.hrUser.id,
          name: req.hrUser.name,
          email: req.hrUser.email,
          role: 'SUPER_ADMIN',
          isPlatform: true
        },
        employee: null,
        organization: null
      });
    }
    const user = await publicUserFromId(req.hrUser.id);
    const employee = await service.getMyEmployee(req.hrUser.id);
    const organization = await service.getOrganization(req.hrUser.organizationId);
    return ok(res, { user, employee, organization });
  } catch (err) {
    return next(err);
  }
}

async function getPlatformOverview(req, res, next) {
  try {
    return ok(res, await service.platformOverview());
  } catch (err) {
    return next(err);
  }
}

async function getOrganizations(req, res, next) {
  try {
    return ok(res, { items: await service.listOrganizations() });
  } catch (err) {
    return next(err);
  }
}

async function getDashboard(req, res, next) {
  try {
    const id = orgId(req);
    if (!id) return fail(res, 'organizationId required', 400);
    return ok(res, await service.dashboard(id));
  } catch (err) {
    return next(err);
  }
}

async function getOrganization(req, res, next) {
  try {
    return ok(res, await service.getOrganization(orgId(req)));
  } catch (err) {
    return next(err);
  }
}

async function patchOrganization(req, res, next) {
  try {
    return ok(res, await service.updateOrganization(orgId(req), req.body));
  } catch (err) {
    return next(err);
  }
}

async function getDepartments(req, res, next) {
  try {
    return ok(res, { items: await service.listDepartments(orgId(req)) });
  } catch (err) {
    return next(err);
  }
}

async function postDepartment(req, res, next) {
  try {
    return ok(res, await service.createDepartment(orgId(req), req.body), 'Created', 201);
  } catch (err) {
    return next(err);
  }
}

async function getDesignations(req, res, next) {
  try {
    return ok(res, { items: await service.listDesignations(orgId(req)) });
  } catch (err) {
    return next(err);
  }
}

async function postDesignation(req, res, next) {
  try {
    return ok(res, await service.createDesignation(orgId(req), req.body), 'Created', 201);
  } catch (err) {
    return next(err);
  }
}

async function getEmployees(req, res, next) {
  try {
    return ok(res, { items: await service.listEmployees(orgId(req), req.query.q) });
  } catch (err) {
    return next(err);
  }
}

async function getEmployee(req, res, next) {
  try {
    const emp = await service.getEmployee(orgId(req), req.params.id);
    if (!emp) return fail(res, 'Employee not found', 404);
    return ok(res, emp);
  } catch (err) {
    return next(err);
  }
}

async function postEmployee(req, res, next) {
  try {
    const emp = await service.createEmployee(orgId(req), req.body);
    return ok(res, emp, 'Employee created', 201);
  } catch (err) {
    if (err.status) return fail(res, err.message, err.status);
    return next(err);
  }
}

async function patchEmployee(req, res, next) {
  try {
    const emp = await service.updateEmployee(orgId(req), req.params.id, req.body);
    if (!emp) return fail(res, 'Employee not found', 404);
    return ok(res, emp);
  } catch (err) {
    return next(err);
  }
}

async function getEmployeesMe(req, res, next) {
  try {
    return ok(res, await service.getMyEmployee(req.hrUser.id));
  } catch (err) {
    return next(err);
  }
}

async function patchProfile(req, res, next) {
  try {
    const user = await service.updateProfile(req.hrUser.id, req.body);
    if (!user) return fail(res, 'User not found', 404);
    return ok(res, user);
  } catch (err) {
    return next(err);
  }
}

async function getAttendanceToday(req, res, next) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) return ok(res, null);
    return ok(res, await service.attendanceToday(orgId(req), employeeId));
  } catch (err) {
    return next(err);
  }
}

async function postCheckIn(req, res, next) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) return fail(res, 'Employee profile required', 400);
    return ok(res, await service.checkIn(orgId(req), employeeId), 'Checked in');
  } catch (err) {
    if (err.status) return fail(res, err.message, err.status);
    return next(err);
  }
}

async function postCheckOut(req, res, next) {
  try {
    const employeeId = await resolveEmployeeId(req);
    if (!employeeId) return fail(res, 'Employee profile required', 400);
    return ok(res, await service.checkOut(orgId(req), employeeId), 'Checked out');
  } catch (err) {
    if (err.status) return fail(res, err.message, err.status);
    return next(err);
  }
}

async function getAttendance(req, res, next) {
  try {
    return ok(
      res,
      {
        items: await service.listAttendance(orgId(req), {
          employeeId: req.query.employeeId,
          from: req.query.from,
          to: req.query.to
        })
      }
    );
  } catch (err) {
    return next(err);
  }
}

async function getLeaveTypes(req, res, next) {
  try {
    return ok(res, { items: await service.listLeaveTypes(orgId(req)) });
  } catch (err) {
    return next(err);
  }
}

async function postLeaveType(req, res, next) {
  try {
    return ok(res, await service.createLeaveType(orgId(req), req.body), 'Created', 201);
  } catch (err) {
    return next(err);
  }
}

async function getLeaveRequests(req, res, next) {
  try {
    return ok(
      res,
      {
        items: await service.listLeaveRequests(orgId(req), {
          employeeId: req.query.employeeId,
          status: req.query.status
        })
      }
    );
  } catch (err) {
    return next(err);
  }
}

async function postLeaveRequest(req, res, next) {
  try {
    const employeeId = req.body.employeeId || (await resolveEmployeeId(req));
    if (!employeeId) return fail(res, 'employeeId required', 400);
    return ok(res, await service.createLeaveRequest(orgId(req), employeeId, req.body), 'Leave requested', 201);
  } catch (err) {
    if (err.status) return fail(res, err.message, err.status);
    return next(err);
  }
}

async function postLeaveReview(req, res, next) {
  try {
    const reviewed = await service.reviewLeaveRequest(
      orgId(req),
      req.params.id,
      req.hrUser.id,
      req.body.status,
      req.body.reviewNote
    );
    if (!reviewed) return fail(res, 'Leave request not found or already reviewed', 404);
    return ok(res, reviewed);
  } catch (err) {
    if (err.status) return fail(res, err.message, err.status);
    return next(err);
  }
}

async function getAnnouncements(req, res, next) {
  try {
    return ok(res, { items: await service.listAnnouncements(orgId(req)) });
  } catch (err) {
    return next(err);
  }
}

async function postAnnouncement(req, res, next) {
  try {
    return ok(res, await service.createAnnouncement(orgId(req), req.hrUser.id, req.body), 'Created', 201);
  } catch (err) {
    return next(err);
  }
}

module.exports = {
  postRegister,
  postLogin,
  getMe,
  getPlatformOverview,
  getOrganizations,
  getDashboard,
  getOrganization,
  patchOrganization,
  getDepartments,
  postDepartment,
  getDesignations,
  postDesignation,
  getEmployees,
  getEmployee,
  postEmployee,
  patchEmployee,
  getEmployeesMe,
  patchProfile,
  getAttendanceToday,
  postCheckIn,
  postCheckOut,
  getAttendance,
  getLeaveTypes,
  postLeaveType,
  getLeaveRequests,
  postLeaveRequest,
  postLeaveReview,
  getAnnouncements,
  postAnnouncement
};
