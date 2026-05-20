/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { Suspense, lazy } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { Layout } from './components/Layout';
import { AuthProvider, useAuth } from './components/AuthContext';
import { RehabProvider, useRehab } from './context/RehabContext';

// Route components are lazy-loaded so the initial bundle stays small.
// Without this, landing on `/` pulls in Firebase, Recharts, Motion, and every
// rehab page at once — which made dev cold-loads take many seconds.
const LandingPage     = lazy(() => import('./pages/LandingPage').then(m => ({ default: m.LandingPage })));
const AuthPage        = lazy(() => import('./pages/AuthPage').then(m => ({ default: m.AuthPage })));
const RehabDashboard  = lazy(() => import('./pages/rehab/RehabDashboard').then(m => ({ default: m.RehabDashboard })));
const RehabExercises  = lazy(() => import('./pages/rehab/RehabExercises').then(m => ({ default: m.RehabExercises })));
const RehabProgress   = lazy(() => import('./pages/rehab/RehabProgress').then(m => ({ default: m.RehabProgress })));
const RehabPlan       = lazy(() => import('./pages/rehab/RehabPlan').then(m => ({ default: m.RehabPlan })));
const MLPlaceholder   = lazy(() => import('./pages/rehab/MLPlaceholder').then(m => ({ default: m.MLPlaceholder })));
const RehabSession    = lazy(() => import('./pages/rehab/RehabSession').then(m => ({ default: m.RehabSession })));
const IMUSession      = lazy(() => import('./pages/rehab/IMUSession').then(m => ({ default: m.IMUSession })));
const DoctorDashboard = lazy(() => import('./pages/DoctorDashboard').then(m => ({ default: m.DoctorDashboard })));
const DoctorSettings  = lazy(() => import('./pages/DoctorSettings').then(m => ({ default: m.DoctorSettings })));
const DoctorPatientDetail = lazy(() => import('./pages/DoctorPatientDetail').then(m => ({ default: m.DoctorPatientDetail })));
const FindDoctor      = lazy(() => import('./pages/FindDoctor').then(m => ({ default: m.FindDoctor })));
const DoctorPublicProfile = lazy(() => import('./pages/DoctorPublicProfile').then(m => ({ default: m.DoctorPublicProfile })));
const Messages        = lazy(() => import('./pages/Messages').then(m => ({ default: m.Messages })));
const MessageThread   = lazy(() => import('./pages/MessageThread').then(m => ({ default: m.MessageThread })));

function LoadingSpinner() {
  return (
    <div className="h-screen w-screen flex items-center justify-center bg-slate-50">
      <div className="w-12 h-12 border-4 border-blue-600 border-t-transparent rounded-full animate-spin" />
    </div>
  );
}

// Requires authentication. Optionally requires a specific role.
function ProtectedRoute({ children, role }: { children: React.ReactNode; role?: 'patient' | 'doctor' }) {
  const { user, profile, loading } = useAuth();
  const { rehabType } = useRehab();

  if (loading) return <LoadingSpinner />;
  if (!user) return <Navigate to="/auth" replace />;
  if (role && profile && profile.role !== role) {
    return <Navigate to={`/rehab/${rehabType}/dashboard`} replace />;
  }

  return <>{children}</>;
}

// Public pages redirect authenticated users to their active rehab dashboard.
function PublicRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuth();
  const { rehabType } = useRehab();

  if (loading) return null;
  if (user) return <Navigate to={`/rehab/${rehabType}/dashboard`} replace />;
  return <>{children}</>;
}

// Catch-all: signed-in users land on their current rehab dashboard,
// signed-out users land on the marketing page.
function RehabRedirect() {
  const { user, loading } = useAuth();
  const { rehabType } = useRehab();
  if (loading) return <LoadingSpinner />;
  return <Navigate to={user ? `/rehab/${rehabType}/dashboard` : '/'} replace />;
}

export default function App() {
  return (
    <AuthProvider>
      <RehabProvider>
        <Router>
          <Layout>
            <Suspense fallback={<LoadingSpinner />}>
              <Routes>
                {/* ─── Public ──────────────────────────────────────────────── */}
                <Route path="/" element={<LandingPage />} />
                <Route path="/auth" element={<PublicRoute><AuthPage /></PublicRoute>} />

                {/* ─── Rehab Modules — :type param drives all three body parts ─ */}
                <Route path="/rehab/:type/dashboard" element={<ProtectedRoute><RehabDashboard /></ProtectedRoute>} />
                <Route path="/rehab/:type/exercises" element={<ProtectedRoute><RehabExercises /></ProtectedRoute>} />
                <Route path="/rehab/:type/progress"  element={<ProtectedRoute><RehabProgress /></ProtectedRoute>} />
                <Route path="/rehab/:type/plan"      element={<ProtectedRoute><RehabPlan /></ProtectedRoute>} />
                <Route path="/rehab/:type/ml"        element={<ProtectedRoute><MLPlaceholder /></ProtectedRoute>} />
                <Route path="/rehab/:type/session/:exerciseId"     element={<ProtectedRoute><RehabSession /></ProtectedRoute>} />
                <Route path="/rehab/:type/imu-session/:exerciseId" element={<ProtectedRoute><IMUSession /></ProtectedRoute>} />

                {/* ─── Doctor / Therapist View ─────────────────────────── */}
                <Route path="/doctor"                       element={<ProtectedRoute role="doctor"><DoctorDashboard /></ProtectedRoute>} />
                <Route path="/doctor/settings"              element={<ProtectedRoute role="doctor"><DoctorSettings /></ProtectedRoute>} />
                <Route path="/doctor/patient/:patientUid"   element={<ProtectedRoute role="doctor"><DoctorPatientDetail /></ProtectedRoute>} />

                {/* ─── Patient: Find a Doctor + public doctor profile ────── */}
                <Route path="/find-doctor"                  element={<ProtectedRoute role="patient"><FindDoctor /></ProtectedRoute>} />
                <Route path="/doctor-profile/:uid"          element={<ProtectedRoute><DoctorPublicProfile /></ProtectedRoute>} />

                {/* ─── Messaging (both roles) ─────────────────────────────── */}
                <Route path="/messages"                     element={<ProtectedRoute><Messages /></ProtectedRoute>} />
                <Route path="/messages/:connectionId"       element={<ProtectedRoute><MessageThread /></ProtectedRoute>} />

                {/* ─── Legacy / catch-all → land on current rehab dashboard ─ */}
                <Route path="*" element={<RehabRedirect />} />
              </Routes>
            </Suspense>
          </Layout>
        </Router>
      </RehabProvider>
    </AuthProvider>
  );
}
