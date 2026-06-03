export type SettingsRoute =
  | { kind: "page"; path: string }
  | { kind: "placeholder"; slot: string };

export interface SettingsMenuItem {
  id: string;
  label: string;
  subtitle: string;
  route: SettingsRoute;
  requireLogin?: boolean;
}

export interface SettingsMenuSection {
  id: string;
  title: string;
  items: SettingsMenuItem[];
}

const ALL_SECTIONS: SettingsMenuSection[] = [
  {
    id: "account",
    title: "账户",
    items: [
      {
        id: "profile",
        label: "个人资料",
        subtitle: "头像与昵称",
        route: { kind: "page", path: "/pages/profile-settings/profile-settings" },
        requireLogin: true
      },
      {
        id: "timezone",
        label: "时区",
        subtitle: "查看账户时区",
        route: { kind: "placeholder", slot: "timezone" },
        requireLogin: true
      },
      {
        id: "security",
        label: "账号与安全",
        subtitle: "登录与会话",
        route: { kind: "page", path: "/pages/settings-security/settings-security" },
        requireLogin: true
      }
    ]
  },
  {
    id: "notifications",
    title: "提醒与通知",
    items: [
      {
        id: "notifications",
        label: "通知设置",
        subtitle: "微信提醒与免打扰",
        route: { kind: "page", path: "/pages/notification-settings/notification-settings" },
        requireLogin: true
      }
    ]
  },
  {
    id: "content-prefs",
    title: "使用偏好",
    items: [
      {
        id: "content-prefs",
        label: "提醒、日历与通讯录",
        subtitle: "默认行为与列表展示",
        route: { kind: "page", path: "/pages/settings-content-prefs/settings-content-prefs" },
        requireLogin: true
      }
    ]
  },
  {
    id: "agent",
    title: "扩展",
    items: [
      {
        id: "agent",
        label: "CLI / Agent 接入",
        subtitle: "访问令牌管理",
        route: { kind: "page", path: "/pages/settings-agent/settings-agent" },
        requireLogin: true
      }
    ]
  },
  {
    id: "about",
    title: "关于",
    items: [
      {
        id: "about",
        label: "关于 ai-todo",
        subtitle: "版本与帮助",
        route: { kind: "page", path: "/pages/about/about" }
      }
    ]
  },
  {
    id: "dev",
    title: "开发",
    items: [
      {
        id: "dev",
        label: "开发者选项",
        subtitle: "本地调试工具",
        route: { kind: "page", path: "/pages/settings-dev/settings-dev" },
        requireLogin: true
      }
    ]
  }
];

export function buildMineMenuSections(loggedIn: boolean, showDev: boolean): SettingsMenuSection[] {
  return ALL_SECTIONS.filter((section) => {
    if (section.id === "dev") {
      return showDev;
    }
    if (!loggedIn && section.id !== "about") {
      return false;
    }
    return true;
  }).map((section) => ({
    ...section,
    items: section.items.filter((item) => !item.requireLogin || loggedIn)
  }));
}

export function navigateSettingsItem(item: SettingsMenuItem): void {
  if (item.route.kind === "page") {
    wx.navigateTo({ url: item.route.path });
    return;
  }
  wx.navigateTo({
    url: `/pages/settings-placeholder/settings-placeholder?slot=${encodeURIComponent(item.route.slot)}`
  });
}
