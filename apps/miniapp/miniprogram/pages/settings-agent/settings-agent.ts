import {
  createPat as createPatRequest,
  listApiTokens,
  revokeApiToken
} from "../../lib/api";
import { formatShortDate } from "../../lib/format";

interface PatItem {
  id: string;
  name: string;
  createdAt: string;
  lastUsedAt: string;
}

Page({
  data: {
    patItems: [] as PatItem[],
    patLoading: false,
    creatingPat: false,
    patName: "",
    newPatToken: "",
    patSubmitting: false
  },

  onShow() {
    this.loadPatList();
  },

  loadPatList() {
    this.setData({ patLoading: true });
    listApiTokens()
      .then((response) => {
        this.setData({ patLoading: false });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "加载失败", icon: "none" });
          return;
        }
        const patItems = response.data.items.map((item) => ({
          id: item.id,
          name: item.name,
          createdAt: formatShortDate(item.createdAt),
          lastUsedAt: item.lastUsedAt ? formatShortDate(item.lastUsedAt) : "未使用"
        }));
        this.setData({ patItems });
      })
      .catch(() => {
        this.setData({ patLoading: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onStartCreatePat() {
    this.setData({ creatingPat: true, patName: "", newPatToken: "" });
  },

  onCancelCreatePat() {
    this.setData({ creatingPat: false, patName: "" });
  },

  onPatNameInput(e: { detail: { value: string } }) {
    this.setData({ patName: e.detail.value });
  },

  onConfirmCreatePat() {
    const name = this.data.patName.trim();
    if (!name) {
      wx.showToast({ title: "请输入令牌名称", icon: "none" });
      return;
    }
    this.setData({ patSubmitting: true });
    createPatRequest(name)
      .then((response) => {
        this.setData({ patSubmitting: false, creatingPat: false, patName: "" });
        if (!response.ok || !response.data) {
          wx.showToast({ title: response.error?.message || "创建失败", icon: "none" });
          return;
        }
        this.setData({ newPatToken: response.data.token });
        this.loadPatList();
      })
      .catch(() => {
        this.setData({ patSubmitting: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  },

  onCopyPat() {
    if (!this.data.newPatToken) return;
    wx.setClipboardData({
      data: this.data.newPatToken,
      success: () => wx.showToast({ title: "已复制", icon: "success" })
    });
  },

  onDismissPatReveal() {
    this.setData({ newPatToken: "" });
  },

  onRevokePat(e: { currentTarget: { dataset: { id: string; name: string } } }) {
    const { id, name } = e.currentTarget.dataset;
    wx.showModal({
      title: "吊销令牌",
      content: `确定吊销「${name}」？`,
      success: (result) => {
        if (!result.confirm) return;
        revokeApiToken(id).then((response) => {
          if (!response.ok) {
            wx.showToast({ title: response.error?.message || "吊销失败", icon: "none" });
            return;
          }
          wx.showToast({ title: "已吊销", icon: "success" });
          this.loadPatList();
        });
      }
    });
  }
});
