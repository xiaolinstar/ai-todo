declare const wx: {
  getStorageSync<T = unknown>(key: string): T;
  setStorageSync<T = unknown>(key: string, value: T): void;
  removeStorageSync(key: string): void;
  request(options: {
    url: string;
    method?: string;
    data?: unknown;
    header?: Record<string, string>;
    success?: (res: { statusCode: number; data: unknown }) => void;
    fail?: (err: unknown) => void;
  }): void;
  navigateTo(options: {
    url: string;
    events?: Record<string, (data: any) => void>;
  }): void;
  navigateBack(options?: { delta?: number }): void;
  switchTab(options: { url: string }): void;
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
    showCancel?: boolean;
    success?: (res: { confirm: boolean; cancel: boolean }) => void;
  }): void;
  stopPullDownRefresh(): void;
  setNavigationBarTitle(options: { title: string }): void;
};

declare function App(options: any): void;
declare function Page(options: any): void;
declare function getApp(): { globalData: Record<string, unknown> };
