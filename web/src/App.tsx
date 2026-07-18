import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { PublicOnly, RequireAuth } from "@/components/guards";
import { supabaseInitError } from "@/lib/supabase";

import Login from "@/pages/Login";
import TeacherDashboard from "@/pages/teacher/Dashboard";
import ClassHub from "@/pages/teacher/ClassHub";
import AlertsPage from "@/pages/teacher/Alerts";
import ParentHome from "@/pages/parent/ParentHome";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { refetchOnWindowFocus: false, retry: 1 },
  },
});

const App = () => {
  if (supabaseInitError) {
    return (
      <div className="min-h-screen bg-paper px-6 py-12 text-center">
        <div className="mx-auto max-w-2xl rounded-3xl border border-destructive/30 bg-destructive/5 p-10 shadow-soft">
          <h1 className="text-2xl font-semibold text-destructive">Configuration required</h1>
          <p className="mt-4 text-sm text-muted-foreground">
            SchoolHub cannot start because Supabase environment variables are missing.
          </p>
          <div className="mt-6 rounded-2xl bg-background p-4 text-left text-sm text-foreground shadow-sm">
            <p className="font-medium">Add the following to <code className="rounded bg-secondary px-1 py-0.5">web/.env</code> or your shell environment:</p>
            <pre className="mt-3 overflow-x-auto rounded-lg bg-slate-950/5 p-3 text-xs text-slate-900">
VITE_SUPABASE_URL=your-supabase-url
VITE_SUPABASE_ANON_KEY=your-supabase-anon-key
            </pre>
          </div>
          <p className="mt-4 text-xs text-muted-foreground">Restart the dev server after adding the variables.</p>
        </div>
      </div>
    );
  }

  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <TooltipProvider>
          <Toaster richColors position="top-center" />
          <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
            <Routes>
              {/* Public */}
              <Route element={<PublicOnly />}>
                <Route path="/login" element={<Login />} />
              </Route>

              {/* Staff area */}
              <Route element={<RequireAuth requireStaff />}>
                <Route path="/app" element={<TeacherDashboard />} />
                <Route path="/app/class/:slug" element={<ClassHub tab="students" />} />
                <Route path="/app/class/:slug/grades" element={<ClassHub tab="grades" />} />
                <Route path="/app/class/:slug/fees" element={<ClassHub tab="fees" />} />
                <Route path="/app/class/:slug/homework" element={<ClassHub tab="homework" />} />
                <Route path="/app/alerts" element={<AlertsPage />} />
              </Route>

              {/* Parent area */}
              <Route element={<RequireAuth requireParent />}>
                <Route path="/parent" element={<ParentHome tab="profile" />} />
                <Route path="/parent/attendance" element={<ParentHome tab="attendance" />} />
                <Route path="/parent/grades" element={<ParentHome tab="grades" />} />
                <Route path="/parent/fees" element={<ParentHome tab="fees" />} />
                <Route path="/parent/homework" element={<ParentHome tab="homework" />} />
              </Route>

              <Route path="/" element={<Login />} />
              <Route path="*" element={<NotFound />} />
            </Routes>
          </BrowserRouter>
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
};

export default App;
