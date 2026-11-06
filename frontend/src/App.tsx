import React from 'react';
import { Routes, Route } from 'react-router-dom';
import { ScrollToTop } from './components/ScrollToTop';
import { LandingPage } from './pages/LandingPage';
import { LoginPage } from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { VerifyEmailPage } from './pages/VerifyEmailPage';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectBoardPage } from './pages/ProjectBoardPage';
import { ProjectLayout } from './pages/ProjectLayout';
import { projectTabs } from './components/projects/projectTabs';
import { NotificationsPage } from './pages/NotificationsPage';
import { NotFoundPage } from './pages/NotFoundPage';
import { ProtectedRoute } from './routes/ProtectedRoute';
import { PublicOnlyRoute } from './routes/PublicOnlyRoute';
import { ForgotPasswordPage } from './features/auth/pages/ForgotPasswordPage';
import { ResetPasswordPage } from './features/auth/pages/ResetPasswordPage';
import { ProfilePage } from './features/profile/pages/ProfilePage';
import { OAuthCallbackPage } from './pages/OAuthCallbackPage';
import {
  HOME,
  LOGIN,
  REGISTER,
  OAUTH_CALLBACK,
  WORKSPACE,
  FORGOT_PASSWORD,
  RESET_PASSWORD,
  VERIFY_EMAIL,
  VERIFY_OTP,
} from './routes/paths';

export const App: React.FC = () => {
  return (
    <>
      <ScrollToTop />
      <Routes>
        {/* Public Landing Page */}
        <Route path={HOME} element={<LandingPage />} />

        {/* Authentication & Verification Routes (Public Only) */}
        <Route path={OAUTH_CALLBACK} element={<OAuthCallbackPage />} />
        <Route
          path={LOGIN}
          element={
            <PublicOnlyRoute>
              <LoginPage />
            </PublicOnlyRoute>
          }
        />
        <Route
          path={REGISTER}
          element={
            <PublicOnlyRoute>
              <RegisterPage />
            </PublicOnlyRoute>
          }
        />
        <Route path={FORGOT_PASSWORD} element={<ForgotPasswordPage />} />
        <Route path={RESET_PASSWORD} element={<ResetPasswordPage />} />
        <Route path={VERIFY_EMAIL} element={<VerifyEmailPage />} />
        {/* Route alias for backward compatibility */}
        <Route path={VERIFY_OTP} element={<VerifyEmailPage />} />

        {/* Profile Routes (Protected) */}
        <Route
          path="/app/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/profile"
          element={
            <ProtectedRoute>
              <ProfilePage />
            </ProtectedRoute>
          }
        />

        {/* Project Management Dashboard & Board (Protected Routes) */}
        <Route
          path={WORKSPACE}
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/app/projects/:projectId"
          element={
            <ProtectedRoute>
              <ProjectLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProjectBoardPage />} />
          <Route path="board" element={<ProjectBoardPage />} />
          {projectTabs.map((tab) =>
            tab.path && tab.path !== 'board' ? (
              <Route key={tab.key} path={tab.path} element={tab.element} />
            ) : null
          )}
        </Route>

        {/* Notifications Route (Protected) */}
        <Route
          path="/app/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/notifications"
          element={
            <ProtectedRoute>
              <NotificationsPage />
            </ProtectedRoute>
          }
        />

        {/* Route aliases for backward compatibility */}
        <Route
          path="/dashboard"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects"
          element={
            <ProtectedRoute>
              <DashboardPage />
            </ProtectedRoute>
          }
        />
        <Route
          path="/projects/:id"
          element={
            <ProtectedRoute>
              <ProjectLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProjectBoardPage />} />
          <Route path="board" element={<ProjectBoardPage />} />
          {projectTabs.map((tab) =>
            tab.path && tab.path !== 'board' ? (
              <Route key={tab.key} path={tab.path} element={tab.element} />
            ) : null
          )}
        </Route>
        <Route
          path="/board/:id"
          element={
            <ProtectedRoute>
              <ProjectLayout />
            </ProtectedRoute>
          }
        >
          <Route index element={<ProjectBoardPage />} />
          <Route path="board" element={<ProjectBoardPage />} />
          {projectTabs.map((tab) =>
            tab.path && tab.path !== 'board' ? (
              <Route key={tab.key} path={tab.path} element={tab.element} />
            ) : null
          )}
        </Route>

        {/* Catch-all 404 Not Found Page */}
        <Route path="*" element={<NotFoundPage />} />
      </Routes>
    </>
  );
};

export default App;
