import { get, set, del } from 'idb-keyval';

// IndexedDBから読み込み（失敗時はnull）
export async function idbGet<T>(key: string): Promise<T | null> {
  try {
    const value = await get<T>(key);
    return value ?? null;
  } catch {
    return null;
  }
}

// IndexedDBへ保存（成否をbooleanで返す）
export async function idbSet<T>(key: string, value: T): Promise<boolean> {
  try {
    await set(key, value);
    return true;
  } catch {
    return false;
  }
}

// IndexedDBから削除
export async function idbDel(key: string): Promise<void> {
  try {
    await del(key);
  } catch { /* ignore */ }
}

// localStorage → IndexedDB へのコピー（初回移行用）
// 既にIndexedDB側にデータがある場合は何もしない（上書き防止）
export async function migrateFromLocalStorage(key: string): Promise<void> {
  try {
    const existing = await get(key);
    if (existing !== undefined) return; // 既に移行済み
    const raw = localStorage.getItem(key);
    if (!raw) return;
    await set(key, JSON.parse(raw));
  } catch { /* ignore */ }
}
