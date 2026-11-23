import type { SourceState } from "./useMatchData";

/** Says where the data on screen came from: the shared database, or the labelled demo slice. */
export function SourceLine({ source }: { source: SourceState }) {
  const text = source.mode === "loading" ? "Loading the shared database…"
    : source.mode === "live" ? `Live from the shared BUS2010 database: ${source.counts.students} students, ${source.counts.listings} published jobs.`
    : "Demo data — couldn’t reach the shared database.";
  return (
    <p role="status" className="flex items-center gap-2 text-xs text-muted-foreground">
      {source.mode === "live" && <span aria-hidden="true" className="h-2 w-2 rounded-full bg-primary" />}
      {text}
    </p>
  );
}
