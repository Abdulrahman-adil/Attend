import React from 'react';
import { HashRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import LoginPage from './pages/LoginPage';
import RegisterPage from './pages/RegisterPage';
import RoleSelectionPage from './pages/RoleSelectionPage';
import DashboardPage from './pages/DashboardPage';
import ProtectedRoute from './components/shared/ProtectedRoute';
import ActivationPage from './pages/ActivationPage';
import AuthCallbackPage from './pages/AuthCallbackPage';

const AppRoutes: React.FC = () => {
  const { currentUser, token } = useAuth();

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route path="/register" element={<RegisterPage />} />
      <Route path="/activate/:token" element={<ActivationPage />} />
      <Route path="/auth/callback" element={<AuthCallbackPage />} />
      
      <Route 
        path="/" 
        element={
          token && currentUser ? <Navigate to="/dashboard" replace /> : <Navigate to="/login" replace />
        } 
      />

      <Route 
        path="/dashboard" 
        element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} 
      />
      <Route 
        path="/select-role" 
        element={<ProtectedRoute><RoleSelectionPage /></ProtectedRoute>} 
      />
      
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  );
};

const App: React.FC = () => {
  return (
    <Router>
      <AuthProvider>
        <AppRoutes />
      </AuthProvider>
    </Router>
  );
};

export default App;
