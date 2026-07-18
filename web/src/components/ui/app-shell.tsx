import { Link, NavLink, useNavigate } from "react-router-dom";
import { GraduationCap, LogOut, UserRound } from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth";
import { Avatar } from "@/components/shared";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

interface AppHeaderProps {
  title?: string;
  subtitle?: string;
  right?: React.ReactNode;
}

export const AppHeader = ({ title, subtitle, right }: AppHeaderProps) => {
  const { profile, signOut } = useAuth();
  const navigate = useNavigate();

  const handleSignOut = async () => {
    await signOut();
    toast("Signed out");
    navigate("/login", { replace: true });
  };

  return (
    <header className="sticky top-0 z-20 border-b border-border/60 bg-background/85 backdrop-blur-md">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-3 px-4 sm:px-6">
        <Link to={profile?.role === "parent" ? "/parent" : "/app"} className="flex items-center gap-2.5">
          <div className="grid h-9 w-9 place-items-center rounded-xl bg-primary text-primary-foreground">
            <GraduationCap className="h-5 w-5" />
          </div>
          <div className="hidden sm:block">
            <div className="font-display text-base font-semibold leading-tight">SchoolHub</div>
            <div className="text-[11px] uppercase tracking-wide text-muted-foreground">
              {profile?.role === "parent" ? "Parent Portal" : "Staff Console"}
            </div>
          </div>
        </Link>

        {title && (
          <div className="ml-2 hidden min-w-0 flex-1 md:block">
            <div className="truncate font-display text-lg font-semibold">{title}</div>
            {subtitle && <div className="truncate text-xs text-muted-foreground">{subtitle}</div>}
          </div>
        )}

        <div className="ml-auto flex items-center gap-2">
          {right}
          <div className="hidden items-center gap-2 rounded-full border border-border bg-card px-3 py-1.5 sm:flex">
            <Avatar name={profile?.full_name ?? profile?.email ?? "User"} src={profile?.avatar_url} size={26} />
            <span className="text-sm font-medium">{profile?.full_name ?? profile?.email}</span>
          </div>
          <Button variant="ghost" size="icon" onClick={handleSignOut} title="Sign out">
            <LogOut className="h-4 w-4" />
          </Button>
        </div>
      </div>
    </header>
  );
};

interface TabItem {
  to: string;
  label: string;
  icon?: React.ReactNode;
}

export const TabBar = ({ items }: { items: TabItem[] }) => (
  <nav className="sticky top-16 z-10 border-b border-border/60 bg-background/85 backdrop-blur-md">
    <div className="mx-auto flex max-w-6xl gap-1 overflow-x-auto px-2 py-2 scrollbar-thin sm:px-6">
      {items.map((t) => (
        <NavLink
          key={t.to}
          to={t.to}
          className={({ isActive }) =>
            cn(
              "inline-flex items-center gap-2 whitespace-nowrap rounded-lg px-3.5 py-2 text-sm font-medium transition-colors",
              isActive
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            )
          }
        >
          {t.icon}
          {t.label}
        </NavLink>
      ))}
    </div>
  </nav>
);

export const MobileTopBack = ({ to, label }: { to: string; label: string }) => (
  <Link to={to} className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground">
    <UserRound className="h-4 w-4" /> {label}
  </Link>
);
