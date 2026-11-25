/**
 * Fetch wrapper for the Athleet API.
 * - The access token lives only in memory (never localStorage), so XSS cannot read a persisted token.
 * - The refresh token is an HttpOnly SameSite=Strict cookie scoped to /api/v1/auth; on a 401 we refresh once and retry.
 */
const BASE = '/api/v1';

let accessToken: string | null = null;
let refreshing: Promise<boolean> | null = null;
let onSessionExpired: (() => void) | null = null;

export function setAccessToken(token: string | null) {
  accessToken = token;
}

export function setSessionExpiredHandler(fn: () => void) {
  onSessionExpired = fn;
}

export interface FieldError {
  field: string;
  message: string;
}

export class ApiError extends Error {
  constructor(public status: number, public code: string, message: string, public fields: FieldError[] = []) {
    super(message);
  }
}

export async function refreshSession(): Promise<boolean> {
  if (!refreshing) {
    refreshing = (async () => {
      try {
        const res = await fetch(`${BASE}/auth/refresh`, { method: 'POST', credentials: 'same-origin' });
        if (!res.ok) {
          accessToken = null;
          return false;
        }
        const body = await res.json();
        accessToken = body.accessToken;
        return true;
      } catch {
        return false;
      } finally {
        setTimeout(() => (refreshing = null), 0);
      }
    })();
  }
  return refreshing;
}

type Query = Record<string, string | number | boolean | undefined | null>;

function buildUrl(path: string, query?: Query) {
  const url = new URL(BASE + path, window.location.origin);
  if (query) {
    for (const [k, v] of Object.entries(query)) {
      if (v !== undefined && v !== null && v !== '') url.searchParams.set(k, String(v));
    }
  }
  return url.pathname + url.search;
}

async function request<T>(method: string, path: string, body?: unknown, query?: Query, retry = true): Promise<T> {
  const headers: Record<string, string> = { Accept: 'application/json' };
  const isForm = typeof FormData !== 'undefined' && body instanceof FormData;
  if (body !== undefined && !isForm) headers['Content-Type'] = 'application/json'; // FormData sets its own multipart boundary
  if (accessToken) headers.Authorization = `Bearer ${accessToken}`;
  const res = await fetch(buildUrl(path, query), {
    method,
    headers,
    body: body === undefined ? undefined : isForm ? (body as FormData) : JSON.stringify(body),
    credentials: 'same-origin',
  });
  if (res.status === 401 && retry && !path.startsWith('/auth/')) {
    if (await refreshSession()) return request<T>(method, path, body, query, false);
    onSessionExpired?.();
  }
  if (!res.ok) {
    let code = 'ERROR';
    let message = 'Something went wrong. Please try again.';
    let fields: FieldError[] = [];
    try {
      const err = await res.json();
      code = err.code ?? code;
      message = err.message ?? message;
      fields = err.fields ?? [];
    } catch {
      /* non-JSON error body */
    }
    throw new ApiError(res.status, code, message, fields);
  }
  if (res.status === 204) return undefined as T;
  // A CSV file (the import template) comes back as a file, everything else as JSON.
  if ((res.headers.get('content-type') ?? '').startsWith('text/csv')) return (await res.blob()) as T;
  return (await res.json()) as T;
}

export const api = {
  get: <T>(path: string, query?: Query) => request<T>('GET', path, undefined, query),
  post: <T>(path: string, body?: unknown) => request<T>('POST', path, body ?? {}),
  put: <T>(path: string, body: unknown) => request<T>('PUT', path, body),
  upload: <T>(path: string, form: FormData) => request<T>('POST', path, form),
  download: (path: string) => request<Blob>('GET', path),
  del: <T = void>(path: string) => request<T>('DELETE', path),
};

/** Turns an ApiError's field list into { field: message } for forms. */
export function fieldErrors(e: unknown): Record<string, string> {
  if (!(e instanceof ApiError)) return {};
  return Object.fromEntries(e.fields.map((f) => [f.field, f.message]));
}

export function isStale(e: unknown): boolean {
  return e instanceof ApiError && e.status === 409 && e.code === 'STALE_DATA';
}

export function errorMessage(e: unknown): string {
  if (isStale(e)) return 'This record was changed by someone else. It has been reloaded; please try again.';
  return e instanceof ApiError ? e.message : 'Something went wrong. Please try again.';
}
