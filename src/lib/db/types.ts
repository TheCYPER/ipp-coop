/**
 * Row types for the shared BUS2010 Supabase database (hosted by Team 5, P05).
 * Field names are the database's own. Full data dictionary:
 * https://github.com/TheCYPER/bus2010-p05-opportunity-matcher/blob/main/docs/SUPABASE_GUIDE.md
 */

export type TeamId = "P01" | "P02" | "P03" | "P04" | "P05" | "P06" | "P07";
export type WorkArrangement = "on-site" | "hybrid" | "remote";

export interface SkillRow {
  skill_id: string;
  label: string;
  synonyms: string[];
  category: string;
}

export interface ProfileSkillJson {
  skill_id: string;
  source: "self_declared" | "reviewed";
  evidence_id: string | null;
  review_date: string | null;
}

/** One row of `profile_feed` or `current_profiles`: a submitted or reviewed profile version. */
export interface ProfileRow {
  student_id: string;
  full_name: string;
  programme: string | null;
  year: number | null;
  profile_version: number;
  status: "submitted" | "reviewed";
  goals: string | null;
  sectors: string[];
  roles: string[];
  locations: string[];
  work_arrangements: WorkArrangement[];
  available_from: string | null;
  available_to: string | null;
  change_note: string | null;
  published_at: string | null;
  skills: ProfileSkillJson[];
  unmapped_skills: string[];
}

export interface ConditionJson {
  kind: "skill" | "availability" | "arrangement";
  skill_id: string | null;
  arrangements?: WorkArrangement[] | null;
  city?: string | null;
}

/** One row of `opportunity_feed` (every version of a listed opportunity) or `open_listings`. */
export interface OpportunityRow {
  opportunity_id: string;
  version: number;
  employer_id: string;
  employer: string;
  title: string;
  sector: string | null;
  role_family: string | null;
  city: string | null;
  work_arrangement: WorkArrangement | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  tasks: string[];
  submission_status: string;
  approved_version: number | null;
  listing_status: "open" | "closed" | "withdrawn";
  published_at: string | null;
  closed_on: string | null;
  mandatory: ConditionJson[];
  desirable: ConditionJson[];
}

export interface EvidenceRow {
  evidence_id: string;
  student_id: string;
  skill_id: string;
  activity: string;
  review_outcome: "pending" | "revision_requested" | "demonstrated" | "not_demonstrated";
  reviewer: string | null;
  reviewed_at: string | null;
}

export interface RecommendationRow {
  recommendation_id: string;
  student_id: string;
  profile_version: number;
  opportunity_id: string;
  opportunity_version: number | null;
  method_id: string;
  status: "eligible" | "cannot_confirm" | "not_eligible" | "excluded";
  status_reason: string;
  rank: number | null;
  pref_points: number;
  computed_at: string;
}

/** Result of `rpc/ai_signals` and of the `ai-suggest` function's goal mode. */
export interface AiSignals {
  model: string;
  goal_embedded: boolean;
  /** Cosine similarity per opportunity version, keyed "OP-028@2". */
  goal: Record<string, number>;
  /** Three nearest vocabulary skills per known free-text phrase. */
  phrases: Record<string, { skill_id: string; score: number }[]>;
}

export interface SkillSuggestion {
  skill_id: string;
  label: string;
  similarity: number;
  suggested: boolean;
}

/** P05 → P06 hand-off: a skill a student sent to skills training. */
export interface GapEventRow {
  gap_id: string;
  recommendation_id: string;
  student_id: string;
  skill_id: string;
  opportunity_id: string;
  requirement: "mandatory" | "desirable";
  status: "sent" | "acknowledged" | "resolved";
  created_at: string;
  updated_at: string;
}

/** A student's question about one P05 result, answered by the coordinator. */
export interface ChallengeRow {
  challenge_id: string;
  recommendation_id: string;
  raised_by: string;
  question: string;
  status: "open" | "reviewed";
  resolution: string | null;
  resolved_by: string | null;
  resolved_at: string | null;
  created_at: string;
}
