/**
 * P05 coordinator logic: stored-result staleness (D7), rules against AI, AI skill suggestions and
 * "what the system looked at". Runs on the demo slice, which matches the shared database.
 */
import { describe, expect, it } from "vitest";
import type { RecommendationRow } from "@/lib/db";
import {
  compareMethods,
  DEMO_DATA,
  fieldsUsed,
  findDraft,
  historyFor,
  latestProfile,
  matchStudent,
  parseDrafts,
  phraseSuggestions,
  removeDraft,
  replyKey,
  staleness,
  suggestionKey,
  suggestionNote,
  upsertDraft,
  type Draft,
  type MatchData,
} from "@/lib/p05";

const STUDENTS = ["COOP-B001", "COOP-B002", "COOP-B003", "COOP-B004", "COOP-B005", "COOP-B006"];

function row(over: Partial<RecommendationRow>): RecommendationRow {
  return {
    recommendation_id: "R-1", student_id: "COOP-B005", profile_version: 3, opportunity_id: "OP-028", opportunity_version: 2,
    method_id: "rules-1.0.0", status: "eligible", status_reason: "", rank: 1, pref_points: 3, computed_at: "2026-11-01T10:00:00Z",
    ...over,
  };
}

describe("P05 coordinator: stored results", () => {
  it("D7: a result stored for an older profile version is flagged as out of date", () => {
    const profile = latestProfile(DEMO_DATA, "COOP-B005")!;
    const history = [row({ profile_version: profile.profile_version - 1 }), row({ recommendation_id: "R-2", method_id: "ai-embed-1.0.0", computed_at: "2026-11-02T10:00:00Z", profile_version: profile.profile_version - 1 })];
    const s = staleness(history, profile);
    expect(s).toMatchObject({ storedVersion: profile.profile_version - 1, currentVersion: profile.profile_version, stale: true, storedCount: 2, lastComputed: "2026-11-02T10:00:00Z" });
    expect(history).toHaveLength(2); // nothing passed in is changed
  });

  it("is not stale when nothing is stored or the stored version is current", () => {
    const profile = latestProfile(DEMO_DATA, "COOP-B001")!;
    expect(staleness([], profile)).toMatchObject({ storedVersion: null, stale: false, storedCount: 0, lastComputed: null });
    expect(staleness([row({ student_id: "COOP-B001", profile_version: profile.profile_version })], profile).stale).toBe(false);
    // rows for other students are ignored
    expect(staleness([row({ student_id: "COOP-B002", profile_version: 1 })], profile).storedCount).toBe(0);
  });

  it("lists one job's stored results newest first", () => {
    const h = [row({ recommendation_id: "a", computed_at: "2026-11-01T00:00:00Z" }), row({ recommendation_id: "b", opportunity_id: "OP-029" }), row({ recommendation_id: "c", computed_at: "2026-11-03T00:00:00Z" })];
    expect(historyFor(h, "OP-028").map((x) => x.recommendation_id)).toEqual(["c", "a"]);
    expect(h.map((x) => x.recommendation_id)).toEqual(["a", "b", "c"]);
  });
});

describe("P05 coordinator: rules against AI", () => {
  it("the AI never changes who can apply, for any demo student", () => {
    for (const s of STUDENTS) expect(compareMethods(DEMO_DATA, s, DEMO_DATA.ai)?.eligibilityChanged).toBe(0);
  });

  it("shows both ranks for the same jobs and says where the AI scores came from", () => {
    const c = compareMethods(DEMO_DATA, "COOP-B001", DEMO_DATA.ai)!;
    expect(c.rows.length).toBeGreaterThan(0);
    expect(c.rows.length).toBeLessThanOrEqual(8);
    expect(new Set(c.rows.map((r) => r.opportunity_id)).size).toBe(c.rows.length);
    c.rows.forEach((r) => expect(r.rules.status).toBe(r.ai.status));
    expect(c.rows.map((r) => r.ai.rank)).toEqual([...c.rows.map((r) => r.ai.rank)].sort((a, b) => a - b));
    expect(c.aiSource).toBe("embedding");
  });

  it("labels the fallback when no AI scores are available", () => {
    const c = compareMethods({ ...DEMO_DATA, ai: null }, "COOP-B001", null)!;
    expect(c.aiSource).not.toBe("embedding");
    expect(c.eligibilityChanged).toBe(0);
  });

  it("returns null for an unknown student", () => {
    expect(compareMethods(DEMO_DATA, "COOP-NOPE", DEMO_DATA.ai)).toBeNull();
  });
});

describe("P05 coordinator: AI skill suggestions", () => {
  const withPhrases = STUDENTS.map((s) => latestProfile(DEMO_DATA, s)!).find((p) => p.unmapped_skills.length > 0)!;

  it("turns stored gte-small scores into named suggestions; only scores above the bar are suggested", () => {
    const list = phraseSuggestions(withPhrases, DEMO_DATA.vocabulary, DEMO_DATA.ai);
    expect(list.map((x) => x.phrase)).toEqual(withPhrases.unmapped_skills);
    const scored = list.find((x) => x.suggestions)!;
    scored.suggestions!.forEach((s) => {
      expect(s.label).not.toBe("");
      expect(s.suggested).toBe(s.score >= 0.84);
    });
  });

  it("has no suggestions (not invented ones) when no AI scores are available", () => {
    expect(phraseSuggestions(withPhrases, DEMO_DATA.vocabulary, null).every((x) => x.suggestions === null)).toBe(true);
  });

  it("writes a note for the profile team instead of changing the profile", () => {
    expect(suggestionNote("confirm", "jira boards", "SK-JIRA-01", "Jira", 0.87)).toMatch(/SK-JIRA-01.*self-declared/);
    expect(suggestionNote("reject", "jira boards", "SK-JIRA-01", "Jira", 0.87)).toMatch(/rejected.*is not SK-JIRA-01/);
  });
});

describe("P05 coordinator: what the system looked at", () => {
  const data: MatchData = DEMO_DATA;

  it("lists only the inputs a result used, each with its version", () => {
    const res = matchStudent(data, "COOP-B001", "rules")!;
    const r = res.records.find((x) => x.status !== "excluded" && x.mandatory.length > 0)!;
    const listing = data.listings.find((l) => l.opportunity_id === r.opportunity_id);
    const used = fieldsUsed(r, res.profile, listing, data.vocabulary);
    expect(used.length).toBeGreaterThan(0);
    used.forEach((f) => expect(f.owner).toMatch(new RegExp(`^(Profile v${r.profile_version}|Job v${r.opportunity_version})$`)));
    expect(used.some((f) => f.owner.startsWith("Profile"))).toBe(true);
    expect(used.some((f) => f.owner.startsWith("Job"))).toBe(true);
    // the student's name and goal text are not inputs of a rules result
    expect(used.some((f) => f.label === "Goal text")).toBe(false);
    expect(used.every((f) => !/\[|\]/.test(f.label))).toBe(true);
  });
});

describe("P05 coordinator: drafts kept in this browser", () => {
  const reply = (id: string, text: string): Draft => ({ kind: "reply", key: replyKey(id), challenge_id: id, text, at: "2026-11-23T10:00:00Z" });

  it("adds or replaces by key without changing the old list", () => {
    const a = upsertDraft([], reply("CH-1", "first"));
    const b = upsertDraft(a, reply("CH-1", "second"));
    expect(a).toHaveLength(1);
    expect(b).toHaveLength(1);
    expect(findDraft(b, replyKey("CH-1"), "reply")?.text).toBe("second");
    expect(findDraft(a, replyKey("CH-1"), "reply")?.text).toBe("first");
    expect(removeDraft(b, replyKey("CH-1"))).toEqual([]);
    expect(b).toHaveLength(1);
  });

  it("drops stored drafts that are malformed instead of trusting them", () => {
    const good = { kind: "suggestion", key: suggestionKey("COOP-B003", "jira boards", "SK-JIRA-01"), student_id: "COOP-B003", phrase: "jira boards", skill_id: "SK-JIRA-01", decision: "confirm", note: "n", at: "t" };
    const raw = JSON.stringify([good, { kind: "suggestion", key: "x", decision: "maybe" }, { kind: "reply", key: "y", challenge_id: "c", text: "x".repeat(2000), at: "t" }, null, 7]);
    expect(parseDrafts(raw)).toEqual([good]);
    expect(parseDrafts("{not json")).toEqual([]);
    expect(parseDrafts(null)).toEqual([]);
    expect(parseDrafts('{"a":1}')).toEqual([]);
  });
});
