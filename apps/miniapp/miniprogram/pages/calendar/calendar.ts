import { loadAccountDay } from "../../lib/account-day";
import {
  deleteCalendarEvent,
  fetchCalendarByDate,
  fetchCalendarToday,
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
  type WeekDayItem
} from "../../lib/format";
import { loadContentPrefs } from "../../lib/content-prefs";
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
    loadContentPrefs().then((prefs) => {
      const openToday = prefs.calendar.selectTodayOnOpen;
      if (openToday) {
        return loadAccountDay().then(({ today }) => {
          this.setData({ selectedDate: today }, () => this.loadEvents());
        });
      }
      this.loadEvents();
    });
  },

  onPullDownRefresh() {
    this.loadEvents().finally(() => wx.stopPullDownRefresh());
  },

  loadEvents() {
    this.setData({ loading: true, error: "" });

    return loadAccountDay()
      .then(({ timezone, today: accountToday }) => {
        const selectedDate = this.data.selectedDate || accountToday;

        const eventsRequest = isTodayIsoDate(selectedDate, accountToday)
          ? fetchCalendarToday()
          : fetchCalendarByDate(selectedDate);

        return eventsRequest.then((eventsRes) => {
          if (!eventsRes.ok || !eventsRes.data) {
            this.setData({
              loading: false,
              loaded: true,
              error: eventsRes.error?.message || "加载失败，请在「我的」页检查 API 地址"
            });
            return;
          }

          this.setData({
            loading: false,
            loaded: true,
            selectedDate,
            dateLabel: formatIsoDateLabel(selectedDate),
            monthLabel: formatMonthYear(selectedDate),
            weekdayLabel: formatWeekdayLong(selectedDate),
            isToday: isTodayIsoDate(selectedDate, accountToday),
            timezone,
            weekDays: buildWeekStrip(selectedDate, accountToday),
            events: eventsRes.data.items.map((item, index) =>
              withSwipeRow({
                ...item,
                timeLabel: formatEventTimeRange(item.startAt, item.endAt, timezone),
                contactNames: (item.contacts || []).map((c) => c.displayName).join("、"),
                accentColor: eventAccentColor(index)
              })
            )
          });
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
    this.setData({ selectedDate: "" }, () => this.loadEvents());
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
