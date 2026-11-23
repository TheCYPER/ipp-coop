import { useQuery } from "@tanstack/react-query";
import { useCallback, useEffect, useRef, useState } from "react";
import { getChallenges, getGapEvents, getRecommendationHistory, getRecommendationsByIds } from "@/lib/db";
import { DRAFTS_KEY, parseDrafts, type Draft } from "@/lib/p05";

const FRESH = 60_000;

/** Reads for the coordinator page. Each runs only against the live shared database, never the demo slice. */
export const useChallenges = (live: boolean) =>
  useQuery({ queryKey: ["p05", "challenges"], queryFn: () => getChallenges(), enabled: live, staleTime: FRESH, retry: 0 });

export const useChallengeResults = (ids: string[], live: boolean) =>
  useQuery({ queryKey: ["p05", "challenge-results", ids], queryFn: () => getRecommendationsByIds(ids), enabled: live && ids.length > 0, staleTime: FRESH, retry: 0 });

export const useGapEvents = (live: boolean) =>
  useQuery({ queryKey: ["p05", "gaps"], queryFn: () => getGapEvents(), enabled: live, staleTime: FRESH, retry: 0 });

export const useHistory = (studentId: string, live: boolean) =>
  useQuery({ queryKey: ["p05", "history", studentId], queryFn: () => getRecommendationHistory(studentId), enabled: live, staleTime: FRESH, retry: 0 });

export interface Drafts {
  list: Draft[];
  update: (fn: (list: Draft[]) => Draft[]) => void;
  /** false when this browser blocks storage: drafts then last for this visit only */
  saved: boolean;
}

/** Coordinator decisions as drafts in this browser until P05 writes go live. */
export function useDrafts(): Drafts {
  const current = useRef<Draft[]>([]);
  const [list, setList] = useState<Draft[]>([]);
  const [saved, setSaved] = useState(true);
  useEffect(() => {
    try {
      current.current = parseDrafts(window.localStorage.getItem(DRAFTS_KEY));
      setList(current.current);
    } catch {
      setSaved(false);
    }
  }, []);
  const update = useCallback((fn: (list: Draft[]) => Draft[]) => {
    const next = fn(current.current);
    current.current = next;
    setList(next);
    try {
      window.localStorage.setItem(DRAFTS_KEY, JSON.stringify(next));
      setSaved(true);
    } catch {
      setSaved(false);
    }
  }, []);
  return { list, update, saved };
}

export function errorText(e: unknown): string {
  return e instanceof Error ? e.message : "Unknown error";
}
