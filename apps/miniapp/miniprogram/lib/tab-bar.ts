export const TAB_PAGES = [
  "/pages/reminders/reminders",
  "/pages/calendar/calendar",
  "/pages/contacts/contacts",
  "/pages/mine/mine"
] as const;

interface TabBarLike {
  setData: (data: { selected: number }) => void;
}

export function updateTabBarSelected(index: number) {
  const pages = getCurrentPages();
  const page = pages[pages.length - 1] as { getTabBar?: () => TabBarLike | null } | undefined;
  const tabBar = page?.getTabBar?.();
  if (tabBar) {
    tabBar.setData({ selected: index });
  }
}
