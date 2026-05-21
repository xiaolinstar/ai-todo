"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.TAB_PAGES = void 0;
exports.updateTabBarSelected = updateTabBarSelected;
exports.TAB_PAGES = [
    "/pages/todos/todos",
    "/pages/calendar/calendar",
    "/pages/contacts/contacts",
    "/pages/mine/mine"
];
function updateTabBarSelected(index) {
    var _a;
    const pages = getCurrentPages();
    const page = pages[pages.length - 1];
    const tabBar = (_a = page === null || page === void 0 ? void 0 : page.getTabBar) === null || _a === void 0 ? void 0 : _a.call(page);
    if (tabBar) {
        tabBar.setData({ selected: index });
    }
}
