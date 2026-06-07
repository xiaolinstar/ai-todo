/** Window metrics via WeChat base library API (replaces deprecated getSystemInfoSync). */
export function getWindowWidthPx(): number {
  return wx.getWindowInfo().windowWidth;
}
