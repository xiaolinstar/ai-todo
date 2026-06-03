import { fetchMe } from "../../lib/api";
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
        if (response.ok && response.data?.user.timezone) {
          this.setData({
            extraNote: `当前账户时区：${response.data.user.timezone}`
          });
        }
      });
    }
  }
});
