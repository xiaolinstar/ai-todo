"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
Page({
    data: {
        query: "",
        loading: false,
        error: "",
        items: [],
        showAddForm: false,
        newName: "",
        newEmail: "",
        adding: false
    },
    onShow() {
        this.loadContacts();
    },
    onQueryInput(e) {
        this.setData({ query: e.detail.value });
    },
    onSearch() {
        this.loadContacts(this.data.query.trim());
    },
    loadContacts(query) {
        this.setData({ loading: true, error: "" });
        return (0, api_1.searchContacts)(query)
            .then((response) => {
            var _a;
            if (!response.ok || !response.data) {
                this.setData({
                    loading: false,
                    error: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "加载失败"
                });
                return;
            }
            this.setData({
                loading: false,
                items: response.data.items.map((item) => (Object.assign(Object.assign({}, item), { subtitle: [item.primaryEmail, item.primaryPhone, item.company]
                        .filter(Boolean)
                        .join(" · ") })))
            });
        })
            .catch(() => {
            this.setData({ loading: false, error: "无法连接 API" });
        });
    },
    onTapContact(e) {
        const item = e.currentTarget.dataset.item;
        wx.showModal({
            title: item.displayName,
            content: [item.primaryEmail, item.primaryPhone].filter(Boolean).join("\n") || "暂无联系方式",
            showCancel: false
        });
    },
    showAdd() {
        this.setData({ showAddForm: true, newName: "", newEmail: "" });
    },
    hideAdd() {
        this.setData({ showAddForm: false });
    },
    noop() { },
    onNewNameInput(e) {
        this.setData({ newName: e.detail.value });
    },
    onNewEmailInput(e) {
        this.setData({ newEmail: e.detail.value });
    },
    onAddContact() {
        const displayName = this.data.newName.trim();
        if (!displayName) {
            wx.showToast({ title: "请输入姓名", icon: "none" });
            return;
        }
        const methods = [];
        const email = this.data.newEmail.trim();
        if (email) {
            methods.push({ type: "email", value: email, isPrimary: true });
        }
        this.setData({ adding: true });
        (0, api_1.createContact)({ displayName, methods })
            .then((response) => {
            var _a;
            this.setData({ adding: false });
            if (!response.ok) {
                wx.showToast({ title: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "添加失败", icon: "none" });
                return;
            }
            wx.showToast({ title: "已添加", icon: "success" });
            this.setData({ showAddForm: false });
            this.loadContacts();
        })
            .catch(() => {
            this.setData({ adding: false });
            wx.showToast({ title: "网络错误", icon: "none" });
        });
    }
});
