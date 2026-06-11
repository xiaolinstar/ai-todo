import {
  fetchNotificationSettings,
  recordWechatSubscriptionResult
} from "./api";

export const REMINDER_TEMPLATE_KEY = "reminder_due";
export const CALENDAR_TEMPLATE_KEY = "calendar_event_start";

export type SubscribeMessageResult = "accept" | "reject" | "ban" | "filter";

export function requestSubscribeMessage(
  templateId: string
): Promise<SubscribeMessageResult> {
  return new Promise((resolve) => {
    wx.requestSubscribeMessage({
      tmplIds: [templateId],
      success(res) {
        const value = res[templateId];
        if (value === "accept" || value === "reject" || value === "ban" || value === "filter") {
          resolve(value);
          return;
        }
        resolve("reject");
      },
      fail() {
        resolve("reject");
      }
    });
  });
}

export async function requestReminderNotification(options: {
  reminderId: string;
  templateId: string;
  enabled: boolean;
}): Promise<{ subscribed: boolean; accepted: boolean }> {
  if (!options.enabled || !options.templateId) {
    return { subscribed: false, accepted: false };
  }

  const result = await requestSubscribeMessage(options.templateId);
  try {
    await recordWechatSubscriptionResult({
      templateKey: REMINDER_TEMPLATE_KEY,
      templateId: options.templateId,
      result,
      targetType: "reminder",
      targetId: options.reminderId
    });
  } catch {
    throw new Error("SUBSCRIPTION_SYNC_FAILED");
  }

  return { subscribed: true, accepted: result === "accept" };
}

export async function requestCalendarEventNotification(options: {
  eventId: string;
  templateId: string;
  enabled: boolean;
}): Promise<{ subscribed: boolean; accepted: boolean }> {
  if (!options.enabled || !options.templateId) {
    return { subscribed: false, accepted: false };
  }

  const result = await requestSubscribeMessage(options.templateId);
  try {
    await recordWechatSubscriptionResult({
      templateKey: CALENDAR_TEMPLATE_KEY,
      templateId: options.templateId,
      result,
      targetType: "calendar_event",
      targetId: options.eventId
    });
  } catch {
    throw new Error("SUBSCRIPTION_SYNC_FAILED");
  }

  return { subscribed: true, accepted: result === "accept" };
}

export async function loadWechatNotificationPrefs(): Promise<{
  notifyAvailable: boolean;
  notifyEnabled: boolean;
  reminderTemplateId: string;
}> {
  const response = await fetchNotificationSettings();
  const settings = response.data?.settings;
  if (!response.ok || !settings?.wechatReminderTemplateId) {
    return { notifyAvailable: false, notifyEnabled: false, reminderTemplateId: "" };
  }
  const wechatReminderEnabled =
    settings.wechatEnabled && settings.defaultReminderEnabled;
  return {
    notifyAvailable: wechatReminderEnabled,
    notifyEnabled: wechatReminderEnabled,
    reminderTemplateId: settings.wechatReminderTemplateId
  };
}

/** @deprecated Use loadWechatNotificationPrefs — applies to reminders and calendar events. */
export async function loadReminderNotificationPrefs(): Promise<{
  notifyAvailable: boolean;
  notifyEnabled: boolean;
  reminderTemplateId: string;
}> {
  return loadWechatNotificationPrefs();
}
