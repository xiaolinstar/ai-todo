declare const wx: {
  getStorageSync(key: string): unknown;
  setStorageSync(key: string, value: unknown): void;
  removeStorageSync(key: string): void;
  login(options: {
    success?: (res: { code?: string }) => void;
    fail?: (err: unknown) => void;
  }): void;
  request(options: {
    url: string;
    method?: string;
    data?: unknown;
    header?: Record<string, string>;
    success?: (res: { statusCode: number; data: unknown }) => void;
    fail?: (err: unknown) => void;
  }): void;
  requestSubscribeMessage(options: {
    tmplIds: string[];
    success?: (res: Record<string, "accept" | "reject" | "ban" | "filter" | string>) => void;
    fail?: (err: unknown) => void;
  }): void;
  navigateTo(options: {
    url: string;
    events?: Record<string, (data: unknown) => void>;
    success?: (res: {
      eventChannel: { emit: (eventName: string, data?: unknown) => void };
    }) => void;
    fail?: () => void;
  }): void;
  navigateBack(options?: { delta?: number }): void;
  switchTab(options: { url: string; success?: () => void }): void;
  showActionSheet(options: {
    itemList: string[];
    success?: (res: { tapIndex: number }) => void;
    fail?: () => void;
  }): void;
  showLoading(options: { title: string }): void;
  hideLoading(): void;
  showToast(options: {
    title: string;
    icon?: "success" | "error" | "loading" | "none";
    duration?: number;
  }): void;
  showModal(options: {
    title?: string;
    content?: string;
    confirmText?: string;
    confirmColor?: string;
    cancelText?: string;
    showCancel?: boolean;
    success?: (res: { confirm: boolean; cancel: boolean }) => void;
  }): void;
  onNeedPrivacyAuthorization?: (
    callback: (
      resolve: (result: { event: "agree" | "disagree"; buttonId?: string }) => void,
      eventInfo: unknown
    ) => void
  ) => void;
  requirePrivacyAuthorize?: (options: {
    success?: () => void;
    fail?: (err: unknown) => void;
  }) => void;
  openPrivacyContract?: (options: { success?: () => void; fail?: (err: unknown) => void }) => void;
  setClipboardData(options: {
    data: string;
    success?: () => void;
    fail?: () => void;
  }): void;
  stopPullDownRefresh(): void;
  setNavigationBarTitle(options: { title: string }): void;
  showShareMenu(options: {
    withShareTicket?: boolean;
    menus?: Array<"shareAppMessage" | "shareTimeline">;
    success?: () => void;
    fail?: (err: unknown) => void;
  }): void;
  getWindowInfo(): {
    windowWidth: number;
  };
  getAccountInfoSync(): {
    miniProgram: {
      envVersion: "develop" | "trial" | "release";
      appId: string;
    };
  };
};

declare function App(options: any): void;
declare function Page(options: any): void;
declare function Component(options: any): void;
declare function getApp(): { globalData: Record<string, unknown> };
declare function getCurrentPages(): Array<{
  route?: string;
  getTabBar?: () => { setData: (data: Record<string, unknown>) => void } | null;
  showAdd?: () => void;
  showPrivacyAuthorization?: (
    resolve: (result: { event: "agree" | "disagree"; buttonId?: string }) => void
  ) => void;
}>;
