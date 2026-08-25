import { lazy, Suspense } from 'react';
import { createBrowserRouter, RouterProvider } from 'react-router-dom';
import { Spinner } from '@/components/ui/Spinner';
import { AppLayout } from '@/layouts/AppLayout';
import { AuthLayout } from '@/layouts/AuthLayout';
import { AdminRoute, AuthenticatedRoute, ProtectedRoute, TeacherRoute } from './ProtectedRoute';
import { paths } from './paths';

const LoginPage = lazy(() => import('@/pages/Login/LoginPage'));
const RegisterPage = lazy(() => import('@/pages/Register/RegisterPage'));
const PendingPage = lazy(() => import('@/pages/Pending/PendingPage'));
const WelcomePage = lazy(() => import('@/pages/Welcome/WelcomePage'));
const DashboardPage = lazy(() => import('@/pages/Dashboard/DashboardPage'));
const TeacherPage = lazy(() => import('@/pages/Teacher/TeacherPage'));
const StudentPage = lazy(() => import('@/pages/Student/StudentPage'));
const AssignmentPage = lazy(() => import('@/pages/Assignment/AssignmentPage'));
const SpeakingPage = lazy(() => import('@/pages/Speaking/SpeakingPage'));
const ReadingPage = lazy(() => import('@/pages/Reading/ReadingPage'));
const WritingPage = lazy(() => import('@/pages/Writing/WritingPage'));
const ListeningPage = lazy(() => import('@/pages/Listening/ListeningPage'));
const AnalyticsPage = lazy(() => import('@/pages/Analytics/AnalyticsPage'));
const ProgressPage = lazy(() => import('@/pages/Progress/ProgressPage'));
const SocialPage = lazy(() => import('@/pages/Social/SocialPage'));
const SettingsPage = lazy(() => import('@/pages/Settings/SettingsPage'));
const AttendancePage = lazy(() => import('@/pages/Attendance/AttendancePage'));
const ApprovalsPage = lazy(() => import('@/pages/Approvals/ApprovalsPage'));
const NotFoundPage = lazy(() => import('@/pages/NotFound/NotFoundPage'));

function S({ children }: { children: React.ReactNode }) {
  return <Suspense fallback={<Spinner />}>{children}</Suspense>;
}

const router = createBrowserRouter([
  {
    element: <AuthLayout />,
    children: [
      { path: paths.login, element: <S><LoginPage /></S> },
      { path: paths.register, element: <S><RegisterPage /></S> },
      {
        element: <AuthenticatedRoute />,
        children: [{ path: paths.pending, element: <S><PendingPage /></S> }],
      },
    ],
  },
  {
    element: <ProtectedRoute />,
    children: [
      {
        element: <AppLayout />,
        children: [
          { path: paths.home, element: <S><WelcomePage /></S> },
          { path: paths.dashboard, element: <S><DashboardPage /></S> },
          { path: '/assignments/:id', element: <S><AssignmentPage /></S> },
          { path: paths.speaking, element: <S><SpeakingPage /></S> },
          { path: paths.reading, element: <S><ReadingPage /></S> },
          { path: paths.writing, element: <S><WritingPage /></S> },
          { path: paths.listening, element: <S><ListeningPage /></S> },
          { path: paths.analytics, element: <S><AnalyticsPage /></S> },
          { path: paths.progress, element: <S><ProgressPage /></S> },
          { path: paths.social, element: <S><SocialPage /></S> },
          { path: paths.settings, element: <S><SettingsPage /></S> },
          { path: paths.attendance, element: <S><AttendancePage /></S> },
          {
            element: <TeacherRoute />,
            children: [
              { path: paths.teacher, element: <S><TeacherPage /></S> },
              { path: '/student/:id', element: <S><StudentPage /></S> },
            ],
          },
          {
            element: <AdminRoute />,
            children: [{ path: paths.approvals, element: <S><ApprovalsPage /></S> }],
          },
        ],
      },
    ],
  },
  { path: '*', element: <S><NotFoundPage /></S> },
]);

export function AppRouter() {
  return <RouterProvider router={router} />;
}
