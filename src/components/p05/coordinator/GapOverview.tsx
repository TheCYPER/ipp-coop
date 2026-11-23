import type { GapEventRow } from "@/lib/db";
import { publishedVersion, skillName, type MatchData } from "@/lib/p05";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { errorText, useGapEvents } from "./useCoordinator";
import { fmtTime, NeedsLive, Section } from "./Section";

const STEPS: { status: GapEventRow["status"]; label: string; note: string }[] = [
  { status: "sent", label: "Sent to training", note: "P05 found a skill that can’t be confirmed yet" },
  { status: "acknowledged", label: "Training started", note: "P06 gave the student a task" },
  { status: "resolved", label: "Resolved", note: "P06 reviewed the evidence" },
];
const STATUS_TEXT: Record<GapEventRow["status"], string> = { sent: "Sent", acknowledged: "Training started", resolved: "Resolved" };

/** Skill gaps P05 handed to skills training (table skill_gap_events). P05 writes them; only P06 moves their status. */
export function GapOverview({ data, live, studentId }: { data: MatchData; live: boolean; studentId: string }) {
  const q = useGapEvents(live);
  if (!live) return <NeedsLive what="Skill-gap hand-offs" />;
  if (q.isPending) return <p role="status" className="text-sm text-muted-foreground">Loading skill gaps…</p>;
  if (q.isError) return <p role="alert" className="text-sm text-destructive">Couldn’t load skill gaps: {errorText(q.error)}</p>;

  const gaps = q.data;
  const count = (s: GapEventRow["status"]) => gaps.filter((g) => g.status === s).length;
  const bySkill = [...gaps.reduce((m, g) => m.set(g.skill_id, (m.get(g.skill_id) ?? 0) + 1), new Map<string, number>())]
    .sort((a, b) => b[1] - a[1]).slice(0, 5);
  const mine = gaps.filter((g) => g.student_id === studentId);
  const name = data.profiles.find((p) => p.student_id === studentId)?.name ?? studentId;
  const jobTitle = (id: string) => {
    const l = data.listings.find((x) => x.opportunity_id === id);
    return (l && publishedVersion(l)?.record.title) ?? id;
  };

  return (
    <div className="space-y-6">
      <ol className="grid grid-cols-1 gap-3 sm:grid-cols-3" aria-label="Skill gaps by step">
        {STEPS.map((s, i) => (
          <li key={s.status} className={`rounded-2xl p-4 ${i === 2 ? "bg-panel text-panel-foreground" : "border border-border"}`}>
            <p className="font-display text-3xl font-bold">{count(s.status)}</p>
            <p className="font-semibold">{s.label}</p>
            <p className={`text-xs ${i === 2 ? "text-panel-muted" : "text-muted-foreground"}`}>{s.note}</p>
          </li>
        ))}
      </ol>
      <p className="text-sm text-muted-foreground">{gaps.length} hand-offs in all. P05 writes a hand-off; only P06 can move its status, and nobody can delete one.</p>

      <Section id="p05-gap-skills" title="Skills sent most often" aside="Where training would help the most students">
        <ul className="space-y-2">
          {bySkill.map(([id, n]) => (
            <li key={id} className="grid grid-cols-[1fr_auto] items-center gap-3 text-sm">
              <span>{skillName(id, data.vocabulary)} <span className="font-mono text-xs text-muted-foreground">{id}</span></span>
              <span className="font-semibold">{n}</span>
              <span aria-hidden="true" className="col-span-2 h-1.5 rounded-full bg-muted"><span className="block h-full rounded-full bg-primary" style={{ width: `${Math.round((n / (bySkill[0]?.[1] ?? n)) * 100)}%` }} /></span>
            </li>
          ))}
        </ul>
      </Section>

      <Section id="p05-gap-student" title={`${name}’s hand-offs`} aside={`${mine.length} in all`}>
        {mine.length === 0 ? <p className="text-sm">None for this student.</p> : (
          <Table>
            <TableHeader><TableRow><TableHead>Skill</TableHead><TableHead>For job</TableHead><TableHead>Needed as</TableHead><TableHead>Status</TableHead><TableHead className="text-right">Updated</TableHead></TableRow></TableHeader>
            <TableBody>
              {mine.map((g) => (
                <TableRow key={g.gap_id}>
                  <TableCell className="font-medium">{skillName(g.skill_id, data.vocabulary)}</TableCell>
                  <TableCell>{jobTitle(g.opportunity_id)}</TableCell>
                  <TableCell>{g.requirement === "mandatory" ? "Requirement" : "Nice to have"}</TableCell>
                  <TableCell>{STATUS_TEXT[g.status]}</TableCell>
                  <TableCell className="whitespace-nowrap text-right text-xs">{fmtTime(g.updated_at)}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </Section>
    </div>
  );
}
