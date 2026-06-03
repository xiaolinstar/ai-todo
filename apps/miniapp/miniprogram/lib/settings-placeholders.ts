export interface PlaceholderMeta {
  title: string;
  lead: string;
  bullets: string[];
  plannedVersion?: string;
}

export const PLACEHOLDER_META: Record<string, PlaceholderMeta> = {
  timezone: {
    title: "时区",
    lead: "用于展示提醒与日程的本地时间。",
    bullets: [
      "查看与修改账户时区",
      "与服务端日程计算对齐",
      "计划在后续小版本开放"
    ],
    plannedVersion: "0.2.x"
  },
  security: {
    title: "账号与安全",
    lead: "管理登录状态与数据安全相关选项。",
    bullets: ["查看当前登录方式（微信）", "会话与令牌安全说明", "更多安全能力评估中"],
    plannedVersion: "0.2.x"
  },
  reminders: {
    title: "提醒偏好",
    lead: "控制新建提醒时的默认行为。",
    bullets: [
      "默认截止时间、默认是否开启微信通知",
      "与「通知设置」分工：通知走渠道，偏好走默认值",
      "部分能力已在通知设置中提供"
    ],
    plannedVersion: "0.2.x"
  },
  calendar: {
    title: "日历偏好",
    lead: "日历展示与新建日程的默认选项。",
    bullets: ["默认时长、默认视图", "与列表页展示规则联动"],
    plannedVersion: "0.2.x"
  },
  contacts: {
    title: "通讯录偏好",
    lead: "应用内联系人的展示与录入习惯。",
    bullets: ["handle 规则说明", "列表排序与展示字段"],
    plannedVersion: "0.2.x"
  },
  dev: {
    title: "开发者选项",
    lead: "仅开发版可见，用于本地调试。",
    bullets: ["API 地址与健康检查", "重置资料引导、清理测试令牌"],
    plannedVersion: "0.2.x"
  }
};

export function getPlaceholderMeta(slot: string): PlaceholderMeta {
  return (
    PLACEHOLDER_META[slot] ?? {
      title: "设置",
      lead: "该设置项尚未开放。",
      bullets: [],
      plannedVersion: "0.2.x"
    }
  );
}
