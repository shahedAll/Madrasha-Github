import { Navigate, Outlet, useLocation } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { useAuth } from "@/lib/auth";

export const RequireAuth = ({ requireStaff = false, requireParent = false }: { requireStaff?: boolean; requireParent?: boolean }) => {
  const { session, profile, loading, isStaff } = useAuth();
  const location = useLocation();

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }

  if (!session) return <Navigate to="/login" replace state={{ from: location }} />;
  if (requireStaff && !isStaff) return <Navigate to="/parent" replace />;
  if (requireParent && isStaff) return <Navigate to="/app" replace />;

  return <Outlet />;
};

export const PublicOnly = () => {
  const { session, loading, isStaff } = useAuth();
  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-paper">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    );
  }
  if (session) return <Navigate to={isStaff ? "/app" : "/parent"} replace />;
  return <Outlet />;
};
