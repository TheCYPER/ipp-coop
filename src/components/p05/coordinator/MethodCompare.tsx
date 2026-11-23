import { ArrowDown, ArrowUp } from "lucide-react";
import { compareMethods, type AiSignalData, type MatchData } from "@/lib/p05";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { STATUS_LABEL } from "./Section";

const SOURCE_TEXT = {
  embedding: "AI scores from gte-small sentence embeddings.",
  lexical: "AI scores from word overlap (labelled fallback).",
  "lexical-fallback": "No AI scores reached this page, so the AI method fell back to word overlap. It is labelled, never passed off as the model.",
} as const;

/** The same student under both methods. The AI may reorder jobs; it must never change who can apply. */
export function MethodCompare({ data, studentId, ai, aiLoading }: { data: MatchData; studentId: string; ai: AiSignalData | null; aiLoading: boolean }) {
  if (aiLoading) return <p role="status" className="text-sm text-muted-foreground">Loading AI scores…</p>;
  const c = compareMethods(data, studentId, ai);
  if (!c) return <p className="text-sm">No submitted profile for {studentId}.</p>;

  return (
    <div className="space-y-5">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
        <div className={`rounded-2xl p-4 ${c.eligibilityChanged === 0 ? "bg-status text-status-foreground" : "bg-destructive text-destructive-foreground"}`}>
          <p className="font-display text-3xl font-bold">{c.eligibilityChanged}</p>
          <p className="text-sm font-semibold">jobs where the AI changed who can apply</p>
        </div>
        <p className="max-w-xl text-sm text-muted-foreground">
          Whether a student can apply is decided by the rules only. The AI adds a goal-similarity score that can move jobs up or down. {c.aiSource ? SOURCE_TEXT[c.aiSource] : ""}
        </p>
      </div>
      <Table>
        <TableHeader>
          <TableRow><TableHead>Job</TableHead><TableHead className="text-right">Rules rank</TableHead><TableHead className="text-right">AI rank</TableHead><TableHead>Move</TableHead><TableHead>Answer (both)</TableHead></TableRow>
        </TableHeader>
        <TableBody>
          {c.rows.map((r) => {
            const move = r.rules.rank - r.ai.rank;
            return (
              <TableRow key={r.opportunity_id}>
                <TableCell><span className="font-medium">{r.title}</span><br /><span className="text-xs text-muted-foreground">{r.employer}</span></TableCell>
                <TableCell className="text-right">{r.rules.rank}</TableCell>
                <TableCell className="text-right font-semibold">{r.ai.rank}</TableCell>
                <TableCell>
                  {move === 0 ? <span className="text-muted-foreground">Same</span> : (
                    <span className="inline-flex items-center gap-1">
                      {move > 0 ? <ArrowUp aria-hidden="true" className="h-3.5 w-3.5 text-primary" /> : <ArrowDown aria-hidden="true" className="h-3.5 w-3.5 text-muted-foreground" />}
                      {move > 0 ? `Up ${move}` : `Down ${-move}`}
                    </span>
                  )}
                </TableCell>
                <TableCell>{STATUS_LABEL[r.ai.status]}</TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      <p className="text-xs text-muted-foreground">Against Team 5’s 30 provisional labels, interest order differs by about 1.5 of 42 comparable pairs (92.9% with AI, 89.3% rules only): too small to call the AI better. A known miss: “customer journey mapping” is suggested as Healthcare operations; reject it in AI suggestions.</p>
    </div>
  );
}
