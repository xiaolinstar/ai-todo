"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.request = request;
exports.fetchToday = fetchToday;
exports.fetchRemindersToday = fetchRemindersToday;
exports.fetchCalendarToday = fetchCalendarToday;
exports.fetchCalendarByDate = fetchCalendarByDate;
exports.fetchMe = fetchMe;
exports.completeReminder = completeReminder;
exports.createReminder = createReminder;
exports.createCalendarEvent = createCalendarEvent;
exports.searchContacts = searchContacts;
exports.createContact = createContact;
exports.issuePat = issuePat;
const config_1 = require("./config");
function buildUrl(path) {
    const { apiUrl } = (0, config_1.getConfig)();
    return `${apiUrl.replace(/\/$/, "")}${path}`;
}
function buildHeaders() {
    const { token } = (0, config_1.getConfig)();
    const headers = {
        "content-type": "application/json",
        "x-client-source": "miniapp"
    };
    if (token) {
        headers.authorization = `Bearer ${token}`;
    }
    return headers;
}
function request(path, options = {}) {
    return new Promise((resolve, reject) => {
        wx.request({
            url: buildUrl(path),
            method: options.method || "GET",
            data: options.data,
            header: buildHeaders(),
            success(res) {
                if (res.statusCode >= 400) {
                    const body = res.data;
                    resolve((body === null || body === void 0 ? void 0 : body.ok) === false
                        ? body
                        : {
                            ok: false,
                            error: { code: "HTTP_ERROR", message: `HTTP ${res.statusCode}` }
                        });
                    return;
                }
                resolve(res.data);
            },
            fail(err) {
                reject(err);
            }
        });
    });
}
function fetchToday() {
    return request("/v1/today");
}
function fetchRemindersToday() {
    return request("/v1/reminders/today");
}
function fetchCalendarToday() {
    return request("/v1/calendar/today");
}
function fetchCalendarByDate(date) {
    return request(`/v1/calendar/events?from=${encodeURIComponent(date)}&to=${encodeURIComponent(date)}`);
}
function fetchMe() {
    return request("/v1/me");
}
function completeReminder(reminderId) {
    return request(`/v1/reminders/${reminderId}/complete`, {
        method: "POST",
        data: {}
    });
}
function createReminder(input) {
    return request("/v1/reminders", {
        method: "POST",
        data: input
    });
}
function createCalendarEvent(input) {
    return request("/v1/calendar/events", {
        method: "POST",
        data: input
    });
}
function searchContacts(query) {
    const q = query ? `?q=${encodeURIComponent(query)}` : "";
    return request(`/v1/contacts${q}`);
}
function createContact(input) {
    return request("/v1/contacts", {
        method: "POST",
        data: input
    });
}
function issuePat(name) {
    return request("/v1/api-tokens", {
        method: "POST",
        data: { name, scopes: ["read", "write"] }
    });
}
