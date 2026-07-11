import { handleApiError } from '../../lib/error-handler';
import { ApiTokenSummary, listApiTokens, revokeApiToken } from '../../lib/api';
import { getConfig } from '../../lib/config';
import { TODO_MODAL_CONFIRM_DANGER } from '../../lib/design-tokens';
import { formatShortDate } from '../../lib/format';
import { buildSettingsTemplate } from '../../lib/token-presets';
import {
  buildTokenInactiveSummary,
  isActiveTokenStatus,
  normalizeApiTokenSummary,
} from '../../lib/token-status';

Page({
  data: {
    tokenId: '',
    loading: true,
    revoking: false,
    found: false,
    name: '',
    tokenHint: 'aitodo_****',
    isActive: true,
    inactiveSummary: '',
    expiresAt: '永不过期',
    settingsTemplate: '',
  },

  onLoad(query: { id?: string }) {
    this.setData({ tokenId: query.id || '' });
    this.loadToken();
  },

  loadToken() {
    if (!this.data.tokenId) {
      this.setData({ loading: false, found: false });
      return;
    }
    this.setData({ loading: true });
    listApiTokens()
      .then((response) => {
        this.setData({ loading: false });
        if (!response.ok || !response.data) {
          handleApiError(response.error, '加载失败');
          return;
        }
        const raw = response.data.items.find((item) => item.id === this.data.tokenId);
        if (!raw) {
          this.setData({ found: false });
          return;
        }
        this.applyToken(normalizeApiTokenSummary(raw));
      })
      .catch(() => {
        this.setData({ loading: false });
        wx.showToast({ title: '网络错误', icon: 'none' });
      });
  },

  applyToken(token: ApiTokenSummary) {
    const apiUrl = getConfig().apiUrl;
    const isActive = isActiveTokenStatus(token.status);
    this.setData({
      found: true,
      name: token.name,
      tokenHint: token.tokenHint || 'aitodo_****',
      isActive,
      inactiveSummary: isActive ? '' : buildTokenInactiveSummary(token),
      expiresAt: token.expiresAt ? formatShortDate(token.expiresAt) : '永不过期',
      settingsTemplate: buildSettingsTemplate(apiUrl),
    });
  },

  onCopySettingsTemplate() {
    wx.setClipboardData({
      data: this.data.settingsTemplate,
      success: () => wx.showToast({ title: '已复制', icon: 'success' }),
    });
  },

  onRevoke() {
    if (!this.data.isActive || this.data.revoking) return;
    wx.showModal({
      title: '吊销令牌',
      content: `确定吊销「${this.data.name}」？电脑端工具将无法继续使用此令牌。`,
      confirmColor: TODO_MODAL_CONFIRM_DANGER,
      success: (result) => {
        if (!result.confirm) return;
        this.setData({ revoking: true });
        revokeApiToken(this.data.tokenId)
          .then((response) => {
            this.setData({ revoking: false });
            if (!response.ok) {
              handleApiError(response.error, '吊销失败');
              return;
            }
            wx.showToast({ title: '已吊销', icon: 'success' });
            this.loadToken();
          })
          .catch(() => {
            this.setData({ revoking: false });
            wx.showToast({ title: '网络错误', icon: 'none' });
          });
      },
    });
  },
});
