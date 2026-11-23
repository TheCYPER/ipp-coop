/**
 * Shared database client (shared core, led by P05). Read-only: every team imports from "@/lib/db".
 *
 *   import { getOpenListings, getCurrentProfiles } from "@/lib/db";
 *   const listings = await getOpenListings();
 *
 * Writes go through each team's server route with its key from the environment (stage 3 of the
 * data migration path in docs/ARCHITECTURE.md), never from the browser.
 */
export { callFunction, dbConfig, eq, inList, rpc, selectAll, SharedDbError, type DbOptions } from "./client";
export {
  getAiSignals,
  getChallenges,
  getCurrentProfiles,
  getDemonstratedEvidence,
  getGapEvents,
  getLatestRecommendations,
  getOpenListings,
  getOpportunityFeed,
  getProfileFeed,
  getRecommendationHistory,
  getRecommendationsByIds,
  getSkills,
  scoreGoalLive,
  suggestSkillsLive,
} from "./views";
export type * from "./types";
