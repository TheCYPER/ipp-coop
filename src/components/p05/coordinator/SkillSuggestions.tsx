import { useMutation } from "@tanstack/react-query";
import { useState, type FormEvent } from "react";
import { suggestSkillsLive } from "@/lib/db";
import { AI_PARAMS, findDraft, phraseSuggestions, removeDraft, suggestionKey, suggestionNote, upsertDraft, type AiSignalData, type MatchData, type Profile } from "@/lib/p05";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { errorText, type Drafts } from "./useCoordinator";
import { fmtTime, Section } from "./Section";

interface Props {
  data: MatchData;
  profile: Profile;
  ai: AiSignalData | null;
  aiLoading: boolean;
  live: boolean;
  drafts: Drafts;
}

const PHRASE_MIN = 2;
const PHRASE_MAX = 120;

/**
 * The AI (gte-small) reads skills a student wrote in their own words and suggests the nearest skill in the shared
 * vocabulary. A suggestion never counts toward a requirement: a person confirms it, then P06 reviews evidence.
 */
export function SkillSuggestions({ data, profile, ai, aiLoading, live, drafts }: Props) {
  const list = phraseSuggestions(profile, data.vocabulary, ai);
  const first = profile.name.split(" ")[0] ?? profile.name;

  return (
    <div className="space-y-6">
      <p className="max-w-3xl text-sm text-muted-foreground">
        The AI model (gte-small) compares what a student wrote with every skill in the shared vocabulary. Above a cosine of {AI_PARAMS.suggest_min} it suggests a match. A suggestion never counts toward a requirement: you confirm or reject it here, the profile team (P01) adds it as self-declared, and skills training (P06) reviews evidence before it is verified.
      </p>

      <Section id="p05-sugg-profile" title={`${first}’s skills in their own words`} aside={aiLoading ? "Loading AI scores…" : `${list.length} phrase${list.length === 1 ? "" : "s"}`}>
        {list.length === 0 ? <p className="text-sm">{first} used the shared vocabulary for every skill, so there is nothing to map.</p> : (
          <ul className="space-y-5">
            {list.map((p) => (
              <li key={p.phrase}>
                <p className="font-semibold">“{p.phrase}”</p>
                {p.suggestions === null ? (
                  <p className="text-sm text-muted-foreground">{aiLoading ? "Loading…" : "No AI score for this phrase yet. Nothing is suggested rather than guessed."}</p>
                ) : (
                  <ul className="mt-2 divide-y divide-border rounded-2xl border border-border">
                    {p.suggestions.map((s) => {
                      const key = suggestionKey(profile.student_id, p.phrase, s.skill_id);
                      const d = findDraft(drafts.list, key, "suggestion");
                      const decide = (decision: "confirm" | "reject") => drafts.update((l) => d?.decision === decision ? removeDraft(l, key) : upsertDraft(l, {
                        kind: "suggestion", key, student_id: profile.student_id, phrase: p.phrase, skill_id: s.skill_id, decision,
                        note: suggestionNote(decision, p.phrase, s.skill_id, s.label, s.score), at: new Date().toISOString(),
                      }));
                      return (
                        <li key={s.skill_id} className="flex flex-col gap-2 p-3 sm:flex-row sm:items-center sm:justify-between">
                          <div className="min-w-0">
                            <p className="text-sm font-medium">{s.label} <span className="font-mono text-xs text-muted-foreground">{s.skill_id}</span></p>
                            <p className="text-xs text-muted-foreground">
                              Cosine {s.score.toFixed(3)} · {s.suggested ? "suggested (above the bar)" : `below the bar (${AI_PARAMS.suggest_min}), not suggested`}
                            </p>
                            {d && <p className="mt-1 text-xs">Draft: {d.note} <span className="text-muted-foreground">({fmtTime(d.at)})</span></p>}
                          </div>
                          <div className="flex shrink-0 gap-2" role="group" aria-label={`Decide on ${s.label} for “${p.phrase}”`}>
                            <Button size="sm" variant={d?.decision === "confirm" ? "default" : "outline"} aria-pressed={d?.decision === "confirm"} className="rounded-full" onClick={() => decide("confirm")}>Confirm</Button>
                            <Button size="sm" variant={d?.decision === "reject" ? "secondary" : "ghost"} aria-pressed={d?.decision === "reject"} className="rounded-full" onClick={() => decide("reject")}>Reject</Button>
                          </div>
                        </li>
                      );
                    })}
                  </ul>
                )}
              </li>
            ))}
          </ul>
        )}
        <p className="mt-3 text-xs text-muted-foreground">
          Decisions are drafts saved in this browser{drafts.saved ? "" : " (storage is blocked here, so only for this visit)"} until P05 writes go live; then they are sent to P01 as notes. They never change a profile directly.
        </p>
      </Section>

      <TryPhrase live={live} />
    </div>
  );
}

function TryPhrase({ live }: { live: boolean }) {
  const [phrase, setPhrase] = useState("");
  const [invalid, setInvalid] = useState("");
  const m = useMutation({ mutationFn: (p: string) => suggestSkillsLive(p) });
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const p = phrase.trim();
    if (p.length < PHRASE_MIN || p.length > PHRASE_MAX) { setInvalid(`Write ${PHRASE_MIN} to ${PHRASE_MAX} characters.`); return; }
    setInvalid("");
    m.mutate(p);
  };
  return (
    <Section id="p05-sugg-try" title="Try a phrase" aside="Live gte-small, through the shared database’s Edge Function">
      {!live ? <p className="text-sm text-muted-foreground">Needs the shared database, which can’t be reached right now.</p> : (
        <form onSubmit={submit} className="space-y-3">
          <div className="flex max-w-xl flex-col gap-2 sm:flex-row sm:items-end">
            <div className="flex-1 space-y-1.5">
              <Label htmlFor="p05-try-phrase">A skill in a student’s own words</Label>
              <Input id="p05-try-phrase" value={phrase} maxLength={PHRASE_MAX} onChange={(e) => setPhrase(e.target.value)} placeholder="e.g. building dashboards in Power BI" aria-invalid={invalid !== ""} aria-describedby={invalid ? "p05-try-error" : undefined} />
            </div>
            <Button type="submit" className="rounded-full" disabled={m.isPending}>{m.isPending ? "Asking the model…" : "Suggest skills"}</Button>
          </div>
          {invalid && <p id="p05-try-error" role="alert" className="text-sm text-destructive">{invalid}</p>}
          {m.isError && <p role="alert" className="text-sm text-destructive">The model couldn’t be reached: {errorText(m.error)}</p>}
          {m.data && (
            <ul className="divide-y divide-border rounded-2xl border border-border" aria-label="Suggestions for the phrase">
              {m.data.length === 0 && <li className="p-3 text-sm">No skill came close.</li>}
              {m.data.map((s) => (
                <li key={s.skill_id} className="flex items-center justify-between gap-3 p-3 text-sm">
                  <span>{s.label} <span className="font-mono text-xs text-muted-foreground">{s.skill_id}</span></span>
                  <span className="text-xs text-muted-foreground">Cosine {s.similarity.toFixed(3)} · {s.suggested ? "suggested" : "below the bar"}</span>
                </li>
              ))}
            </ul>
          )}
        </form>
      )}
    </Section>
  );
}
