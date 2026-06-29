const STORAGE_PREFIX = 'avatar_path_';

function storageKey(userId: string): string {
  return `${STORAGE_PREFIX}${userId}`;
}

/** wx.chooseAvatar returns temp paths that expire after restart / re-login. */
export function isTransientAvatarPath(path: string): boolean {
  const value = (path || '').trim();
  if (!value) return false;
  return /^wxfile:\/\/tmp/i.test(value) || /^http:\/\/tmp\//i.test(value);
}

export function getCachedAvatarPath(userId: string): string {
  if (!userId) return '';
  try {
    const value = wx.getStorageSync(storageKey(userId));
    return typeof value === 'string' ? value.trim() : '';
  } catch {
    return '';
  }
}

function setCachedAvatarPath(userId: string, path: string): void {
  if (!userId || !path) return;
  try {
    wx.setStorageSync(storageKey(userId), path);
  } catch {
    // ignore quota errors
  }
}

function canAccessFile(path: string): boolean {
  if (!path) return false;
  try {
    wx.getFileSystemManager().accessSync(path);
    return true;
  } catch {
    return false;
  }
}

/** Prefer persisted local file; fall back to server URL when still valid. */
export function resolveAvatarDisplayUrl(userId: string, serverUrl?: string): string {
  const cached = getCachedAvatarPath(userId);
  if (cached && canAccessFile(cached)) {
    return cached;
  }

  const server = (serverUrl || '').trim();
  if (!server) return '';
  if (isTransientAvatarPath(server)) {
    return cached && canAccessFile(cached) ? cached : '';
  }
  if (canAccessFile(server)) {
    return server;
  }
  return server;
}

/** Copy temp avatar into persistent local storage for the same device. */
export function persistAvatarFromTemp(userId: string, tempPath: string): Promise<string> {
  const trimmed = (tempPath || '').trim();
  if (!userId || !trimmed) {
    return Promise.resolve(trimmed);
  }

  if (!isTransientAvatarPath(trimmed) && canAccessFile(trimmed)) {
    setCachedAvatarPath(userId, trimmed);
    return Promise.resolve(trimmed);
  }

  const previous = getCachedAvatarPath(userId);

  return new Promise((resolve) => {
    wx.saveFile({
      tempFilePath: trimmed,
      success: (res) => {
        const saved = (res.savedFilePath || '').trim();
        if (!saved) {
          resolve(trimmed);
          return;
        }
        setCachedAvatarPath(userId, saved);
        if (previous && previous !== saved && canAccessFile(previous)) {
          try {
            wx.getFileSystemManager().unlink({ filePath: previous });
          } catch {
            // ignore cleanup errors
          }
        }
        resolve(saved);
      },
      fail: () => resolve(trimmed),
    });
  });
}
