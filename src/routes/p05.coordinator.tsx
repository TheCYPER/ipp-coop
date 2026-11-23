import { createFileRoute } from "@tanstack/react-router";
import { AppShell, PageHeader } from "@/components/AppShell";
import { P05Coordinator } from "@/components/p05/coordinator/P05Coordinator";

const TITLE = "Matching coordinator · P05 · IPP";
const DESCRIPTION = "Check any P05 match result and what it was based on, review AI skill suggestions and answer students' questions.";

export const Route = createFileRoute("/p05/coordinator")({
  head: () => ({
    meta: [
      { title: TITLE },
      { name: "description", content: DESCRIPTION },
      { property: "og:title", content: TITLE },
      { property: "og:description", content: DESCRIPTION },
    ],
  }),
  component: CoordinatorPage,
});

function CoordinatorPage() {
  return (
    <AppShell>
      <PageHeader
        title="Matching coordinator"
        subtitle="P05, Team 5. Check any result and what it was based on, decide on the AI’s skill suggestions and answer students’ questions. Reads the shared database; your decisions are drafts in this browser until P05 writes go live."
      />
      <P05Coordinator />
    </AppShell>
  );
}
