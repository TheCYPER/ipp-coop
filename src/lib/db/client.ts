/**
 * Read-only client for the shared BUS2010 Supabase database (PostgREST over fetch, no extra dependency).
 *
 * Reads use the publishable key, which only allows SELECT under row level security, so it is safe in the
 * browser bundle. Writes are deliberately not here: they go through server routes that read the team's
 * key from the environment (docs/ARCHITECTURE.md, "Data migration path", stage 3).
 */

const DEFAULT_URL = "https://zbcgneyhwuswyxeaufjh.supabase.co";
// Publishable (read-only) key. Not a secret: the shared data are synthetic and RLS blocks every write.
const DEFAULT_KEY = "sb_publishable_YFs2qxwH6YU7-F-_8_ppoQ_-hW861yy";
const PAGE_SIZE = 1000;

export interface DbOptions {
  /** Base URL of the Supabase project. Defaults to VITE_SHARED_DB_URL or the shared project. */
  url?: string;
  /** Publishable key. Defaults to VITE_SHARED_DB_KEY or the shared project's key. */
  key?: string;
  /** Injected for tests. */
  fetch?: typeof fetch;
  /** Abort a request after this many milliseconds (default 10 000). */
  timeoutMs?: number;
}

export class SharedDbError extends Error {
  readonly status: number | null;
  constructor(message: string, status: number | null = null) {
    super(message);
    this.name = "SharedDbError";
    this.status = status;
  }
}

function env(name: string): string | undefined {
  const meta = import.meta as unknown as { env?: Record<string, string | undefined> };
  const value = meta.env?.[name];
  return value && value.trim() ? value.trim() : undefined;
}

export function dbConfig(opts: DbOptions = {}): { url: string; key: string } {
  return {
    url: (opts.url ?? env("VITE_SHARED_DB_URL") ?? DEFAULT_URL).replace(/\/+$/, ""),
    key: opts.key ?? env("VITE_SHARED_DB_KEY") ?? DEFAULT_KEY,
  };
}

async function request<T>(path: string, init: RequestInit, opts: DbOptions): Promise<T> {
  const { url, key } = dbConfig(opts);
  const doFetch = opts.fetch ?? globalThis.fetch;
  if (!doFetch) throw new SharedDbError("fetch is not available in this environment");
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), opts.timeoutMs ?? 10_000);
  try {
    const res = await doFetch(`${url}${path}`, {
      ...init,
      signal: controller.signal,
      headers: { apikey: key, Accept: "application/json", ...(init.headers as Record<string, string> | undefined) },
    });
    const text = await res.text();
    let body: unknown = null;
    try {
      body = text ? JSON.parse(text) : null;
    } catch {
      body = text;
    }
    if (!res.ok) {
      const message =
        body && typeof body === "object" && "message" in body && typeof body.message === "string"
          ? body.message
          : `HTTP ${res.status}`;
      throw new SharedDbError(message, res.status);
    }
    return body as T;
  } catch (error) {
    if (error instanceof SharedDbError) throw error;
    if (error instanceof Error && error.name === "AbortError") {
      throw new SharedDbError(`The shared database did not answer within ${opts.timeoutMs ?? 10_000} ms`);
    }
    throw new SharedDbError(error instanceof Error ? error.message : "Network error");
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Reads every row of a table or view, PAGE_SIZE rows at a time.
 * `query` holds PostgREST parameters, for example { select: "student_id,full_name", student_id: "eq.COOP-B001", order: "student_id" }.
 */
export async function selectAll<T>(view: string, query: Record<string, string> = {}, opts: DbOptions = {}): Promise<T[]> {
  if (!/^[a-z_]+$/.test(view)) throw new SharedDbError(`Not a table or view name: ${view}`);
  const rows: T[] = [];
  for (let offset = 0; ; offset += PAGE_SIZE) {
    const params = new URLSearchParams({ ...query, limit: String(PAGE_SIZE), offset: String(offset) });
    const page = await request<T[]>(`/rest/v1/${view}?${params.toString()}`, { method: "GET" }, opts);
    rows.push(...(page ?? []));
    if (!page || page.length < PAGE_SIZE) return rows;
  }
}

/** Calls a read-only database function, for example `ai_signals`. */
export function rpc<T>(fn: string, args: Record<string, unknown>, opts: DbOptions = {}): Promise<T> {
  if (!/^[a-z_]+$/.test(fn)) throw new SharedDbError(`Not a function name: ${fn}`);
  return request<T>(`/rest/v1/rpc/${fn}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(args),
  }, opts);
}

/** Calls a Supabase Edge Function, for example `ai-suggest`. */
export function callFunction<T>(name: string, body: Record<string, unknown>, opts: DbOptions = {}): Promise<T> {
  if (!/^[a-z-]+$/.test(name)) throw new SharedDbError(`Not a function name: ${name}`);
  return request<T>(`/functions/v1/${name}`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(body),
  }, { ...opts, timeoutMs: opts.timeoutMs ?? 25_000 });
}

/** PostgREST filter helpers. */
export const eq = (value: string | number): string => `eq.${value}`;
export const inList = (values: (string | number)[]): string => `in.(${values.map((v) => `"${String(v).replace(/"/g, "")}"`).join(",")})`;
