import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";

const source = vi.hoisted(() => ({ loadMatchData: vi.fn(), withAiSignals: vi.fn() }));
vi.mock("@/lib/p05/source", async (importOriginal) => ({ ...(await importOriginal<object>()), ...source }));
const db = vi.hoisted(() => ({ getChallenges: vi.fn(), getGapEvents: vi.fn(), getRecommendationHistory: vi.fn(), getRecommendationsByIds: vi.fn(), suggestSkillsLive: vi.fn() }));
vi.mock("@/lib/db", async (importOriginal) => ({ ...(await importOriginal<object>()), ...db }));

import { P05Coordinator } from "@/components/p05/coordinator/P05Coordinator";
import type { ChallengeRow, RecommendationRow } from "@/lib/db";
import { DEMO_DATA, DRAFTS_KEY, parseDrafts } from "@/lib/p05";

// Newer Node versions ship their own localStorage, which hides jsdom's; use an in-memory one so the test runs anywhere.
const memory = new Map<string, string>();
Object.defineProperty(window, "localStorage", {
  configurable: true,
  value: {
    getItem: (k: string) => memory.get(k) ?? null,
    setItem: (k: string, v: string) => void memory.set(k, String(v)),
    removeItem: (k: string) => void memory.delete(k),
    clear: () => memory.clear(),
    key: (i: number) => [...memory.keys()][i] ?? null,
    get length() { return memory.size; },
  },
});

const LIVE = { data: DEMO_DATA, source: { mode: "live", loadedAt: "2026-11-23T00:00:00Z", counts: { students: 6, listings: 6, skills: 14 } } };
const WAIT = { timeout: 4000 };

const stored: RecommendationRow = {
  recommendation_id: "R-OLD", student_id: "COOP-B005", profile_version: 3, opportunity_id: "OP-028", opportunity_version: 2,
  method_id: "rules-1.0.0", status: "eligible", status_reason: "", rank: 1, pref_points: 2, computed_at: "2026-11-10T08:00:00Z",
};
const question: ChallengeRow = {
  challenge_id: "CH-1", recommendation_id: "R-OLD", raised_by: "COOP-B005", question: "Why can I apply here but not to the airport job?",
  status: "open", resolution: null, resolved_by: null, resolved_at: null, created_at: "2026-11-20T09:00:00Z",
};

function renderPage(student = "COOP-B005") {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(<QueryClientProvider client={client}><P05Coordinator initialStudent={student} /></QueryClientProvider>);
}
const openTab = (name: RegExp) => fireEvent.mouseDown(screen.getByRole("tab", { name }), { button: 0 });

describe("P05 coordinator page", () => {
  beforeEach(() => {
    Object.values(source).forEach((f) => f.mockReset());
    Object.values(db).forEach((f) => f.mockReset());
    source.withAiSignals.mockResolvedValue(DEMO_DATA.ai);
    db.getChallenges.mockResolvedValue([question]);
    db.getRecommendationsByIds.mockResolvedValue([stored]);
    db.getGapEvents.mockResolvedValue([]);
    db.getRecommendationHistory.mockResolvedValue([stored]);
    window.localStorage.clear();
  });

  it("D7: flags results stored for an older profile version as out of date", async () => {
    source.loadMatchData.mockResolvedValue(LIVE);
    renderPage();
    expect(await screen.findByText("Out of date.", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText(/computed from profile v3; the profile is now v4/)).toBeInTheDocument();
    expect(screen.getByRole("heading", { name: "What the system looked at" })).toBeInTheDocument();
  });

  it("works on the demo data and says which parts need the shared database", async () => {
    source.loadMatchData.mockRejectedValue(new Error("offline"));
    renderPage();
    expect(await screen.findByText("Demo data — couldn’t reach the shared database.", {}, WAIT)).toBeInTheDocument();
    expect(screen.getByText(/Stored results come from the shared database/)).toBeInTheDocument();
    expect(db.getRecommendationHistory).not.toHaveBeenCalled();
    openTab(/Questions/);
    expect(await screen.findByText(/Students’ questions come from the shared database/)).toBeInTheDocument();
  });

  it("saves a reply as a draft in this browser and opens the result the question is about", async () => {
    source.loadMatchData.mockResolvedValue(LIVE);
    renderPage("COOP-B001");
    await screen.findByText(/Live from the shared BUS2010 database/, {}, WAIT);
    openTab(/Questions/);
    const item = (await screen.findByText(/Why can I apply here/, {}, WAIT)).closest("li")!;
    fireEvent.change(within(item).getByLabelText("Your reply"), { target: { value: "  You meet every requirement of this job.  " } });
    fireEvent.click(within(item).getByRole("button", { name: "Save draft" }));
    expect(parseDrafts(window.localStorage.getItem(DRAFTS_KEY))).toMatchObject([{ kind: "reply", challenge_id: "CH-1", text: "You meet every requirement of this job." }]);
    fireEvent.click(await within(item).findByRole("button", { name: "Check this result" }));
    expect(await screen.findByRole("heading", { name: /Noura Al-Hammadi/ })).toBeInTheDocument();
    expect((screen.getByLabelText("Job to check") as HTMLSelectElement).value).toBe("OP-028");
  });

  it("keeps an AI skill suggestion unconfirmed until a person decides, then writes a note for P01", async () => {
    source.loadMatchData.mockRejectedValue(new Error("offline"));
    const withPhrase = DEMO_DATA.profiles.find((p) => p.unmapped_skills.length > 0)!;
    renderPage(withPhrase.student_id);
    await screen.findByText("Demo data — couldn’t reach the shared database.", {}, WAIT);
    openTab(/AI suggestions/);
    const confirm = (await screen.findAllByRole("button", { name: "Confirm" }))[0]!;
    expect(confirm).toHaveAttribute("aria-pressed", "false");
    fireEvent.click(confirm);
    expect(confirm).toHaveAttribute("aria-pressed", "true");
    const saved = parseDrafts(window.localStorage.getItem(DRAFTS_KEY));
    expect(saved).toHaveLength(1);
    expect(saved[0]).toMatchObject({ kind: "suggestion", student_id: withPhrase.student_id, decision: "confirm" });
    expect(screen.getByText(/Please add it to the profile as self-declared/)).toBeInTheDocument();
    fireEvent.click(confirm); // a second click withdraws the decision
    expect(parseDrafts(window.localStorage.getItem(DRAFTS_KEY))).toEqual([]);
  });

  it("shows the AI never changed who can apply", async () => {
    source.loadMatchData.mockRejectedValue(new Error("offline"));
    renderPage("COOP-B001");
    await screen.findByText("Demo data — couldn’t reach the shared database.", {}, WAIT);
    openTab(/Rules vs AI/);
    const stat = (await screen.findByText("jobs where the AI changed who can apply")).parentElement!;
    expect(within(stat).getByText("0")).toBeInTheDocument();
  });
});
