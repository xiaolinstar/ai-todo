import { createContact } from "../../lib/api";

Page({
  data: {
    displayName: "",
    company: "",
    title: "",
    email: "",
    phone: "",
    notes: "",
    notesExpanded: false,
    submitting: false
  },

  onDisplayNameInput(e: { detail: { value: string } }) {
    this.setData({ displayName: e.detail.value });
  },

  onCompanyInput(e: { detail: { value: string } }) {
    this.setData({ company: e.detail.value });
  },

  onTitleInput(e: { detail: { value: string } }) {
    this.setData({ title: e.detail.value });
  },

  onEmailInput(e: { detail: { value: string } }) {
    this.setData({ email: e.detail.value });
  },

  onPhoneInput(e: { detail: { value: string } }) {
    this.setData({ phone: e.detail.value });
  },

  onNotesInput(e: { detail: { value: string } }) {
    this.setData({ notes: e.detail.value });
  },

  toggleNotes() {
    this.setData({ notesExpanded: !this.data.notesExpanded });
  },

  onSubmit() {
    const displayName = this.data.displayName.trim();
    if (!displayName) {
      wx.showToast({ title: "请输入姓名", icon: "none" });
      return;
    }

    const methods: Array<{ type: string; value: string; isPrimary?: boolean }> = [];
    const email = this.data.email.trim();
    const phone = this.data.phone.trim();
    if (email) {
      methods.push({ type: "email", value: email, isPrimary: true });
    }
    if (phone) {
      methods.push({ type: "phone", value: phone, isPrimary: true });
    }

    const payload: {
      displayName: string;
      company?: string;
      title?: string;
      notes?: string;
      methods?: Array<{ type: string; value: string; isPrimary?: boolean }>;
    } = { displayName };

    for (const key of ["company", "title", "notes"] as const) {
      const value = this.data[key].trim();
      if (value) {
        payload[key] = value;
      }
    }

    if (methods.length > 0) {
      payload.methods = methods;
    }

    this.setData({ submitting: true });
    createContact(payload)
      .then((response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          wx.showToast({ title: response.error?.message || "添加失败", icon: "none" });
          return;
        }
        wx.showToast({ title: "已添加", icon: "success" });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: "网络错误", icon: "none" });
      });
  }
});
