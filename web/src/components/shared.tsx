import { Link } from "react-router-dom";
import { cn } from "@/lib/utils";

interface EmptyStateProps {
  icon?: React.ReactNode;
  title: string;
  description?: string;
  action?: { label: string; to?: string; onClick?: () => void };
  className?: string;
}

export const EmptyState = ({ icon, title, description, action, className }: EmptyStateProps) => (
  <div className={cn("flex flex-col items-center justify-center rounded-2xl border border-dashed border-border bg-card/50 px-6 py-14 text-center", className)}>
    {icon && (
      <div className="mb-3 grid h-12 w-12 place-items-center rounded-xl bg-secondary text-muted-foreground">
        {icon}
      </div>
    )}
    <h3 className="font-display text-lg font-medium text-foreground">{title}</h3>
    {description && <p className="mt-1 max-w-sm text-sm text-muted-foreground">{description}</p>}
    {action && (
      action.to ? (
        <Link to={action.to}>
          <button className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
            {action.label}
          </button>
        </Link>
      ) : (
        <button onClick={action.onClick} className="mt-4 inline-flex h-9 items-center rounded-lg bg-primary px-4 text-sm font-medium text-primary-foreground hover:bg-primary/90">
          {action.label}
        </button>
      )
    )}
  </div>
);

export const SectionHeading = ({ title, subtitle, action }: { title: string; subtitle?: string; action?: React.ReactNode }) => (
  <div className="flex items-end justify-between gap-3">
    <div>
      <h2 className="font-display text-xl font-semibold text-foreground">{title}</h2>
      {subtitle && <p className="mt-0.5 text-sm text-muted-foreground">{subtitle}</p>}
    </div>
    {action}
  </div>
);

export const StatusPill = ({ status }: { status: "paid" | "unpaid" | "present" | "absent" }) => {
  const map = {
    paid: "bg-success/12 text-success border-success/25",
    unpaid: "bg-destructive/12 text-destructive border-destructive/25",
    present: "bg-success/12 text-success border-success/25",
    absent: "bg-destructive/12 text-destructive border-destructive/25",
  } as const;
  const label = status === "paid" ? "Paid" : status === "unpaid" ? "Unpaid" : status === "present" ? "Present" : "Absent";
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium capitalize", map[status])}>
      {label}
    </span>
  );
};

export const Avatar = ({ name, src, size = 40 }: { name: string; src?: string | null; size?: number }) => {
  const initials = name
    .split(" ")
    .map((p) => p[0])
    .slice(0, 2)
    .join("")
    .toUpperCase();
  return (
    <div
      className="grid shrink-0 place-items-center overflow-hidden rounded-full bg-primary/15 font-display font-semibold text-primary"
      style={{ width: size, height: size, fontSize: size * 0.38 }}
    >
      {src ? <img src={src} alt={name} className="h-full w-full object-cover" /> : initials}
    </div>
  );
};
