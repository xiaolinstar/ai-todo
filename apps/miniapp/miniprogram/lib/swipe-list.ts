import { TODO_MODAL_CONFIRM_DANGER } from "./design-tokens";

export interface SwipeListRowState {
  id: string;
  swipeX: number;
  swiping: boolean;
  pressing: boolean;
  deleteVisible: boolean;
  deleting: boolean;
  exiting: boolean;
}

export const EXIT_ANIM_MS = 340;
const SWIPE_OPEN_THRESHOLD_RATIO = 0.42;
const SWIPE_TRIGGER_PX = 28;
const TAP_SLOP_PX = 12;

export interface SwipeListAdapter<T extends SwipeListRowState> {
  getItems(): T[];
  setItems(items: T[]): void;
  isDisabled(item: T): boolean;
  getDeleteModal(item: T): { title: string; content: string };
  requestDelete(id: string): Promise<{ ok: boolean; message?: string }>;
  openEdit(id: string): void;
}

export function withSwipeRow<T extends { id: string }>(item: T): T & SwipeListRowState {
  return {
    ...item,
    swipeX: 0,
    swiping: false,
    pressing: false,
    deleteVisible: false,
    deleting: false,
    exiting: false
  };
}

function isDeleteRevealed(swipeX: number): boolean {
  return Math.abs(swipeX) >= SWIPE_TRIGGER_PX;
}

function touchPoint(e: { touches?: Array<{ clientX: number; clientY: number }> }): {
  x: number;
  y: number;
} | null {
  const touch = e.touches?.[0];
  if (!touch) return null;
  return { x: touch.clientX, y: touch.clientY };
}

function changedTouchPoint(e: {
  changedTouches?: Array<{ clientX: number; clientY: number }>;
}): { x: number; y: number } | null {
  const touch = e.changedTouches?.[0];
  if (!touch) return null;
  return { x: touch.clientX, y: touch.clientY };
}

export class SwipeListGesture<T extends SwipeListRowState> {
  private _activeRowId = "";
  private _gestureSwipeActive = false;
  private _touchStartX = 0;
  private _touchStartY = 0;
  private _startSwipeX = 0;
  private _deleteActionWidthPx = 86;

  constructor(private readonly adapter: SwipeListAdapter<T>) {}

  updateDeleteActionWidth(): void {
    try {
      const systemInfo = wx.getSystemInfoSync();
      this._deleteActionWidthPx = Math.round((systemInfo.windowWidth * 160) / 750);
    } catch {
      this._deleteActionWidthPx = 86;
    }
  }

  patchItem(id: string, patch: Partial<T>): void {
    this.adapter.setItems(
      this.adapter.getItems().map((item) => (item.id === id ? { ...item, ...patch } : item))
    );
  }

  findItem(id: string): T | undefined {
    return this.adapter.getItems().find((item) => item.id === id);
  }

  closeOpenSwipes(exceptId = ""): void {
    this.adapter.setItems(
      this.adapter.getItems().map((item) =>
        item.id === exceptId || item.swipeX === 0
          ? item
          : { ...item, swipeX: 0, swiping: false, pressing: false, deleteVisible: false }
      )
    );
  }

  resetGesture(): void {
    this._activeRowId = "";
    this._gestureSwipeActive = false;
    this._startSwipeX = 0;
  }

  onRowTouchStart(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }): void {
    const point = touchPoint(e);
    if (!point) return;
    const id = e.currentTarget.dataset.id;
    const item = this.findItem(id);
    if (!item || this.adapter.isDisabled(item)) return;

    this._activeRowId = id;
    this._gestureSwipeActive = false;
    this._touchStartX = point.x;
    this._touchStartY = point.y;
    this._startSwipeX = item.swipeX;
    this.closeOpenSwipes(id);
    this.patchItem(id, {
      pressing: true,
      swiping: false,
      deleteVisible: isDeleteRevealed(item.swipeX)
    } as Partial<T>);
  }

  onSwipeMove(e: {
    currentTarget: { dataset: { id: string } };
    touches: Array<{ clientX: number; clientY: number }>;
  }): void {
    const point = touchPoint(e);
    const id = e.currentTarget.dataset.id;
    if (!point || id !== this._activeRowId) return;

    const deltaX = point.x - this._touchStartX;
    const deltaY = point.y - this._touchStartY;
    if (Math.abs(deltaY) > Math.abs(deltaX) && Math.abs(deltaY) > 10) return;

    const canSwipe =
      this._gestureSwipeActive ||
      this._startSwipeX !== 0 ||
      Math.abs(deltaX) >= SWIPE_TRIGGER_PX;
    if (!canSwipe) return;

    this._gestureSwipeActive = true;
    const swipeX = Math.max(
      -this._deleteActionWidthPx,
      Math.min(0, this._startSwipeX + deltaX)
    );
    this.patchItem(id, {
      swipeX,
      swiping: true,
      pressing: false,
      deleteVisible: isDeleteRevealed(swipeX)
    } as Partial<T>);
  }

  onRowTouchEnd(e: {
    currentTarget: { dataset: { id: string } };
    changedTouches?: Array<{ clientX: number; clientY: number }>;
  }): void {
    const id = e.currentTarget.dataset.id;
    if (id !== this._activeRowId) {
      this.resetGesture();
      return;
    }

    const item = this.findItem(id);
    if (!item) {
      this.resetGesture();
      return;
    }

    const point = changedTouchPoint(e);
    const moved = point
      ? Math.hypot(point.x - this._touchStartX, point.y - this._touchStartY)
      : 0;

    let swipeX = item.swipeX;
    if (this._gestureSwipeActive) {
      const shouldOpen =
        Math.abs(swipeX) >= this._deleteActionWidthPx * SWIPE_OPEN_THRESHOLD_RATIO;
      swipeX = shouldOpen ? -this._deleteActionWidthPx : 0;
    } else if (moved < TAP_SLOP_PX) {
      swipeX = 0;
      if (!isDeleteRevealed(this._startSwipeX) && !this.adapter.isDisabled(item)) {
        this.adapter.openEdit(id);
      }
    } else {
      swipeX = this._startSwipeX;
    }

    this.patchItem(id, {
      swipeX,
      swiping: false,
      pressing: false,
      deleteVisible: isDeleteRevealed(swipeX)
    } as Partial<T>);
    this.resetGesture();
  }

  onDeleteTap(e: { currentTarget: { dataset: { id: string } } }): void {
    const id = e.currentTarget.dataset.id;
    const item = this.findItem(id);
    if (!item || item.deleting || item.exiting || this.adapter.isDisabled(item)) return;

    const modal = this.adapter.getDeleteModal(item);
    wx.showModal({
      title: modal.title,
      content: modal.content,
      confirmText: "删除",
      confirmColor: TODO_MODAL_CONFIRM_DANGER,
      success: (res) => {
        if (!res.confirm) {
          this.patchItem(id, { swipeX: 0, swiping: false, deleteVisible: false } as Partial<T>);
          return;
        }
        this.deleteItem(id);
      }
    });
  }

  deleteItem(id: string): void {
    this.patchItem(id, {
      deleting: true,
      exiting: true,
      swiping: false,
      deleteVisible: false
    } as Partial<T>);

    this.adapter
      .requestDelete(id)
      .then((result) => {
        if (!result.ok) {
          this.patchItem(id, { deleting: false, exiting: false, swipeX: 0 } as Partial<T>);
          wx.showToast({ title: result.message || "删除失败", icon: "none" });
          return;
        }

        setTimeout(() => {
          this.adapter.setItems(this.adapter.getItems().filter((item) => item.id !== id));
          wx.showToast({ title: "已删除", icon: "success" });
        }, EXIT_ANIM_MS);
      })
      .catch(() => {
        this.patchItem(id, { deleting: false, exiting: false, swipeX: 0 } as Partial<T>);
        wx.showToast({ title: "删除失败", icon: "none" });
      });
  }
}
