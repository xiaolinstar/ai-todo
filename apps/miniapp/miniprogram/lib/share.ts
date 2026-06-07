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

/**
 * 开启右上角「分享给朋友」。朋友圈入口由页面 onShareTimeline 定义即可，不必传 shareTimeline。
 * DevTools 基础库 3.15.1+ 对 showShareMenu(shareTimeline) 易报 WAServiceMainContext timeout，故省略。
 */
export function enableShareMenu(): void {
  if (typeof wx.showShareMenu !== "function") {
    return;
  }

  const show = () => {
    wx.showShareMenu({
      menus: ["shareAppMessage"],
      fail(err) {
        console.warn("showShareMenu failed", err);
      }
    });
  };

  setTimeout(show, 0);
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
