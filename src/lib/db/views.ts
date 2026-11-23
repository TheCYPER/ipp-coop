/**
 * Typed reads of the shared database's views. Every team can import these from "@/lib/db"
 * instead of writing its own fetch code and field mapping.
 */
import { callFunction, eq, rpc, selectAll, type DbOptions } from "./client";
import type { AiSignals, EvidenceRow, OpportunityRow, ProfileRow, RecommendationRow, SkillRow, SkillSuggestion } from "./types";

/** The shared skill vocabulary (44 terms). */
export function getSkills(opts?: DbOptions): Promise<SkillRow[]> {
  return selectAll<SkillRow>("skills", { select: "skill_id,label,synonyms,category", order: "skill_id" }, opts);
}

/** One row per student: the newest submitted or reviewed profile version. Drafts are ignored. */
export function getCurrentProfiles(opts?: DbOptions): Promise<ProfileRow[]> {
  return selectAll<ProfileRow>("current_profiles", { select: "*", order: "student_id" }, opts);
}

/** Every submitted or reviewed profile version, optionally for one student (oldest first). */
export function getProfileFeed(studentId?: string, opts?: DbOptions): Promise<ProfileRow[]> {
  const query: Record<string, string> = { select: "*", order: "student_id,profile_version" };
  if (studentId) query["student_id"] = eq(studentId);
  return selectAll<ProfileRow>("profile_feed", query, opts);
}

/** What students can see now: open listings at their approved version, with conditions. */
export function getOpenListings(opts?: DbOptions): Promise<OpportunityRow[]> {
  return selectAll<OpportunityRow>("open_listings", { select: "*", order: "opportunity_id" }, opts);
}

/** Every version of every listed opportunity, with its listing state. Show students only version = approved_version. */
export function getOpportunityFeed(opts?: DbOptions): Promise<OpportunityRow[]> {
  return selectAll<OpportunityRow>("opportunity_feed", { select: "*", order: "opportunity_id,version" }, opts);
}

/** Evidence that P06 reviewed as demonstrated, optionally for one student. */
export function getDemonstratedEvidence(studentId?: string, opts?: DbOptions): Promise<EvidenceRow[]> {
  const query: Record<string, string> = {
    select: "evidence_id,student_id,skill_id,activity,review_outcome,reviewer,reviewed_at",
    review_outcome: eq("demonstrated"),
    order: "evidence_id",
  };
  if (studentId) query["student_id"] = eq(studentId);
  return selectAll<EvidenceRow>("skill_evidence", query, opts);
}

/** The newest stored P05 result per opportunity and method for one student. */
export function getLatestRecommendations(studentId: string, opts?: DbOptions): Promise<RecommendationRow[]> {
  return selectAll<RecommendationRow>("latest_recommendations", {
    select: "recommendation_id,student_id,profile_version,opportunity_id,opportunity_version,method_id,status,status_reason,rank,pref_points,computed_at",
    student_id: eq(studentId),
    order: "rank",
  }, opts);
}

/** P05 AI signals for a goal text and free-text phrases that already have stored embeddings. */
export function getAiSignals(goal: string, phrases: string[] = [], opts?: DbOptions): Promise<AiSignals> {
  return rpc<AiSignals>("ai_signals", { p_goal: goal, p_phrases: phrases.slice(0, 20) }, opts);
}

/** Live AI score of any goal text against every opportunity version (gte-small, Edge Function). */
export async function scoreGoalLive(goal: string, opts?: DbOptions): Promise<Record<string, number>> {
  const res = await callFunction<{ goal?: Record<string, number> }>("ai-suggest", { goal: goal.slice(0, 600) }, opts);
  return res.goal ?? {};
}

/** Live AI skill suggestions for one free-text phrase. Suggestions are unconfirmed: a person decides. */
export async function suggestSkillsLive(phrase: string, opts?: DbOptions): Promise<SkillSuggestion[]> {
  const res = await callFunction<{ suggestions?: SkillSuggestion[] }>("ai-suggest", { phrase: phrase.slice(0, 120) }, opts);
  return res.suggestions ?? [];
}
