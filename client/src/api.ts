const fetchOpts: RequestInit = { credentials: 'include' };

function headers(json = true): HeadersInit {
  const h: Record<string, string> = {};
  if (json) h['Content-Type'] = 'application/json';
  return h;
}

export async function apiGet<T = unknown>(path: string): Promise<T> {
  const res = await fetch(path, { ...fetchOpts, headers: headers(false) });
  if (res.status === 401 && !path.includes('auth/login')) {
    window.dispatchEvent(new CustomEvent('pulsebeat:unauthorized'));
  }
  if (!res.ok) {
    const err = (await res.json().catch(() => ({}))) as { error?: string };
    throw new Error(err.error || res.statusText);
  }
  return res.json() as Promise<T>;
}

export async function apiSend<T = unknown>(
  path: string,
  method: string,
  body?: unknown
): Promise<T | null> {
  const res = await fetch(path, {
    ...fetchOpts,
    method,
    headers: headers(true),
    body: body !== undefined ? JSON.stringify(body) : undefined,
  });
  if (res.status === 401 && !path.includes('auth/login')) {
    window.dispatchEvent(new CustomEvent('pulsebeat:unauthorized'));
  }
  if (res.status === 204) return null;
  const raw: unknown = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = raw as { error?: string };
    throw new Error(err.error || res.statusText);
  }
  return raw as T;
}
