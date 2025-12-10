"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.AppointmentStatus = exports.UserRole = void 0;
var UserRole;
(function (UserRole) {
    UserRole["CLIENT"] = "client";
    UserRole["ADMIN"] = "admin";
    UserRole["MASTER"] = "master";
})(UserRole || (exports.UserRole = UserRole = {}));
var AppointmentStatus;
(function (AppointmentStatus) {
    AppointmentStatus["PENDING"] = "pending";
    AppointmentStatus["CONFIRMED"] = "confirmed";
    AppointmentStatus["COMPLETED"] = "completed";
    AppointmentStatus["CANCELLED"] = "cancelled";
    AppointmentStatus["RESCHEDULED"] = "rescheduled";
})(AppointmentStatus || (exports.AppointmentStatus = AppointmentStatus = {}));
//# sourceMappingURL=entities.js.map