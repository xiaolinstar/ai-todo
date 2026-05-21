"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
const format_1 = require("../../lib/format");
Page({
    data: {
        query: "",
        loading: false,
        loaded: false,
        error: "",
        items: []
    },
    onLoad() {
        this.loadContacts();
    },
    onQueryInput(e) {
        this.setData({ query: e.detail.value });
    },
    onSearch() {
        this.loadContacts(this.data.query.trim());
    },
    onClearSearch() {
        this.setData({ query: "" });
        this.loadContacts();
    },
    loadContacts(query) {
        this.setData({ loading: true, error: "" });
        return (0, api_1.searchContacts)(query)
            .then((response) => {
            var _a;
            if (!response.ok || !response.data) {
                this.setData({
                    loading: false,
                    loaded: true,
                    error: ((_a = response.error) === null || _a === void 0 ? void 0 : _a.message) || "加载失败"
                });
                return;
            }
            this.setData({
                loading: false,
                loaded: true,
                items: response.data.items.map((item) => (Object.assign(Object.assign({}, item), { subtitle: [item.primaryEmail, item.primaryPhone, item.company]
                        .filter(Boolean)
                        .join(" · "), initial: (0, format_1.getInitial)(item.displayName), avatarColor: (0, format_1.avatarColor)(item.displayName) })))
            });
        })
            .catch(() => {
            this.setData({ loading: false, loaded: true, error: "无法连接 API" });
        });
    },
    onSelect(e) {
        const item = e.currentTarget.dataset.item;
        const page = this;
        page.getOpenerEventChannel().emit("selectContact", item);
        wx.navigateBack();
    }
});
