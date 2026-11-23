import { fieldsUsed, historyFor, requirementText, staleness, type MatchData, type Recommendation } from "@/lib/p05";
import { Label } from "@/components/ui/label";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StateDot, VerdictChip } from "../Verdict";
import { errorText, useHistory } from "./useCoordinator";
import { fmtTime, NeedsLive, Section, STATUS_LABEL } from "./Section";

interface Props {
  data: MatchData;
  records: Recommendation[];
  jobId: string | null;
  onJob: (id: string) => void;
  live: boolean;
}

/** One result in full: the answer, each requirement, the inputs it used, and what the database has stored for it. */
export function CheckResult({ data, records, jobId, onJob, live }: Props) {
  const r = records.find((x) => x.opportunity_id === jobId) ?? records.find((x) => x.status !== "excluded") ?? records[0];
  if (!r) return <p className="text-sm text-muted-foreground">No jobs to check for this student.</p>;
  const profile = data.profiles.find((p) => p.student_id === r.student_id && p.profile_version === r.profile_version);
  const listing = data.listings.find((l) => l.opportunity_id === r.opportunity_id);
  const used = profile ? fieldsUsed(r, profile, listing, data.vocabulary) : [];

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="w-full max-w-md space-y-1.5">
          <Label htmlFor="p05-check-job">Job to check</Label>
          <select id="p05-check-job" value={r.opportunity_id} onChange={(e) => onJob(e.target.value)}
            className="h-10 w-full rounded-full border border-input bg-background px-4 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring">
            {records.map((x) => <option key={x.opportunity_id} value={x.opportunity_id}>{x.listing?.title ?? x.opportunity_id} · {x.listing?.employer ?? ""} ({STATUS_LABEL[x.status]})</option>)}
          </select>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <VerdictChip r={r} />
          <span className="font-mono">{r.recommendation_id}</span>
        </div>
      </div>
      <p className="text-sm">{r.status_reason}</p>

      <Section id="p05-check-req" title="Requirements, one by one" aside={`${r.mandatory.length} required`}>
        {r.mandatory.length === 0 ? <p className="text-sm">This job has no fixed requirements.</p> : (
          <ul className="space-y-3 text-sm">
            {r.mandatory.map((c) => {
              const q = profile ? requirementText(c, r, profile, data.vocabulary) : { name: c.label, text: c.detail };
              return <li key={c.cond_id} className="flex gap-3"><StateDot state={c.state} /><span><span className="font-semibold">{q.name}</span><br /><span>{q.text}</span><br /><span className="font-mono text-xs text-muted-foreground">{c.detail}</span></span></li>;
            })}
          </ul>
        )}
      </Section>

      <Section id="p05-check-fields" title="What the system looked at" aside="Only these inputs were used; nothing else on the profile">
        <Table>
          <TableHeader><TableRow><TableHead>Input</TableHead><TableHead>Value</TableHead><TableHead className="text-right">From</TableHead></TableRow></TableHeader>
          <TableBody>
            {used.map((f) => (
              <TableRow key={`${f.owner}-${f.label}`}>
                <TableCell className="font-medium">{f.label}</TableCell>
                <TableCell className="text-muted-foreground">{f.value || "—"}</TableCell>
                <TableCell className="whitespace-nowrap text-right font-mono text-xs">{f.owner}</TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        <p className="mt-2 text-xs text-muted-foreground">Method {r.method_version}. The same inputs and method always give the same result ID, so any result can be checked again later.</p>
      </Section>

      <StoredResults data={data} r={r} live={live} />
    </div>
  );
}

function StoredResults({ data, r, live }: { data: MatchData; r: Recommendation; live: boolean }) {
  const q = useHistory(r.student_id, live);
  const current = data.profiles.filter((p) => p.student_id === r.student_id).sort((a, b) => b.profile_version - a.profile_version)[0];
  let body;
  if (!live) body = <NeedsLive what="Stored results" />;
  else if (q.isPending) body = <p role="status" className="text-sm text-muted-foreground">Loading stored results…</p>;
  else if (q.isError) body = <p role="alert" className="text-sm text-destructive">Couldn’t load stored results: {errorText(q.error)}</p>;
  else {
    const s = current ? staleness(q.data, current) : null;
    const rows = historyFor(q.data, r.opportunity_id);
    body = (
      <div className="space-y-3">
        {s?.stale && (
          <p className="rounded-2xl bg-warn p-4 text-sm text-warn-foreground">
            <span className="font-semibold">Out of date.</span> The stored results were computed from profile v{s.storedVersion}; the profile is now v{s.currentVersion}. A new result is computed from v{s.currentVersion} and the old one stays on record; it is never overwritten.
          </p>
        )}
        {s && s.storedCount === 0 && <p className="text-sm text-muted-foreground">Nothing stored for this student yet. Results are stored once P05 writes go live.</p>}
        {rows.length > 0 && (
          <Table>
            <TableHeader><TableRow><TableHead>Computed</TableHead><TableHead>Method</TableHead><TableHead>Versions</TableHead><TableHead>Answer then</TableHead><TableHead className="text-right">Rank</TableHead></TableRow></TableHeader>
            <TableBody>
              {rows.map((h) => (
                <TableRow key={h.recommendation_id}>
                  <TableCell className="whitespace-nowrap">{fmtTime(h.computed_at)}</TableCell>
                  <TableCell className="font-mono text-xs">{h.method_id}</TableCell>
                  <TableCell className="whitespace-nowrap font-mono text-xs">Profile v{h.profile_version} · Job v{h.opportunity_version ?? "none"}</TableCell>
                  <TableCell>{STATUS_LABEL[h.status]}{h.status !== r.status && <span className="ml-2 rounded-full bg-lime px-2 py-0.5 text-xs font-semibold text-lime-foreground">now {STATUS_LABEL[r.status]}</span>}</TableCell>
                  <TableCell className="text-right">{h.rank ?? "—"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
        {s && s.storedCount > 0 && rows.length === 0 && <p className="text-sm text-muted-foreground">No stored result for this job; {s.storedCount} stored for other jobs.</p>}
      </div>
    );
  }
  return <Section id="p05-check-stored" title="Stored in the shared database" aside="Table recommendations, append-only">{body}</Section>;
}
