import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { format, parseISO } from "date-fns";
import {
  CalendarDays,
  Image as ImageIcon,
  Loader2,
  NotebookPen,
  Plus,
  Trash2,
} from "lucide-react";
import { toast } from "sonner";

import { EmptyState, SectionHeading } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { supabase } from "@/lib/supabase";
import { useClassHomework } from "@/lib/queries";
import { DEFAULT_SUBJECTS, type HomeworkRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const SUBJECT_PALETTE: Record<string, string> = {
  Math: "bg-sky-500/15 text-sky-700",
  Mathematics: "bg-sky-500/15 text-sky-700",
  English: "bg-rose-500/15 text-rose-700",
  Bangla: "bg-emerald-500/15 text-emerald-700",
  Science: "bg-violet-500/15 text-violet-700",
};
const subjectColor = (s: string) => SUBJECT_PALETTE[s] ?? "bg-accent/15 text-accent";

const HomeworkTab = ({ classId }: { classId: string }) => {
  const { data: homework, isLoading } = useClassHomework(classId);
  const qc = useQueryClient();

  const [subject, setSubject] = useState<string>(DEFAULT_SUBJECTS[0]);
  const [date, setDate] = useState<string>(format(new Date(), "yyyy-MM-dd"));
  const [task, setTask] = useState("");
  const [imageUrl, setImageUrl] = useState("");
  const [busy, setBusy] = useState(false);

  const grouped = (() => {
    const map = new Map<string, HomeworkRow[]>();
    for (const h of homework ?? []) {
      const arr = map.get(h.task_date) ?? [];
      arr.push(h);
      map.set(h.task_date, arr);
    }
    return [...map.entries()].sort((a, b) => (a[0] < b[0] ? 1 : -1));
  })();

  const post = async () => {
    if (!task.trim()) { toast.error("Task description required"); return; }
    setBusy(true);
    const { data: u } = await supabase.auth.getUser();
    const { error } = await supabase.from("homework").insert({
      class_id: classId,
      subject,
      task_date: date,
      task: task.trim(),
      image_url: imageUrl.trim() || null,
      posted_by: u.user?.id ?? null,
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Homework posted");
    setTask(""); setImageUrl("");
    qc.invalidateQueries({ queryKey: ["homework", classId] });
  };

  const remove = async (id: string) => {
    const { error } = await supabase.from("homework").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["homework", classId] });
  };

  return (
    <div className="space-y-5">
      <SectionHeading title="Homework Board" subtitle="Post daily assignments with subject & optional photo." />

      {/* Composer */}
      <Card className="border-border/60 p-4 shadow-soft sm:p-5 animate-in-up">
        <div className="grid gap-3 sm:grid-cols-[180px_160px_1fr]">
          <div className="space-y-1.5">
            <Label className="text-xs">Subject</Label>
            <select
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
            >
              {DEFAULT_SUBJECTS.map((s) => <option key={s} value={s}>{s}</option>)}
              <option value="General">General</option>
            </select>
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Date</Label>
            <Input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label className="text-xs">Image URL (optional)</Label>
            <div className="relative">
              <ImageIcon className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
              <Input value={imageUrl} onChange={(e) => setImageUrl(e.target.value)} placeholder="https://…" className="pl-9" />
            </div>
          </div>
        </div>
        <div className="mt-3 space-y-1.5">
          <Label className="text-xs">Task</Label>
          <Textarea
            value={task}
            onChange={(e) => setTask(e.target.value)}
            placeholder="Complete page 24, problems 1-5. Submit by tomorrow."
            rows={3}
          />
        </div>
        <div className="mt-3 flex justify-end">
          <Button onClick={post} disabled={busy}>
            {busy ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
            Post homework
          </Button>
        </div>
      </Card>

      {/* Feed */}
      {isLoading ? (
        <div className="grid place-items-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
      ) : grouped.length === 0 ? (
        <EmptyState
          icon={<NotebookPen className="h-5 w-5" />}
          title="No homework yet"
          description="Post your first assignment using the form above."
        />
      ) : (
        <div className="space-y-6">
          {grouped.map(([dateStr, items]) => (
            <section key={dateStr} className="animate-in-up">
              <div className="mb-2 flex items-center gap-2">
                <CalendarDays className="h-4 w-4 text-muted-foreground" />
                <h3 className="font-display text-base font-semibold">
                  {format(parseISO(dateStr), "EEEE, dd MMM yyyy")}
                </h3>
                <span className="text-xs text-muted-foreground">{items.length} task{items.length > 1 ? "s" : ""}</span>
              </div>
              <div className="space-y-2.5">
                {items.map((h) => (
                  <Card key={h.id} className="border-border/60 p-4 shadow-soft">
                    <div className="flex items-start gap-3">
                      <div className={cn("rounded-lg px-2.5 py-1 text-xs font-semibold", subjectColor(h.subject))}>
                        {h.subject}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="whitespace-pre-wrap text-sm leading-relaxed">{h.task}</p>
                        {h.image_url && (
                          <a href={h.image_url} target="_blank" rel="noreferrer" className="mt-2 inline-block">
                            <img src={h.image_url} alt="attachment" className="max-h-48 rounded-lg border border-border object-cover" />
                          </a>
                        )}
                      </div>
                      <button onClick={() => remove(h.id)} className="text-muted-foreground hover:text-destructive">
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </div>
                  </Card>
                ))}
              </div>
            </section>
          ))}
        </div>
      )}
    </div>
  );
};

export default HomeworkTab;
