import { lazy, Suspense } from 'react';
import { Navigate, Outlet, Routes, Route, useLocation } from 'react-router-dom';
import { useAuth } from './contexts/auth-api';
import { loginDestination } from './contexts/auth-session';
import { SerialProvider } from './contexts/SerialContext';
import { TelemetryProvider } from './contexts/TelemetryContext';
import TelemetryControls from './components/groundstation/TelemetryControls';
import Header from './components/layout/Header';
import LoadingScreen from './components/common/LoadingScreen';
import NotFoundPage from './pages/NotFoundPage';

const HomePage = lazy(() => import('./pages/HomePage'));
const LoginPage = lazy(() => import('./pages/LoginPage'));
const SignUpPage = lazy(() => import('./pages/SignUpPage'));
const ProfilePage = lazy(() => import('./pages/ProfilePage'));
const labComponents = [0, 1, 2, 3, 4, 5, 6, 7, 8].map((i) => lazy(() => import(`./pages/Lab${i}.jsx`)));

const AUTH_ROUTES = ['/login', '/signup'];
const APP_ROUTES = ['/', '/profile', ...Array.from({ length: 9 }, (_, index) => `/lab${index}`)];

function AuthPage({ children }) {
  const { loading, isAuthenticated } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  return isAuthenticated ? <Navigate to={loginDestination(location.state?.from)} replace /> : children;
}

function ProtectedServices() {
  const { loading, user } = useAuth();
  const location = useLocation();
  if (loading) return <LoadingScreen />;
  if (!user) return <Navigate to="/login" replace state={{ from: `${location.pathname}${location.search}${location.hash}` }} />;
  return <SerialProvider key={user.id}><TelemetryProvider><ServiceLayout /></TelemetryProvider></SerialProvider>;
}

function ServiceLayout() {
  const location = useLocation();
  const normalizedPath = location.pathname.length > 1 ? location.pathname.replace(/\/+$/, '') : location.pathname;
  const isAuthRoute = AUTH_ROUTES.includes(normalizedPath);
  const isNotFoundRoute = !isAuthRoute && !APP_ROUTES.includes(normalizedPath);
  const isLabRoute = /^\/lab[0-8]$/.test(normalizedPath);

  return (
    <>
      <Suspense fallback={<LoadingScreen />}>
        <div className="app-container">
          {!isAuthRoute && !isNotFoundRoute && <a className="skip-link" href="#main-content">Bỏ qua đến nội dung chính</a>}
          {!isAuthRoute && !isNotFoundRoute && <Header />}
          <main id="main-content" className={isAuthRoute || isNotFoundRoute ? '' : `main-content${isLabRoute ? ' is-lab-route' : ''}`}>
            {!isAuthRoute && !isNotFoundRoute && !isLabRoute && <TelemetryControls />}
            <Outlet />
          </main>
        </div>
      </Suspense>
    </>
  );
}

export default function App() {
  return <Suspense fallback={<LoadingScreen />}><Routes>
    <Route path="/login" element={<AuthPage><LoginPage /></AuthPage>} />
    <Route path="/signup" element={<AuthPage><SignUpPage /></AuthPage>} />
    <Route element={<ProtectedServices />}>
      <Route path="/" element={<HomePage />} />
      <Route path="/profile" element={<ProfilePage />} />
      {labComponents.map((Component, index) => <Route key={index} path={`/lab${index}`} element={<Component />} />)}
      <Route path="*" element={<NotFoundPage />} />
    </Route>
  </Routes></Suspense>;
}
