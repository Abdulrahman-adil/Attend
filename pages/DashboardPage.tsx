
import React from 'react';
import { useAuth } from '../contexts/AuthContext';
import { UserRole } from '../types';
import ManagerDashboard from '../components/manager/ManagerDashboard';
import EmployeeDashboard from '../components/employee/EmployeeDashboard';
import Header from '../components/shared/Header';

const DashboardPage: React.FC = () => {
  const { currentUser, logout } = useAuth();

  if (!currentUser) return null;

  return (
    <div className="min-h-screen bg-slate-100 dark:bg-slate-900 text-slate-800 dark:text-slate-200">
      <Header userName={currentUser.name} onLogout={logout} />
      <main className="p-4 sm:p-6 lg:p-8">
        {currentUser.role === UserRole.MANAGER && <ManagerDashboard />}
        {currentUser.role === UserRole.EMPLOYEE && <EmployeeDashboard />}
      </main>
    </div>
  );
};

export default DashboardPage;
