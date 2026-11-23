import { useState } from "react";
import type { ChallengeRow, RecommendationRow } from "@/lib/db";
import { findDraft, latestProfile, removeDraft, REPLY_MAX, replyKey, upsertDraft, type MatchData } from "@/lib/p05";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { errorText, useChallengeResults, useChallenges, type Drafts } from "./useCoordinator";
import { fmtTime, NeedsLive, STATUS_LABEL } from "./Section";

interface Props {
  data: MatchData;
  live: boolean;
  drafts: Drafts;
  onOpen: (studentId: string, opportunityId: string) => void;
}

/** Students’ questions about a result (table recommendation_challenges). Replies are drafts until P05 writes go live. */
export function StudentQuestions({ data, live, drafts, onOpen }: Props) {
  const [show, setShow] = useState<"open" | "reviewed">("open");
  const q = useChallenges(live);
  const ids = q.data?.map((c) => c.recommendation_id) ?? [];
  const results = useChallengeResults(ids, live);

  if (!live) return <NeedsLive what="Students’ questions" />;
  if (q.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading questions…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">Couldn’t load questions: {errorText(q.error)}</p>;

  const byId = new Map((results.data ?? []).map((r) => [r.recommendation_id, r]));
  const open = q.data.filter((c) => c.status === "open");
  const reviewed = q.data.filter((c) => c.status === "reviewed");
  const shown = show === "open" ? open : reviewed;

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="max-w-2xl text-sm text-muted-foreground">A student can ask why they got a result. You answer with what the system looked at; the stored result itself is never changed.</p>
        <ToggleGroup type="single" value={show} onValueChange={(v) => { if (v === "open" || v === "reviewed") setShow(v); }} aria-label="Which questions" className="justify-start">
          <ToggleGroupItem value="open" className="rounded-full px-4">Open ({open.length})</ToggleGroupItem>
          <ToggleGroupItem value="reviewed" className="rounded-full px-4">Answered ({reviewed.length})</ToggleGroupItem>
        </ToggleGroup>
      </div>
      {results.isError && <p role="alert" className="text-sm text-destructive">Couldn’t load the results the questions are about: {errorText(results.error)}</p>}
      {shown.length === 0 ? <p className="text-sm">No {show === "open" ? "open" : "answered"} questions.</p> : (
        <ol className="space-y-3">
          {shown.map((c) => <Question key={c.challenge_id} c={c} rec={byId.get(c.recommendation_id)} data={data} drafts={drafts} onOpen={onOpen} />)}
        </ol>
      )}
    </div>
  );
}

function Question({ c, rec, data, drafts, onOpen }: { c: ChallengeRow; rec: RecommendationRow | undefined; data: MatchData; drafts: Drafts; onOpen: Props["onOpen"] }) {
  const key = replyKey(c.challenge_id);
  const draft = findDraft(drafts.list, key, "reply");
  const [text, setText] = useState(draft?.text ?? "");
  const student = rec ? latestProfile(data, rec.student_id) : null;
  const listing = rec ? data.listings.find((l) => l.opportunity_id === rec.opportunity_id) : undefined;
  const title = rec && listing ? listing.versions[String(rec.opportunity_version)]?.title ?? rec.opportunity_id : rec?.opportunity_id;
  const save = () => {
    const t = text.trim().slice(0, REPLY_MAX);
    drafts.update((l) => (t ? upsertDraft(l, { kind: "reply", key, challenge_id: c.challenge_id, text: t, at: new Date().toISOString() }) : removeDraft(l, key)));
  };

  return (
    <li className="rounded-2xl border border-border p-4">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <p className="font-semibold">{student?.name ?? c.raised_by} <span className="font-mono text-xs font-normal text-muted-foreground">{c.raised_by} · {c.challenge_id}</span></p>
        <span className="text-xs text-muted-foreground">{fmtTime(c.created_at)}</span>
      </div>
      <blockquote className="mt-2 border-l-4 border-lime pl-3">“{c.question}”</blockquote>
      {rec ? (
        <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>About: <span className="text-foreground">{title}</span> · stored answer {STATUS_LABEL[rec.status]} · profile v{rec.profile_version} · {rec.method_id}</span>
          <Button variant="link" size="sm" className="h-auto px-0" onClick={() => onOpen(rec.student_id, rec.opportunity_id)}>Check this result</Button>
        </div>
      ) : <p className="mt-2 font-mono text-xs text-muted-foreground">Result {c.recommendation_id}</p>}

      {c.status === "reviewed" ? (
        <p className="mt-3 rounded-xl bg-muted p-3 text-sm"><span className="font-semibold">Answered by {c.resolved_by ?? "the coordinator"}</span> ({fmtTime(c.resolved_at)}): {c.resolution}</p>
      ) : (
        <div className="mt-3 space-y-2">
          <Label htmlFor={`p05-reply-${c.challenge_id}`}>Your reply</Label>
          <Textarea id={`p05-reply-${c.challenge_id}`} value={text} maxLength={REPLY_MAX} onChange={(e) => setText(e.target.value)} rows={3} placeholder="Explain with the inputs the system looked at." />
          <div className="flex flex-wrap items-center gap-3">
            <Button size="sm" variant="outline" className="rounded-full" onClick={save} disabled={text.trim() === (draft?.text ?? "")}>Save draft</Button>
            <span className="text-xs text-muted-foreground" role="status">
              {draft ? `Draft saved in this browser ${fmtTime(draft.at)}${drafts.saved ? "" : " (for this visit only)"}. Sent when P05 writes go live.` : `${text.length}/${REPLY_MAX}`}
            </span>
          </div>
        </div>
      )}
    </li>
  );
}
