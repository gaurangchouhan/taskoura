import React from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './context/AuthContext';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { VerifyOtpPage } from './pages/VerifyOtpPage';
import { ProjectsDashboardPage } from './pages/ProjectsDashboardPage';
import { ProjectBoardPage } from './pages/ProjectBoardPage';
import { TeamPage } from './pages/TeamPage';
import { CheckinPage } from './pages/CheckinPage';
import { AnalyticsPage } from './pages/AnalyticsPage';
import { AiPlannerPage } from './pages/AiPlannerPage';
import { CalendarDeadlinesPage } from './pages/CalendarDeadlinesPage';
import { ProfilePage } from './pages/ProfilePage';

const ProtectedRoute: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }
  return <>{children}</>;
};

export const App: React.FC = () => {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Public Routes */}
          <Route path="/" element={<LandingPage />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/verify-otp" element={<VerifyOtpPage />} />

          {/* Core Projects & Templates */}
          <Route
            path="/projects"
            element={
              <ProtectedRoute>
                <ProjectsDashboardPage />
              </ProtectedRoute>
            }
          />

          {/* Module: Kanban Board, Subtasks, Bugs, Tests, Attachments, Comments, History */}
          <Route
            path="/projects/:projectId/board"
            element={
              <ProtectedRoute>
                <ProjectBoardPage />
              </ProtectedRoute>
            }
          />

          {/* Module: Team & Member Roles */}
          <Route
            path="/projects/:projectId/team"
            element={
              <ProtectedRoute>
                <TeamPage />
              </ProtectedRoute>
            }
          />

          {/* Module: Dashboard Analytics & Faculty Performance Reports */}
          <Route
            path="/projects/:projectId/dashboard"
            element={
              <ProtectedRoute>
                <AnalyticsPage />
              </ProtectedRoute>
            }
          />

          {/* Module: Groq AI Sprint Planner, Task Recommender & Test Generator */}
          <Route
            path="/projects/:projectId/ai-planner"
            element={
              <ProtectedRoute>
                <AiPlannerPage />
              </ProtectedRoute>
            }
          />

          {/* Module: Calendar & Upcoming Deadlines Reminders */}
          <Route
            path="/projects/:projectId/calendar"
            element={
              <ProtectedRoute>
                <CalendarDeadlinesPage />
              </ProtectedRoute>
            }
          />

          {/* Module: IoT Biometric Lab Check-in */}
          <Route
            path="/checkin"
            element={
              <ProtectedRoute>
                <CheckinPage />
              </ProtectedRoute>
            }
          />

          {/* Module: User Profile */}
          <Route
            path="/profile"
            element={
              <ProtectedRoute>
                <ProfilePage />
              </ProtectedRoute>
            }
          />

          {/* Fallback */}
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
};

export default App;
