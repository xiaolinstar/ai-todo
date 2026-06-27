/** Shown after CLI/Agent creates a reminder or calendar event (human output only). */
export const WECHAT_NOTIFY_CLI_NOTICE =
  "WeChat push reminders cannot be enabled for CLI/Agent-created items. Open the WeChat miniapp to turn on WeChat notifications for this item.";

export function printWechatNotifyCliNotice(): void {
  console.log(`Note: ${WECHAT_NOTIFY_CLI_NOTICE}`);
}
