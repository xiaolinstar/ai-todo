"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const api_1 = require("../../lib/api");
Page({
    data: {
        query: "",
        loading: false,
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
    onSelect(e) {
        const item = e.currentTarget.dataset.item;
        const page = this;
        page.getOpenerEventChannel().emit("selectContact", item);
        wx.navigateBack();
    }
});
