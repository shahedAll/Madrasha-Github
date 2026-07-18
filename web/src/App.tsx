import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route } from "react-router-dom";

import { Toaster } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { AuthProvider } from "@/lib/auth";
import { PublicOnly, RequireAuth } from "@/components/guards";

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

const App = () => (
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

export default App;
