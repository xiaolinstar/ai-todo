import { fetchMe, type UserSummary } from "./api";
import { clearToken, getConfig, isDevelopEnv, syncRuntimeConfig } from "./config";
import { silentWechatReLogin } from "./relogin";

export type RestoreSessionReason = "no_token" | "relogin_failed" | "network_error";

export interface SessionState {
  loggedIn: boolean;
  user?: UserSummary;
}

export interface RestoreSessionResult {
  ok: boolean;
  user?: UserSummary;
  reason?: RestoreSessionReason;
}

type SessionListener = (state: SessionState) => void;

const listeners: SessionListener[] = [];

export function onSessionChange(listener: SessionListener): () => void {
  listeners.push(listener);
  return () => {
    const index = listeners.indexOf(listener);
    if (index >= 0) {
      listeners.splice(index, 1);
    }
  };
}

export function notifySession(state: SessionState): void {
  try {
    const app = getApp() as { globalData?: { session?: SessionState } };
    if (app.globalData) {
      app.globalData.session = state;
    }
  } catch {
    // ignore when App is not ready
  }
  listeners.forEach((listener) => {
    try {
      listener(state);
    } catch {
      // ignore listener errors
    }
  });
}

function isNetworkError(response: { ok: boolean; error?: { code: string } }): boolean {
  return !response.ok && response.error?.code === "NETWORK_ERROR";
}

export async function restoreSession(): Promise<RestoreSessionResult> {
  syncRuntimeConfig();
  const { token } = getConfig();

  if (!token) {
    if (isDevelopEnv()) {
      const devResponse = await fetchMe();
      if (devResponse.ok && devResponse.data) {
        const state: SessionState = { loggedIn: true, user: devResponse.data.user };
        notifySession(state);
        return { ok: true, user: devResponse.data.user };
      }
    }
    notifySession({ loggedIn: false });
    return { ok: false, reason: "no_token" };
  }

  let meResponse = await fetchMe();
  if (meResponse.ok && meResponse.data) {
    const state: SessionState = { loggedIn: true, user: meResponse.data.user };
    notifySession(state);
    return { ok: true, user: meResponse.data.user };
  }

  if (isNetworkError(meResponse)) {
    return { ok: false, reason: "network_error" };
  }

  const reloginOk = await silentWechatReLogin();
  if (reloginOk) {
    meResponse = await fetchMe();
    if (meResponse.ok && meResponse.data) {
      const state: SessionState = { loggedIn: true, user: meResponse.data.user };
      notifySession(state);
      return { ok: true, user: meResponse.data.user };
    }
  }

  clearToken();
  notifySession({ loggedIn: false });
  return { ok: false, reason: "relogin_failed" };
}

export function notifyLoggedOut(): void {
  notifySession({ loggedIn: false });
}
