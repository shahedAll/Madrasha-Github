import { useParams } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { AppHeader, TabBar } from "@/components/app-shell";
import { useClass } from "@/lib/queries";
import { EmptyState } from "@/components/shared";
import StudentsTab from "./StudentsTab";
import GradesTab from "./GradesTab";
import FeesTab from "./FeesTab";
import HomeworkTab from "./HomeworkTab";
import type { ExamTier } from "@/lib/types";

const ClassHub = ({ tab }: { tab: "students" | "grades" | "fees" | "homework" }) => {
  const { slug = "" } = useParams();
  const { data: classRow, isLoading } = useClass(slug);

  if (isLoading) {
    return (
      <div className="min-h-screen bg-paper">
        <AppHeader />
        <div className="grid place-items-center py-24 text-muted-foreground">
          <Loader2 className="h-6 w-6 animate-spin" />
        </div>
      </div>
    );
  }

  if (!classRow) {
    return (
      <div className="min-h-screen bg-paper">
        <AppHeader />
        <main className="mx-auto max-w-6xl px-4 py-8">
          <EmptyState
            icon={<Loader2 className="h-5 w-5" />}
            title="Class not found"
            description="This class may have been removed."
            action={{ label: "Back to dashboard", to: "/app" }}
          />
        </main>
      </div>
    );
  }

  const base = `/app/class/${slug}`;
  const tabs = [
    { to: base, label: "Students", tab: "students" as const },
    { to: `${base}/grades`, label: "Grades", tab: "grades" as const },
    { to: `${base}/fees`, label: "Fees", tab: "fees" as const },
    { to: `${base}/homework`, label: "Homework", tab: "homework" as const },
  ];

  return (
    <div className="min-h-screen bg-paper">
      <AppHeader
        title={classRow.name}
        subtitle="Class hub"
        right={
          <span className="hidden rounded-full border border-border bg-card px-3 py-1 text-xs font-medium text-muted-foreground sm:inline">
            {tab === "students" ? "Directory & attendance" : tab === "grades" ? "Exam marks" : tab === "fees" ? "Fee ledger" : "Daily assignments"}
          </span>
        }
      />
      <TabBar items={tabs.map((t) => ({ to: t.to, label: t.label }))} />
      <main className="mx-auto max-w-6xl px-4 py-6 sm:px-6">
        {tab === "students" && <StudentsTab classId={classRow.id} />}
        {tab === "grades" && <GradesTab classId={classRow.id} />}
        {tab === "fees" && <FeesTab classId={classRow.id} />}
        {tab === "homework" && <HomeworkTab classId={classRow.id} />}
      </main>
    </div>
  );
};

export default ClassHub;

export type { ExamTier };
