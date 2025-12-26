import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";
import { NotificationProvider } from "@/hooks/use-notifications";
import Setup from "@/pages/Setup";
import Dashboard from "@/pages/Dashboard";
import JobCreate from "@/pages/JobCreate";
import JobDetail from "@/pages/JobDetail";
import Configuration from "@/pages/Configuration";
import Health from "@/pages/Health";
import CorsTester from "@/pages/CorsTester";
import NotFound from "@/pages/NotFound";

const queryClient = new QueryClient();

const App = () => (
  <QueryClientProvider client={queryClient}>
    <TooltipProvider>
      <NotificationProvider>
        <Toaster />
        <Sonner />
        <BrowserRouter
          future={{
            v7_startTransition: true,
            v7_relativeSplatPath: true,
          }}
        >
          <div className="dark">
            <Routes>
              {/* Setup page - configure backend URL */}
              <Route path="/" element={<Setup />} />
              <Route path="/setup" element={<Setup />} />
              
              {/* Main app routes - no login required */}
              <Route path="/dashboard" element={<Dashboard />} />
              <Route path="/jobs/new" element={<JobCreate />} />
              <Route path="/jobs/:id" element={<JobDetail />} />
              <Route path="/config" element={<Configuration />} />
              <Route path="/configuration" element={<Configuration />} />
              <Route path="/health" element={<Health />} />
              <Route path="/cors-tester" element={<CorsTester />} />
              
              {/* Legacy login redirect */}
              <Route path="/login" element={<Navigate to="/" replace />} />
              
              <Route path="*" element={<NotFound />} />
            </Routes>
          </div>
        </BrowserRouter>
      </NotificationProvider>
    </TooltipProvider>
  </QueryClientProvider>
);

export default App;
