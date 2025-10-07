import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';

const RoleSelectionPage: React.FC = () => {
  const { currentUser, updateUserRole } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const handleRoleSelect = async (role: UserRole) => {
    if (!currentUser) return;
    setLoading(true);
    setError('');
    try {
      const result = await updateUserRole(role);
      if (result.success) {
        navigate('/dashboard', { replace: true });
      } else {
        setError(result.message);
      }
    } catch (err: any) {
      setError("There was an error setting your role. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen flex items-center justify-center bg-slate-100 dark:bg-slate-900 p-4">
      <div className="w-full max-w-md bg-white dark:bg-slate-800 rounded-xl shadow-lg p-8 text-center">
        <h2 className="text-3xl font-bold text-slate-800 dark:text-white mb-2">Choose Your Role</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-8">How will you be using Geo-Attendance Pro?</p>
        {error && <p className="bg-red-100 text-red-700 p-3 rounded-lg mb-4 text-center">{error}</p>}
        <div className="space-y-4">
          <button
            onClick={() => handleRoleSelect(UserRole.MANAGER)}
            disabled={loading}
            className="w-full text-lg bg-indigo-600 text-white py-4 rounded-lg hover:bg-indigo-700 transition duration-300 disabled:bg-indigo-400"
          >
            I'm a Company Owner
          </button>
          <button
            onClick={() => handleRoleSelect(UserRole.EMPLOYEE)}
            disabled={loading}
            className="w-full text-lg bg-teal-500 text-white py-4 rounded-lg hover:bg-teal-600 transition duration-300 disabled:bg-teal-300"
          >
            I'm an Employee
          </button>
        </div>
        {loading && <p className="mt-4 text-slate-500 dark:text-slate-400">Setting up your account...</p>}
      </div>
    </div>
  );
};

export default RoleSelectionPage;
