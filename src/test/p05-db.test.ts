import { describe, expect, it, vi } from "vitest";
import { dbConfig, eq, getAiSignals, getProfileFeed, inList, rpc, selectAll, SharedDbError } from "@/lib/db";

type Call = { url: string; init: RequestInit };

function fakeFetch(pages: unknown[], status = 200) {
  const calls: Call[] = [];
  let i = 0;
  const fn = vi.fn(async (url: string | URL | Request, init?: RequestInit) => {
    calls.push({ url: String(url), init: init ?? {} });
    const body = pages[Math.min(i++, pages.length - 1)];
    return {
      ok: status >= 200 && status < 300,
      status,
      text: async () => JSON.stringify(body),
    } as Response;
  });
  return { fn: fn as unknown as typeof fetch, calls };
}

const opts = (f: typeof fetch) => ({ url: "https://example.supabase.co/", key: "sb_publishable_test", fetch: f });

describe("shared database client (P05)", () => {
  it("sends the publishable key and PostgREST filters", async () => {
    const { fn, calls } = fakeFetch([[{ student_id: "COOP-B001" }]]);
    const rows = await getProfileFeed("COOP-B001", opts(fn));
    expect(rows).toEqual([{ student_id: "COOP-B001" }]);
    const call = calls[0]!;
    expect(call.url).toContain("https://example.supabase.co/rest/v1/profile_feed?");
    expect(call.url).toContain("student_id=eq.COOP-B001");
    expect(call.url).toContain("order=student_id%2Cprofile_version");
    expect((call.init.headers as Record<string, string>)["apikey"]).toBe("sb_publishable_test");
    expect(call.init.method).toBe("GET");
  });

  it("pages through results 1000 rows at a time", async () => {
    const full = Array.from({ length: 1000 }, (_, n) => ({ n }));
    const { fn, calls } = fakeFetch([full, [{ n: 1000 }, { n: 1001 }]]);
    const rows = await selectAll<{ n: number }>("skills", { select: "*" }, opts(fn));
    expect(rows).toHaveLength(1002);
    expect(calls).toHaveLength(2);
    expect(calls[1]!.url).toContain("offset=1000");
  });

  it("calls database functions with a JSON body", async () => {
    const { fn, calls } = fakeFetch([{ model: "Supabase/gte-small", goal_embedded: true, goal: { "OP-028@2": 0.9117 }, phrases: {} }]);
    const res = await getAiSignals("Learn airline operations", ["agile board hygiene"], opts(fn));
    expect(res.goal["OP-028@2"]).toBe(0.9117);
    expect(calls[0]!.url).toBe("https://example.supabase.co/rest/v1/rpc/ai_signals");
    expect(JSON.parse(String(calls[0]!.init.body))).toEqual({ p_goal: "Learn airline operations", p_phrases: ["agile board hygiene"] });
  });

  it("turns an HTTP error into a SharedDbError with the database's message", async () => {
    const { fn } = fakeFetch([{ message: "permission denied for table students" }], 401);
    const error = await rpc("whoami", {}, opts(fn)).catch((e: unknown) => e);
    expect(error).toBeInstanceOf(SharedDbError);
    expect((error as SharedDbError).status).toBe(401);
    expect((error as SharedDbError).message).toBe("permission denied for table students");
  });

  it("refuses names that are not tables or functions", async () => {
    const { fn } = fakeFetch([[]]);
    await expect(selectAll("skills; drop", {}, opts(fn))).rejects.toBeInstanceOf(SharedDbError);
  });

  it("builds filters and defaults to the shared project", () => {
    expect(eq("OP-028")).toBe("eq.OP-028");
    expect(inList(["OP-026", "OP-028"])).toBe('in.("OP-026","OP-028")');
    expect(dbConfig().url).toBe("https://zbcgneyhwuswyxeaufjh.supabase.co");
    expect(dbConfig().key.startsWith("sb_publishable_")).toBe(true);
  });
});
