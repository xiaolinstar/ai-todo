import { fetchMe, fetchToday } from "./api";
import { formatNowClock, todayIsoDate, todayIsoDateInTimezone } from "./format";

export interface AccountDay {
  timezone: string;
  today: string;
  nowTime: string;
}

/** Account calendar day from API (`/v1/today` preferred). */
export async function loadAccountDay(): Promise<AccountDay> {
  const todayRes = await fetchToday();
  if (todayRes.ok && todayRes.data) {
    const timezone = todayRes.data.timezone;
    return {
      timezone,
      today: todayRes.data.date,
      nowTime: formatNowClock(timezone)
    };
  }

  const meRes = await fetchMe();
  if (meRes.ok && meRes.data?.user) {
    const timezone = meRes.data.user.timezone;
    return {
      timezone,
      today: todayIsoDateInTimezone(timezone),
      nowTime: formatNowClock(timezone)
    };
  }

  return { timezone: "", today: todayIsoDate(), nowTime: "" };
}
