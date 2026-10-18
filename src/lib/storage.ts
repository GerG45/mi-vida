export function readStored<T>(key: string, fallback: T): T {
  try { const raw = localStorage.getItem('mi-vida:v1:' + key); return raw ? JSON.parse(raw) as T : fallback; } catch { return fallback; }
}
export function saveStored(key: string, value: unknown): boolean {
  try { localStorage.setItem('mi-vida:v1:' + key, JSON.stringify(value)); return true; } catch { return false; }
}
export function download(name: string, data: string, type = 'application/json') {
  const url = URL.createObjectURL(new Blob([data], {type}));
  const a = document.createElement('a'); a.href = url; a.download = name; a.click();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
