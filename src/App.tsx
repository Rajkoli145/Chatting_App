import { Toaster } from "@/components/ui/toaster";
import { Toaster as Sonner } from "@/components/ui/sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { HelmetProvider } from "react-helmet-async";
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './components/auth/LoginPage';
import RegisterPage from './components/auth/RegisterPage';
import Index from './pages/Index';
import NotFound from "./pages/NotFound";

const queryClient = new QueryClient();

// ProtectedRoute moved inside App to ensure AuthProvider context is available

function AuthenticatedLayout() {
  return <Index />;
}

const App = () => {
  // ProtectedRoute component defined inside App to ensure AuthProvider context access
  function ProtectedRoute({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-secondary flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }
    
    if (!isAuthenticated) {
      return <Navigate to="/login" replace />;
    }
    
    return <>{children}</>;
  }

  // AuthRedirect component to redirect authenticated users away from login/register
  function AuthRedirect({ children }: { children: React.ReactNode }) {
    const { isAuthenticated, isLoading } = useAuth();
    
    if (isLoading) {
      return (
        <div className="min-h-screen bg-gradient-secondary flex items-center justify-center">
          <div className="text-center">
            <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary mx-auto mb-4"></div>
            <p className="text-muted-foreground">Loading...</p>
          </div>
        </div>
      );
    }
    
    if (isAuthenticated) {
      return <Navigate to="/" replace />;
    }
    
    return <>{children}</>;
  }

  return (
    <HelmetProvider>
      <QueryClientProvider client={queryClient}>
        <TooltipProvider>
          <Router>
            <AuthProvider>
              <Routes>
                <Route path="/login" element={
                  <AuthRedirect>
                    <LoginPage />
                  </AuthRedirect>
                } />
                <Route path="/register" element={
                  <AuthRedirect>
                    <RegisterPage />
                  </AuthRedirect>
                } />
                <Route path="/" element={
                  <ProtectedRoute>
                    <Index />
                  </ProtectedRoute>
                } />
                <Route path="*" element={<NotFound />} />
              </Routes>
              <Toaster />
              <Sonner />
            </AuthProvider>
          </Router>
        </TooltipProvider>
      </QueryClientProvider>
    </HelmetProvider>
  );
};

export default App;
