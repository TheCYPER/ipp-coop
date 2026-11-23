import { useState } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

const DEMO_PICKS = ["COOP-B001", "COOP-B004", "COOP-B005", "COOP-B006", "COOP-P001"];

interface Props {
  people: { student_id: string; name: string }[];
  student: string;
  onPick: (studentId: string) => void;
  inputId: string;
  label: string;
}

/** Type a name or ID, or tap a demo student. Sits on the dark panel. */
export function StudentPicker({ people, student, onPick, inputId, label }: Props) {
  const [search, setSearch] = useState("");
  const pick = (value: string) => {
    setSearch(value);
    const id = /COOP-[A-Z]\d{3}/i.exec(value)?.[0]?.toUpperCase();
    const hit = id ? people.find((p) => p.student_id === id) : people.find((p) => p.name.toLowerCase() === value.trim().toLowerCase());
    if (hit) { onPick(hit.student_id); setSearch(""); }
  };
  return (
    <div className="w-full max-w-sm space-y-2">
      <Label htmlFor={inputId} className="text-panel-muted">{label} ({people.length})</Label>
      <Input id={inputId} list={`${inputId}-list`} value={search} onChange={(e) => pick(e.target.value)} placeholder="Type a name or COOP-B…" className="border-panel-muted/40 bg-panel text-panel-foreground placeholder:text-panel-muted" />
      <datalist id={`${inputId}-list`}>{people.map((p) => <option key={p.student_id} value={`${p.name} (${p.student_id})`} />)}</datalist>
      <div className="flex flex-wrap gap-1.5" aria-label="Demo students">
        {DEMO_PICKS.filter((id) => people.some((p) => p.student_id === id)).map((id) => (
          <button key={id} type="button" aria-pressed={id === student} onClick={() => onPick(id)}
            className={`rounded-full px-3 py-1 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-lime ${id === student ? "bg-lime text-lime-foreground" : "border border-panel-muted/40 text-panel-foreground hover:bg-white/10"}`}>
            {people.find((p) => p.student_id === id)?.name.split(" ")[0] ?? id}
          </button>
        ))}
      </div>
    </div>
  );
}
