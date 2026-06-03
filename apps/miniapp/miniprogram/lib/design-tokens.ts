/**
 * 与 miniprogram/styles/tokens.scss 保持同步。
 * 供 WXML 属性、wx.showModal、TS 逻辑等无法使用 CSS 变量的场景。
 */
export const TODO_COLORS = {
  primary: "#007AFF",
  primaryStrong: "#0051D5",
  primaryAlt: "#0A84FF",
  good: "#34C759",
  warning: "#FF9500",
  danger: "#FF3B30",
  dangerStrong: "#D70015",
  accentCalendar: "#FF3B30",
  accentYellow: "#FFCC00",
  accentPurple: "#5856D6",
  accentViolet: "#AF52DE",
  accentPink: "#FF2D55",
  bgPage: "#F2F2F7",
  surface: "#FFFFFF",
  tabBarBg: "#F9F9F9",
  textPrimary: "#000000",
  textSecondary: "#3C3C43",
  textMuted: "#636366",
  textSubtle: "#8E8E93",
  textPlaceholder: "#C7C7CC",
  textInverse: "#FFFFFF"
} as const;

/** 头像占位背景色板（iOS 系统色） */
export const TODO_AVATAR_PALETTE = [
  TODO_COLORS.primary,
  TODO_COLORS.accentPurple,
  TODO_COLORS.accentViolet,
  TODO_COLORS.accentPink,
  TODO_COLORS.danger,
  TODO_COLORS.warning,
  TODO_COLORS.good
] as const;

/** 日历事件色条 */
export const TODO_EVENT_ACCENT_PALETTE = [
  TODO_COLORS.accentCalendar,
  TODO_COLORS.warning,
  TODO_COLORS.accentYellow,
  TODO_COLORS.good,
  TODO_COLORS.primary,
  TODO_COLORS.accentPurple,
  TODO_COLORS.accentViolet
] as const;

/** 微信 switch 等组件的 color 属性 */
export const TODO_SWITCH_COLOR = TODO_COLORS.primary;

/** wx.showModal 危险操作确认按钮 */
export const TODO_MODAL_CONFIRM_DANGER = TODO_COLORS.danger;
