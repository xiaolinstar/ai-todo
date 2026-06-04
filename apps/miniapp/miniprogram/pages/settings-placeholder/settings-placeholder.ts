import { fetchMe } from "../../lib/api";
import { todayIsoDate, todayIsoDateInTimezone } from "../../lib/format";
import { getPlaceholderMeta } from "../../lib/settings-placeholders";

Page({
  data: {
    lead: "",
    bullets: [] as string[],
    plannedVersion: "",
    extraNote: ""
  },

  onLoad(query: { slot?: string }) {
    const slot = query.slot ? decodeURIComponent(query.slot) : "";
    const meta = getPlaceholderMeta(slot);
    wx.setNavigationBarTitle({ title: meta.title });
    this.setData({
      lead: meta.lead,
      bullets: meta.bullets,
      plannedVersion: meta.plannedVersion || "",
      extraNote: ""
    });
    if (slot === "timezone") {
      fetchMe().then((response) => {
        if (!response.ok || !response.data?.user.timezone) {
          return;
        }
        const timezone = response.data.user.timezone;
        const accountToday = todayIsoDateInTimezone(timezone);
        const localToday = todayIsoDate();
        let extraNote = `当前账户时区：${timezone}`;
        if (accountToday !== localToday) {
          extraNote += `\n账户「今天」：${accountToday}；本机「今天」：${localToday}`;
        }
        this.setData({ extraNote });
      });
    }
  }
});
