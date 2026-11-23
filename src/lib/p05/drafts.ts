/**
 * Coordinator decisions kept as drafts in this browser until P05 writes go live (stage 3 of the data
 * migration path). Pure functions: every change returns a new list.
 */
export interface SuggestionDraft {
  kind: "suggestion";
  key: string;
  student_id: string;
  phrase: string;
  skill_id: string;
  decision: "confirm" | "reject";
  note: string;
  at: string;
}

export interface ReplyDraft {
  kind: "reply";
  key: string;
  challenge_id: string;
  text: string;
  at: string;
}

export type Draft = SuggestionDraft | ReplyDraft;

export const DRAFTS_KEY = "p05-coordinator-drafts-v1";
export const REPLY_MAX = 1000;

export const suggestionKey = (studentId: string, phrase: string, skillId: string) => `suggestion:${studentId}:${phrase}:${skillId}`;
export const replyKey = (challengeId: string) => `reply:${challengeId}`;

/** Adds a draft or replaces the one with the same key. */
export function upsertDraft(list: readonly Draft[], d: Draft): Draft[] {
  return [...list.filter((x) => x.key !== d.key), d];
}

export function removeDraft(list: readonly Draft[], key: string): Draft[] {
  return list.filter((x) => x.key !== key);
}

export function findDraft<K extends Draft["kind"]>(list: readonly Draft[], key: string, kind: K): Extract<Draft, { kind: K }> | undefined {
  return list.find((x): x is Extract<Draft, { kind: K }> => x.key === key && x.kind === kind);
}

const isStr = (v: unknown): v is string => typeof v === "string";

function validDraft(v: unknown): v is Draft {
  if (typeof v !== "object" || v === null) return false;
  const o = v as Record<string, unknown>;
  if (!isStr(o["key"]) || !isStr(o["at"])) return false;
  if (o["kind"] === "reply") return isStr(o["challenge_id"]) && isStr(o["text"]) && o["text"].length <= REPLY_MAX;
  if (o["kind"] === "suggestion") {
    return isStr(o["student_id"]) && isStr(o["phrase"]) && isStr(o["skill_id"]) && isStr(o["note"]) && (o["decision"] === "confirm" || o["decision"] === "reject");
  }
  return false;
}

/** Reads stored drafts; anything malformed is dropped rather than trusted. */
export function parseDrafts(raw: string | null): Draft[] {
  if (!raw) return [];
  try {
    const v: unknown = JSON.parse(raw);
    return Array.isArray(v) ? v.filter(validDraft) : [];
  } catch {
    return [];
  }
}
