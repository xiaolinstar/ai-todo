import { handleApiError } from '../../lib/error-handler';
import { fetchContact, updateContact } from '../../lib/api';

Page({
  data: {
    contactId: '',
    loading: true,
    displayName: '',
    company: '',
    title: '',
    email: '',
    phone: '',
    notes: '',
    notesExpanded: false,
    submitting: false,
  },

  onLoad(options: { id?: string }) {
    const contactId = (options.id || '').trim();
    if (!contactId) {
      wx.showToast({ title: '缺少联系人 ID', icon: 'none' });
      setTimeout(() => wx.navigateBack(), 800);
      return;
    }
    this.setData({ contactId });
    fetchContact(contactId)
      .then((response) => {
        if (!response.ok || !response.data) {
          this.setData({ loading: false });
          handleApiError(response.error, '加载失败');
          return;
        }
        const contact = response.data.contact;
        const email =
          contact.primaryEmail || contact.methods?.find((m) => m.type === 'email')?.value || '';
        const phone =
          contact.primaryPhone || contact.methods?.find((m) => m.type === 'phone')?.value || '';
        this.setData({
          loading: false,
          displayName: contact.displayName || '',
          company: contact.company || '',
          title: contact.title || '',
          email,
          phone,
          notes: contact.notes || '',
          notesExpanded: Boolean(contact.notes),
        });
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
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
      wx.showToast({ title: '请输入姓名', icon: 'none' });
      return;
    }

    const methods: Array<{ type: string; value: string; isPrimary?: boolean }> = [];
    const email = this.data.email.trim();
    const phone = this.data.phone.trim();
    if (email) {
      methods.push({ type: 'email', value: email, isPrimary: true });
    }
    if (phone) {
      methods.push({ type: 'phone', value: phone, isPrimary: true });
    }

    this.setData({ submitting: true });
    updateContact(this.data.contactId, {
      displayName,
      company: this.data.company.trim(),
      title: this.data.title.trim(),
      notes: this.data.notes.trim(),
      methods,
    })
      .then((response) => {
        this.setData({ submitting: false });
        if (!response.ok) {
          handleApiError(response.error, '保存失败');
          return;
        }
        wx.showToast({ title: '已保存', icon: 'success' });
        setTimeout(() => wx.navigateBack(), 500);
      })
      .catch(() => {
        this.setData({ submitting: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },
});
