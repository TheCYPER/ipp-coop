import type { ReactNode } from "react";

/** A titled block of the coordinator page. */
export function Section({ id, title, aside, children }: { id: string; title: string; aside?: ReactNode; children: ReactNode }) {
  return (
    <section aria-labelledby={id} className="border-t border-border pt-5">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id={id} className="font-display text-lg font-bold">{title}</h3>
        {aside && <span className="text-xs text-muted-foreground">{aside}</span>}
      </div>
      {children}
    </section>
  );
}

/** Shown where a block needs the shared database and only the demo slice is loaded. */
export function NeedsLive({ what }: { what: string }) {
  return <p className="rounded-2xl bg-muted p-4 text-sm text-muted-foreground">{what} come from the shared database, which can’t be reached right now. The demo data has none.</p>;
}

export const STATUS_LABEL: Record<"eligible" | "cannot_confirm" | "not_eligible" | "excluded", string> = {
  eligible: "Can apply",
  cannot_confirm: "Cannot confirm yet",
  not_eligible: "Not a fit now",
  excluded: "Closed",
};

export function fmtTime(iso: string | null): string {
  if (!iso) return "not given";
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? iso : d.toLocaleString("en-GB", { day: "numeric", month: "short", year: "numeric", hour: "2-digit", minute: "2-digit", timeZone: "Asia/Dubai" });
}
