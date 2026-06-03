import {
  deleteCalendarEvent,
  fetchCalendarByDate,
  fetchCalendarToday,
  fetchMe,
  type CalendarEventSummary
} from "../../lib/api";
import {
  buildWeekStrip,
  eventAccentColor,
  formatEventTimeRange,
  formatIsoDateLabel,
  formatMonthYear,
  formatWeekdayLong,
  isTodayIsoDate,
  todayIsoDate,
  type WeekDayItem
} from "../../lib/format";
import { SwipeListGesture, withSwipeRow, type SwipeListRowState } from "../../lib/swipe-list";
import { updateTabBarSelected } from "../../lib/tab-bar";

interface EventView extends CalendarEventSummary, SwipeListRowState {
  timeLabel: string;
  contactNames: string;
  accentColor: string;
}

Page({
  data: {
    loading: false,
    loaded: false,
    error: "",
    selectedDate: "",
    dateLabel: "",
    monthLabel: "",
    weekdayLabel: "",
    isToday: true,
    timezone: "",
    weekDays: [] as WeekDayItem[],
    events: [] as EventView[]
  },

  _swipeList: null as SwipeListGesture<EventView> | null,

  onLoad() {
    this.setData({ selectedDate: todayIsoDate() });
    this._swipeList = new SwipeListGesture<EventView>({
      getItems: () => this.data.events,
      setItems: (events) => this.setData({ events }),
      isDisabled: (item) => item.deleting || item.exiting,
      getDeleteModal: (item) => ({
        title: "删除日程",
        content: `确定删除“${item.title}”？`
      }),
      requestDelete: async (id) => {
        const response = await deleteCalendarEvent(id);
        return {
          ok: Boolean(response.ok),
          message: response.error?.message
        };
      },
      openEdit: (id) => {
        wx.navigateTo({ url: `/pages/event-edit/event-edit?id=${encodeURIComponent(id)}` });
      }
    });
    this._swipeList.updateDeleteActionWidth();
  },

  onShow() {
    updateTabBarSelected(1);
    this._swipeList?.updateDeleteActionWidth();
    this.loadEvents();
  },

  onPullDownRefresh() {
    this.loadEvents().finally(() => wx.stopPullDownRefresh());
  },

  loadEvents() {
    const selectedDate = this.data.selectedDate || todayIsoDate();
    this.setData({ loading: true, error: "" });

    const eventsRequest = isTodayIsoDate(selectedDate)
      ? fetchCalendarToday()
      : fetchCalendarByDate(selectedDate);

    return Promise.all([eventsRequest, fetchMe()])
      .then(([eventsRes, meRes]) => {
        if (!eventsRes.ok || !eventsRes.data) {
          this.setData({
            loading: false,
            loaded: true,
            error: eventsRes.error?.message || "加载失败，请在「我的」页检查 API 地址"
          });
          return;
        }

        const timezone = meRes.ok && meRes.data ? meRes.data.user.timezone : "";

        this.setData({
          loading: false,
          loaded: true,
          selectedDate,
          dateLabel: formatIsoDateLabel(selectedDate),
          monthLabel: formatMonthYear(selectedDate),
          weekdayLabel: formatWeekdayLong(selectedDate),
          isToday: isTodayIsoDate(selectedDate),
          timezone,
          weekDays: buildWeekStrip(selectedDate),
          events: eventsRes.data.items.map((item, index) =>
            withSwipeRow({
              ...item,
              timeLabel: formatEventTimeRange(item.startAt, item.endAt),
              contactNames: (item.contacts || []).map((c) => c.displayName).join("、"),
              accentColor: eventAccentColor(index)
            })
          )
        });
      })
      .catch(() => {
        this.setData({
          loading: false,
          loaded: true,
          error: "无法连接 API，请在「我的」页配置地址并开启「不校验合法域名」"
        });
      });
  },

  onSelectDay(e: { currentTarget: { dataset: { iso: string } } }) {
    const iso = e.currentTarget.dataset.iso;
    if (!iso || iso === this.data.selectedDate) return;
    this.setData({ selectedDate: iso }, () => this.loadEvents());
  },

  goToday() {
    this.setData({ selectedDate: todayIsoDate() }, () => this.loadEvents());
  },

  goMine() {
    wx.switchTab({ url: "/pages/mine/mine" });
  },

  onRowTouchStart(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    this._swipeList?.onRowTouchStart(e);
  },

  onSwipeMove(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }) {
    this._swipeList?.onSwipeMove(e);
  },

  onRowTouchEnd(e: {
    currentTarget: { dataset: { id: string } };
    changedTouches?: Array<{ clientX: number; clientY: number }>;
  }) {
    this._swipeList?.onRowTouchEnd(e);
  },

  onDeleteTap(e: { currentTarget: { dataset: { id: string } } }) {
    this._swipeList?.onDeleteTap(e);
  }
});
