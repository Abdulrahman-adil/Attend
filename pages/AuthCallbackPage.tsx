import React, { useEffect, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { User } from '../types';

const AuthCallbackPage: React.FC = () => {
  const { handleAuthSuccess } = useAuth();
  const location = useLocation();
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const params = new URLSearchParams(location.search);
    const token = params.get('token');
    const userString = params.get('user');

    if (token && userString) {
      try {
        const user: User = JSON.parse(decodeURIComponent(userString));
        handleAuthSuccess(token, user);
      } catch (e) {
        console.error("Failed to parse user data from URL", e);
        setError("Authentication failed. Invalid user data received.");
      }
    } else {
       setError("Authentication failed. Missing token or user data.");
    }
    
    // In case of error, redirect to login after a delay
    if (error) {
        setTimeout(() => navigate('/login', { replace: true }), 3000);
    }

  }, [location, handleAuthSuccess, navigate, error]);

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        {error ? (
          <>
            <h2 className="text-3xl font-bold text-red-600 dark:text-red-400 mb-4">Authentication Failed</h2>
            <p className="text-slate-600 dark:text-slate-400">{error}</p>
            <p className="text-slate-500 dark:text-slate-400 mt-4">Redirecting to login...</p>
          </>
        ) : (
          <>
            <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-4">Authenticating...</h2>
            <p className="text-slate-600 dark:text-slate-400">Please wait, we're securely logging you in.</p>
          </>
        )}
      </div>
    </div>
  );
};

export default AuthCallbackPage;
