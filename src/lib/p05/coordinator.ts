/**
 * P05 coordinator view logic: what a result was based on, whether a stored result is out of date,
 * how the AI method differs from the rules, and the AI's skill suggestions a person must confirm.
 * Pure functions; nothing passed in is changed.
 */
import type { RecommendationRow } from "@/lib/db";
import { AI_PARAMS, matchStudent, publishedVersion } from "./engine";
import { fmtDate, skillName } from "./explain";
import type { AiParams, AiSignalData, AiSource, Listing, MatchData, MatchStatus, Profile, Recommendation, VocabTerm } from "./types";

// ---------- stored results ----------
export interface Staleness {
  storedVersion: number | null;
  currentVersion: number;
  stale: boolean;
  storedCount: number;
  lastComputed: string | null;
}

/** D7: a stored result made from an older profile version is flagged, never silently replaced. */
export function staleness(history: RecommendationRow[], profile: Profile): Staleness {
  const mine = history.filter((h) => h.student_id === profile.student_id);
  const storedVersion = mine.length ? Math.max(...mine.map((h) => h.profile_version)) : null;
  const lastComputed = mine.map((h) => h.computed_at).sort().at(-1) ?? null;
  return {
    storedVersion,
    currentVersion: profile.profile_version,
    stale: storedVersion !== null && storedVersion < profile.profile_version,
    storedCount: mine.length,
    lastComputed,
  };
}

export function historyFor(history: RecommendationRow[], opportunityId: string): RecommendationRow[] {
  return history.filter((h) => h.opportunity_id === opportunityId)
    .sort((a, b) => b.computed_at.localeCompare(a.computed_at) || a.method_id.localeCompare(b.method_id));
}

// ---------- rules against AI ----------
export interface MethodRow {
  opportunity_id: string;
  title: string;
  employer: string;
  rules: { rank: number; points: number; status: MatchStatus };
  ai: { rank: number; points: number; status: MatchStatus };
}

export interface MethodComparison {
  rows: MethodRow[];
  eligibilityChanged: number;
  aiSource: AiSource | null;
}

/** The top jobs under each method side by side. The AI may reorder; it must never change who can apply. */
export function compareMethods(data: MatchData, studentId: string, ai: AiSignalData | null, top = 8): MethodComparison | null {
  const rules = matchStudent(data, studentId, "rules");
  const withAi = matchStudent({ ...data, ai }, studentId, "ai");
  if (!rules || !withAi) return null;
  const pos = (list: Recommendation[]) => new Map(list.map((r, i) => [r.opportunity_id, { rank: i + 1, points: r.pref_points, status: r.status }]));
  const R = pos(rules.records);
  const A = pos(withAi.records);
  const ids = [...new Set([...withAi.records, ...rules.records].filter((r) => r.status !== "excluded").slice(0, top * 2).map((r) => r.opportunity_id))]
    .sort((x, y) => (A.get(x)?.rank ?? 0) - (A.get(y)?.rank ?? 0)).slice(0, top);
  const rows = ids.flatMap((id) => {
    const r = R.get(id);
    const a = A.get(id);
    const rec = withAi.records.find((x) => x.opportunity_id === id);
    return r && a && rec?.listing ? [{ opportunity_id: id, title: rec.listing.title, employer: rec.listing.employer, rules: r, ai: a }] : [];
  });
  const eligibilityChanged = rules.records.filter((r) => A.get(r.opportunity_id)?.status !== r.status).length;
  const aiSource = withAi.records.find((r) => r.status !== "excluded")?.ai_source ?? null;
  return { rows, eligibilityChanged, aiSource };
}

// ---------- AI skill suggestions ----------
export interface PhraseSuggestion {
  phrase: string;
  /** null while no AI score is available for the phrase */
  suggestions: { skill_id: string; label: string; score: number; suggested: boolean }[] | null;
}

export function phraseSuggestions(profile: Profile, vocab: VocabTerm[], ai: AiSignalData | null, params: AiParams = AI_PARAMS): PhraseSuggestion[] {
  return profile.unmapped_skills.map((phrase) => {
    const list = ai?.phrases[phrase];
    return {
      phrase,
      suggestions: list
        ? list.map((s) => ({ skill_id: s.skill_id, label: vocab.find((v) => v.skill_id === s.skill_id)?.label ?? s.skill_id, score: s.score, suggested: s.score >= params.suggest_min }))
        : null,
    };
  });
}

/** The note a confirmed or rejected suggestion sends to the profile team (P01). It never edits the profile itself. */
export function suggestionNote(decision: "confirm" | "reject", phrase: string, skillId: string, label: string, score: number): string {
  return decision === "confirm"
    ? `AI suggestion confirmed by the coordinator: "${phrase}" means ${skillId} (${label}, cosine ${score}, gte-small). Please add it to the profile as self-declared; P06 can then review it.`
    : `AI suggestion rejected by the coordinator: "${phrase}" is not ${skillId} (${label}, cosine ${score}).`;
}

// ---------- what a result was based on ----------
export interface FieldUsed {
  label: string;
  value: string;
  owner: string;
}

function plainField(f: string, vocab: VocabTerm[]): string {
  const skill = /^skills\[(.+)\]$/.exec(f)?.[1];
  if (skill) return `Skill: ${skillName(skill, vocab)}`;
  const req = /^mandatory\[(.+)\]$/.exec(f)?.[1];
  if (req) return `Requires ${skillName(req, vocab)}`;
  const nice = /^desirable\[(.+)\]$/.exec(f)?.[1];
  if (nice) return `Nice to have: ${skillName(nice, vocab)}`;
  const names: Record<string, string> = {
    availability: "Free to work", work_arrangements: "How they want to work", sectors: "Sectors picked", roles: "Roles picked",
    locations: "Places picked", goals: "Goal text", unmapped_skills: "Skills in their own words", "start_date/end_date": "Placement dates",
    work_arrangement: "Work style", sector: "Sector", role_family: "Role", city: "City", description: "Job description",
  };
  return names[f] ?? f;
}

function profileValue(profile: Profile, f: string): string {
  const skill = /^skills\[(.+)\]$/.exec(f)?.[1];
  if (skill) {
    const s = profile.skills.find((x) => x.skill_id === skill);
    return !s ? "Not on profile" : s.source === "reviewed" && s.evidence_id ? `Verified (${s.evidence_id})` : "Listed by student, not verified";
  }
  if (f === "availability") return `${fmtDate(profile.availability.start)} to ${fmtDate(profile.availability.end)}`;
  const v: unknown = (profile as unknown as Record<string, unknown>)[f];
  if (Array.isArray(v)) return v.length ? v.join(", ") : "not given";
  return v === null || v === undefined || v === "" ? "not given" : String(v);
}

function listingValue(listing: Listing | undefined, f: string): string {
  const rec = listing ? publishedVersion(listing)?.record : undefined;
  if (!rec) return "";
  if (/^(mandatory|desirable)\[/.test(f)) return "Yes";
  if (f === "start_date/end_date") return `${fmtDate(rec.start_date)} to ${fmtDate(rec.end_date)}`;
  const v: unknown = (rec as unknown as Record<string, unknown>)[f];
  return v === null || v === undefined ? "" : String(v);
}

/** Only the inputs this result actually used, each with the version it came from. The rest stays private. */
export function fieldsUsed(r: Recommendation, profile: Profile, listing: Listing | undefined, vocab: VocabTerm[]): FieldUsed[] {
  const pf = new Set<string>();
  const of = new Set<string>();
  r.mandatory.forEach((c) => { if (c.profile_field) pf.add(c.profile_field); if (c.opportunity_field) of.add(c.opportunity_field); });
  r.reasons.forEach((x) => { pf.add(x.profile_field); of.add(x.opportunity_field); });
  return [
    ...[...pf].map((f) => ({ label: plainField(f, vocab), value: profileValue(profile, f), owner: `Profile v${r.profile_version}` })),
    ...[...of].map((f) => ({ label: plainField(f, vocab), value: listingValue(listing, f), owner: `Job v${r.opportunity_version ?? "none"}` })),
  ];
}
