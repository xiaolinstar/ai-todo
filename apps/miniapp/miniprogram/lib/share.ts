export const APP_SHARE_TITLE = "ai-todo — AI 原生的待办与日历";
export const APP_SHARE_PATH = "/pages/reminders/reminders";

export interface ShareOptions {
  title: string;
  path: string;
}

export interface ShareTimelineOptions {
  title: string;
  query?: string;
  imageUrl?: string;
}

export function enableShareMenu(): void {
  if (typeof wx.showShareMenu !== "function") {
    return;
  }
  wx.showShareMenu({
    menus: ["shareAppMessage", "shareTimeline"]
  });
}

export function buildAppShareOptions(overrides?: Partial<ShareOptions>): ShareOptions {
  return {
    title: overrides?.title ?? APP_SHARE_TITLE,
    path: overrides?.path ?? APP_SHARE_PATH
  };
}

export function buildAppShareTimelineOptions(
  overrides?: Partial<ShareTimelineOptions>
): ShareTimelineOptions {
  return {
    title: overrides?.title ?? APP_SHARE_TITLE,
    query: overrides?.query ?? ""
  };
}
