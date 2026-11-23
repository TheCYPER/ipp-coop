import { useMemo, useState } from "react";
import { latestProfile, matchStudent, students as listStudents, type MethodFamily } from "@/lib/p05";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { SourceLine } from "../SourceLine";
import { StudentPicker } from "../StudentPicker";
import { useAiSignals, useMatchData } from "../useMatchData";
import { CheckResult } from "./CheckResult";
import { GapOverview } from "./GapOverview";
import { MethodCompare } from "./MethodCompare";
import { SkillSuggestions } from "./SkillSuggestions";
import { StudentQuestions } from "./StudentQuestions";
import { useChallenges, useDrafts } from "./useCoordinator";

type Tab = "check" | "suggestions" | "questions" | "gaps" | "compare";
const TABS: readonly Tab[] = ["check", "suggestions", "questions", "gaps", "compare"];

/**
 * P05 matching coordinator (Team 5): check any result and what it was based on, decide on the AI's skill suggestions,
 * answer students' questions, follow skill gaps sent to training, and compare the rules with the AI. Reads the shared
 * database; decisions are drafts in this browser until P05 writes go live.
 */
export function P05Coordinator({ initialStudent = "COOP-B005" }: { initialStudent?: string }) {
  const { data, source } = useMatchData();
  const live = source.mode === "live";
  const [student, setStudent] = useState(initialStudent);
  const [tab, setTab] = useState<Tab>("check");
  const [jobId, setJobId] = useState<string | null>(null);
  const [family, setFamily] = useState<MethodFamily>("rules");
  const { ai, loading: aiLoading } = useAiSignals(data, live, student, true);
  const drafts = useDrafts();
  const challenges = useChallenges(live);

  const people = useMemo(() => (data ? listStudents(data) : []), [data]);
  const fam: MethodFamily = family === "ai" && aiLoading ? "rules" : family;
  const result = useMemo(() => (data ? matchStudent(live ? { ...data, ai } : data, student, fam) : null), [data, ai, live, student, fam]);

  if (!data) return <div className="py-6"><SourceLine source={source} /></div>;
  const profile = latestProfile(data, student);
  if (!profile || !result) {
    return (
      <div className="space-y-3 py-6">
        <SourceLine source={source} />
        <p>No submitted profile for {student} in this data. <Button variant="link" className="px-1" onClick={() => setStudent(people[0]?.student_id ?? initialStudent)}>Show the first student</Button></p>
      </div>
    );
  }

  const pickStudent = (id: string) => { setStudent(id); setJobId(null); };
  const openResult = (studentId: string, opportunityId: string) => { setStudent(studentId); setJobId(opportunityId); setFamily("rules"); setTab("check"); };
  const openCount = challenges.data?.filter((c) => c.status === "open").length;

  return (
    <div className="space-y-6">
      <div className="flex flex-col gap-5 rounded-3xl bg-panel p-6 text-panel-foreground lg:flex-row lg:items-start lg:justify-between">
        <div className="min-w-0 max-w-xl space-y-2">
          <p className="text-sm text-panel-muted">Checking results for</p>
          <h2 className="font-display text-2xl font-bold">{profile.name} <span className="font-mono text-sm font-normal text-panel-muted">{profile.student_id} · profile v{profile.profile_version}</span></h2>
          {profile.change_note && <p className="text-panel-muted">Latest change: {profile.change_note}</p>}
          <p className="text-xs text-panel-muted">{drafts.list.length} decision{drafts.list.length === 1 ? "" : "s"} saved as drafts in this browser.</p>
        </div>
        <StudentPicker people={people} student={student} inputId="p05-coord-student" label="Another student" onPick={pickStudent} />
      </div>
      <SourceLine source={source} />

      <Tabs value={tab} onValueChange={(v) => { const t = TABS.find((x) => x === v); if (t) setTab(t); }}>
        <TabsList aria-label="Coordinator tasks" className="mb-4 grid h-auto w-full grid-cols-2 sm:inline-flex sm:w-auto">
          <TabsTrigger value="check" className="px-3 py-2 text-xs sm:text-sm">Check a result</TabsTrigger>
          <TabsTrigger value="suggestions" className="px-3 py-2 text-xs sm:text-sm">AI suggestions</TabsTrigger>
          <TabsTrigger value="questions" className="px-3 py-2 text-xs sm:text-sm">Questions{openCount ? ` (${openCount})` : ""}</TabsTrigger>
          <TabsTrigger value="gaps" className="px-3 py-2 text-xs sm:text-sm">Skill gaps</TabsTrigger>
          <TabsTrigger value="compare" className="col-span-2 px-3 py-2 text-xs sm:text-sm">Rules vs AI</TabsTrigger>
        </TabsList>

        <TabsContent value="check" className="space-y-4">
          <ToggleGroup type="single" value={family} onValueChange={(v) => { if (v === "rules" || v === "ai") setFamily(v); }} aria-label="Method to check" className="justify-start">
            <ToggleGroupItem value="rules" className="rounded-full px-4">Rules only</ToggleGroupItem>
            <ToggleGroupItem value="ai" className="rounded-full px-4">With AI similarity</ToggleGroupItem>
          </ToggleGroup>
          <CheckResult data={data} records={result.records} jobId={jobId} onJob={setJobId} live={live} />
        </TabsContent>
        <TabsContent value="suggestions">
          <SkillSuggestions data={data} profile={profile} ai={ai} aiLoading={aiLoading} live={live} drafts={drafts} />
        </TabsContent>
        <TabsContent value="questions">
          <StudentQuestions data={data} live={live} drafts={drafts} onOpen={openResult} />
        </TabsContent>
        <TabsContent value="gaps">
          <GapOverview data={data} live={live} studentId={student} />
        </TabsContent>
        <TabsContent value="compare">
          <MethodCompare data={data} studentId={student} ai={live ? ai : data.ai} aiLoading={aiLoading} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
