import { useMemo, useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  BadgeDollarSign,
  Check,
  Loader2,
  Plus,
  Search,
  Trash2,
  Wallet,
} from "lucide-react";
import { toast } from "sonner";

import { Avatar, EmptyState, SectionHeading, StatusPill } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogClose,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { supabase } from "@/lib/supabase";
import { useFeeMonths, useOtherFees, useStudents } from "@/lib/queries";
import { MONTH_NAMES, MONTH_SHORT, formatBDT, type FeeMonthRow, type OtherFeeRow } from "@/lib/types";
import { cn } from "@/lib/utils";

const CURRENT_YEAR = new Date().getFullYear();

const FeesTab = ({ classId }: { classId: string }) => {
  const { data: students, isLoading } = useStudents(classId);
  const [search, setSearch] = useState("");
  const [activeId, setActiveId] = useState<string | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return students ?? [];
    return (students ?? []).filter(
      (s) => s.full_name.toLowerCase().includes(q) || s.student_code.toLowerCase().includes(q)
    );
  }, [students, search]);

  const active = students?.find((s) => s.id === activeId) ?? null;

  return (
    <div className="space-y-5">
      <SectionHeading
        title="Fee Ledger"
        subtitle="Monthly tuition (Jan–Dec) & one-time fees. Toggle paid/unpaid in one tap."
      />

      <div className="grid gap-5 lg:grid-cols-[320px_1fr]">
        {/* Student list */}
        <div className="space-y-3">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input placeholder="Search student" value={search} onChange={(e) => setSearch(e.target.value)} className="pl-9" />
          </div>
          {isLoading ? (
            <div className="grid place-items-center py-12 text-muted-foreground"><Loader2 className="h-5 w-5 animate-spin" /></div>
          ) : filtered.length === 0 ? (
            <EmptyState icon={<Wallet className="h-5 w-5" />} title="No students" />
          ) : (
            <div className="space-y-1.5">
              {filtered.map((s) => (
                <button
                  key={s.id}
                  onClick={() => setActiveId(s.id)}
                  className={cn(
                    "flex w-full items-center gap-3 rounded-xl border p-2.5 text-left transition-all",
                    activeId === s.id
                      ? "border-primary bg-primary/8 shadow-soft"
                      : "border-border/60 bg-card hover:bg-secondary/50"
                  )}
                >
                  <Avatar name={s.full_name} src={s.photo_url} size={36} />
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-sm font-medium">{s.full_name}</div>
                    <div className="text-xs text-muted-foreground">#{s.roll_no} · {s.student_code}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Ledger */}
        {active ? (
          <Ledger studentId={active.id} studentName={active.full_name} classId={classId} />
        ) : (
          <EmptyState
            icon={<BadgeDollarSign className="h-5 w-5" />}
            title="Select a student"
            description="Pick a student from the list to manage their monthly and other fees."
            className="lg:min-h-[400px]"
          />
        )}
      </div>
    </div>
  );
};

const Ledger = ({ studentId, studentName, classId }: { studentId: string; studentName: string; classId: string }) => {
  const { data: months } = useFeeMonths(studentId, CURRENT_YEAR);
  const { data: otherFees } = useOtherFees(studentId);
  const qc = useQueryClient();
  const [year] = useState(CURRENT_YEAR);

  const monthMap = useMemo(() => {
    const m = new Map<number, FeeMonthRow>();
    for (const r of months ?? []) m.set(r.month, r);
    return m;
  }, [months]);

  const totalPaid = useMemo(() => (months ?? []).filter((m) => m.status === "paid").reduce((a, b) => a + Number(b.amount), 0), [months]);
  const totalDue = useMemo(() => (months ?? []).filter((m) => m.status === "unpaid").reduce((a, b) => a + Number(b.amount), 0), [months]);

  const toggleMonth = useMutation({
    mutationFn: async ({ month, row }: { month: number; row?: FeeMonthRow }) => {
      const { data: u } = await supabase.auth.getUser();
      if (row) {
        const next = row.status === "paid" ? "unpaid" : "paid";
        const { error } = await supabase
          .from("fee_months")
          .update({
            status: next,
            paid_date: next === "paid" ? new Date().toISOString().slice(0, 10) : null,
            updated_by: u.user?.id ?? null,
          })
          .eq("id", row.id);
        if (error) throw error;
      } else {
        const { error } = await supabase.from("fee_months").insert({
          student_id: studentId,
          year,
          month,
          amount: 800,
          status: "paid",
          paid_date: new Date().toISOString().slice(0, 10),
          updated_by: u.user?.id ?? null,
        });
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fees-months", studentId, year] }),
    onError: (e) => toast.error(e.message),
  });

  const updateAmount = useMutation({
    mutationFn: async ({ row, amount }: { row: FeeMonthRow; amount: number }) => {
      const { error } = await supabase.from("fee_months").update({ amount }).eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["fees-months", studentId, year] }),
    onError: (e) => toast.error(e.message),
  });

  const toggleOther = useMutation({
    mutationFn: async ({ row }: { row: OtherFeeRow }) => {
      const { data: u } = await supabase.auth.getUser();
      const next = row.status === "paid" ? "unpaid" : "paid";
      const { error } = await supabase
        .from("other_fees")
        .update({ status: next, paid_date: next === "paid" ? new Date().toISOString().slice(0, 10) : null, updated_by: u.user?.id ?? null })
        .eq("id", row.id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["other-fees", studentId] }),
    onError: (e) => toast.error(e.message),
  });

  const seedMonths = async () => {
    const rows = Array.from({ length: 12 }, (_, i) => ({
      student_id: studentId, year, month: i + 1, amount: 800, status: "unpaid",
    }));
    const { error } = await supabase.from("fee_months").upsert(rows, { onConflict: "student_id,year,month" });
    if (error) { toast.error(error.message); return; }
    toast.success("Monthly slots created");
    qc.invalidateQueries({ queryKey: ["fees-months", studentId, year] });
  };

  return (
    <div className="space-y-5 animate-in-up">
      {/* Summary */}
      <Card className="border-border/60 p-4 shadow-soft sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-muted-foreground">{year} Tuition</div>
            <div className="font-display text-xl font-semibold">{studentName}</div>
          </div>
          <div className="flex flex-wrap gap-4">
            <Stat label="Collected" value={formatBDT(totalPaid)} tone="success" />
            <Stat label="Outstanding" value={formatBDT(totalDue)} tone="destructive" />
          </div>
          {(months?.length ?? 0) === 0 && (
            <Button size="sm" onClick={seedMonths}>Generate 12 monthly slots</Button>
          )}
        </div>
      </Card>

      {/* Monthly grid */}
      <div>
        <div className="mb-2 text-sm font-medium text-muted-foreground">Monthly tuition</div>
        <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-3">
          {MONTH_NAMES.map((_, i) => {
            const month = i + 1;
            const row = monthMap.get(month);
            const paid = row?.status === "paid";
            return (
              <div
                key={month}
                className={cn(
                  "rounded-xl border p-3 transition-all",
                  paid ? "border-success/30 bg-success/5" : "border-border/60 bg-card"
                )}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "grid h-9 w-9 place-items-center rounded-lg text-xs font-semibold",
                      paid ? "bg-success/15 text-success" : "bg-secondary text-muted-foreground"
                    )}>
                      {MONTH_SHORT[i]}
                    </div>
                    <div>
                      <div className="text-sm font-medium">{MONTH_NAMES[i]}</div>
                      <div className="text-xs text-muted-foreground">
                        {row ? formatBDT(Number(row.amount)) : "No slot"}
                      </div>
                    </div>
                  </div>
                  <button
                    onClick={() => toggleMonth.mutate({ month, row })}
                    disabled={toggleMonth.isPending}
                    className={cn(
                      "grid h-9 w-9 place-items-center rounded-lg border transition-all",
                      paid
                        ? "border-success bg-success text-success-foreground"
                        : "border-border bg-card text-muted-foreground hover:border-success/50 hover:text-success"
                    )}
                    title={paid ? "Mark unpaid" : "Mark paid"}
                  >
                    {toggleMonth.isPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Check className="h-4 w-4" />}
                  </button>
                </div>
                {row && (
                  <div className="mt-2 flex items-center gap-2">
                    <Input
                      type="number"
                      defaultValue={Number(row.amount)}
                      onBlur={(e) => {
                        const v = parseFloat(e.target.value);
                        if (!Number.isNaN(v) && v !== Number(row.amount)) updateAmount.mutate({ row, amount: v });
                      }}
                      className="h-8 text-xs"
                    />
                    <span className="text-xs text-muted-foreground">BDT</span>
                    {row.paid_date && <span className="ml-auto text-[11px] text-muted-foreground">Paid {row.paid_date}</span>}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      {/* Other fees */}
      <div>
        <div className="mb-2 flex items-center justify-between">
          <div className="text-sm font-medium text-muted-foreground">Other fees</div>
          <AddOtherFeeDialog studentId={studentId} />
        </div>
        {(otherFees?.length ?? 0) === 0 ? (
          <EmptyState icon={<Plus className="h-5 w-5" />} title="No other fees" description="Add exam, session, or admission fees." />
        ) : (
          <div className="space-y-2">
            {otherFees?.map((f) => (
              <Card key={f.id} className="flex items-center gap-3 border-border/60 p-3 shadow-soft">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{f.label}</div>
                  <div className="text-xs text-muted-foreground">{formatBDT(Number(f.amount))}{f.paid_date && ` · paid ${f.paid_date}`}</div>
                </div>
                <StatusPill status={f.status} />
                <button
                  onClick={() => toggleOther.mutate({ row: f })}
                  className={cn(
                    "grid h-9 w-9 place-items-center rounded-lg border transition-all",
                    f.status === "paid"
                      ? "border-success bg-success text-success-foreground"
                      : "border-border bg-card text-muted-foreground hover:border-success/50 hover:text-success"
                  )}
                >
                  <Check className="h-4 w-4" />
                </button>
                <DeleteOtherFee id={f.id} studentId={studentId} />
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

const Stat = ({ label, value, tone }: { label: string; value: string; tone: "success" | "destructive" }) => (
  <div>
    <div className={cn("font-display text-lg font-semibold", tone === "success" ? "text-success" : "text-destructive")}>{value}</div>
    <div className="text-xs text-muted-foreground">{label}</div>
  </div>
);

const AddOtherFeeDialog = ({ studentId }: { studentId: string }) => {
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState("");
  const [amount, setAmount] = useState("");
  const [busy, setBusy] = useState(false);

  const add = async () => {
    if (!label.trim() || !amount) { toast.error("Label and amount required"); return; }
    setBusy(true);
    const { error } = await supabase.from("other_fees").insert({
      student_id: studentId,
      label: label.trim(),
      amount: parseFloat(amount) || 0,
      status: "unpaid",
    });
    setBusy(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Fee added");
    setOpen(false);
    setLabel(""); setAmount("");
    qc.invalidateQueries({ queryKey: ["other-fees", studentId] });
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild><Button size="sm" variant="outline"><Plus className="h-4 w-4" /> Add fee</Button></DialogTrigger>
      <DialogContent>
        <DialogHeader><DialogTitle>Add other fee</DialogTitle></DialogHeader>
        <div className="grid gap-3 py-2">
          <div className="space-y-1.5"><Label className="text-xs">Label</Label><Input value={label} onChange={(e) => setLabel(e.target.value)} placeholder="Exam fee / Session fee / Admission" /></div>
          <div className="space-y-1.5"><Label className="text-xs">Amount (BDT)</Label><Input type="number" value={amount} onChange={(e) => setAmount(e.target.value)} placeholder="500" /></div>
        </div>
        <DialogFooter>
          <DialogClose asChild><Button variant="ghost">Cancel</Button></DialogClose>
          <Button onClick={add} disabled={busy}>{busy && <Loader2 className="h-4 w-4 animate-spin" />}Add</Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

const DeleteOtherFee = ({ id, studentId }: { id: string; studentId: string }) => {
  const qc = useQueryClient();
  const remove = async () => {
    const { error } = await supabase.from("other_fees").delete().eq("id", id);
    if (error) { toast.error(error.message); return; }
    qc.invalidateQueries({ queryKey: ["other-fees", studentId] });
  };
  return (
    <button onClick={remove} className="grid h-9 w-9 place-items-center rounded-lg border border-border bg-card text-muted-foreground hover:border-destructive/50 hover:text-destructive">
      <Trash2 className="h-4 w-4" />
    </button>
  );
};

export default FeesTab;
