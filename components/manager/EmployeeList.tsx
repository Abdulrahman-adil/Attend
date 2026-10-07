import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import { API_URL } from '../../src/config';

interface EmployeeItem extends User {
  status?: 'active' | 'pending' | 'archived';
  invitationExpiresAt?: string | null;
}

const EmployeeList: React.FC = () => {
  const [employees, setEmployees] = useState<EmployeeItem[]>([]);
  const { apiFetch } = useAuth();
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(true);
  const [resendingId, setResendingId] = useState<number | null>(null);

  const fetchEmployees = useCallback(async () => {
    setError('');
    setLoading(true);
    try {
      const response = await apiFetch(`${API_URL}/employees`);
      if (!response.ok) throw new Error('Failed to fetch employees');
      const data = await response.json();
      setEmployees(data.items || []);
    } catch (err: any) {
      setError(err.message || 'Failed to load employees');
    } finally {
      setLoading(false);
    }
  }, [apiFetch]);

  useEffect(() => {
    fetchEmployees();
    const handleDataChange = (event: Event) => {
      const customEvent = event as CustomEvent;
      if (customEvent.detail === 'employees') {
        fetchEmployees();
      }
    };
    window.addEventListener('dataChanged', handleDataChange);
    return () => {
      window.removeEventListener('dataChanged', handleDataChange);
    };
  }, [fetchEmployees]);

  const handleResend = async (employeeId: number) => {
    setResendingId(employeeId);
    try {
      const response = await apiFetch(`${API_URL}/employees/${employeeId}/resend`, {
        method: 'POST',
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.message || 'Resend failed');
      await fetchEmployees();
    } catch (err: any) {
      setError(err.message || 'Resend invitation failed');
    } finally {
      setResendingId(null);
    }
  };

  const getStatusLabel = (employee: EmployeeItem) => {
    if (employee.status === 'archived') return 'Archived';
    if (employee.status === 'active') return 'Active';
    return 'Pending Invitation';
  };

  const getStatusClass = (status: string) => {
    switch (status) {
      case 'active':
        return 'bg-emerald-100 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
      case 'pending':
        return 'bg-amber-100 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
      case 'archived':
        return 'bg-slate-100 text-slate-500 dark:bg-slate-900/40 dark:text-slate-400';
      default:
        return 'bg-slate-100 text-slate-600 dark:bg-slate-900/40 dark:text-slate-300';
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-xl shadow-lg border border-slate-200 dark:border-slate-700">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-2xl font-bold text-slate-800 dark:text-white tracking-tight">
          Employee Roster
        </h3>
        <span className="text-sm text-slate-500 dark:text-slate-400 font-medium">
          {employees.length} {employees.length === 1 ? 'employee' : 'employees'}
        </span>
      </div>

      {loading && (
        <div className="py-12 text-center">
          <div className="inline-flex items-center gap-2 text-slate-500 dark:text-slate-400">
            <span className="w-4 h-4 border-2 border-indigo-500 border-t-transparent rounded-full animate-spin" />
            Loading employees...
          </div>
        </div>
      )}

      {!loading && error && (
        <div className="mb-4 p-4 bg-red-50 dark:bg-red-900/20 border border-red-200 dark:border-red-800 rounded-lg">
          <p className="text-red-700 dark:text-red-300 font-medium">{error}</p>
        </div>
      )}

      {!loading && !error && employees.length === 0 && (
        <div className="py-12 text-center border-2 border-dashed border-slate-200 dark:border-slate-700 rounded-xl">
          <div className="w-16 h-16 mx-auto mb-4 bg-slate-100 dark:bg-slate-700 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-slate-400" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth="2" d="M17 20h5v-2a3 3 0 00-5.356-1.857M17 20H7m10 0v-2c0-.656-.126-1.283-.356-1.857m0 0a5.002 5.002 0 019.708-1.857M6 9a3 3 0 01-5.356-1.857M6 9v2m0 0v2m0-2h10m0 0v2m-6.5-5.5v5.5m0 0v5.5m0-5.5h10m0 0v5.5" /></svg>
          </div>
          <h4 className="text-lg font-semibold text-slate-700 dark:text-slate-200 mb-1">No employees yet</h4>
          <p className="text-slate-500 dark:text-slate-400">Invite your first employee to get started.</p>
        </div>
      )}

      {!loading && employees.length > 0 && (
        <div className="overflow-x-auto rounded-lg border border-slate-200 dark:border-slate-700">
          <table className="w-full text-left text-sm">
            <thead className="bg-slate-50 dark:bg-slate-900/60 text-slate-600 dark:text-slate-400 uppercase text-xs tracking-wider font-bold">
              <tr>
                <th className="py-3 px-4">Name</th>
                <th className="py-3 px-4">Email</th>
                <th className="py-3 px-4">Status</th>
                <th className="py-3 px-4">Invitation</th>
                <th className="py-3 px-4">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-200 dark:divide-slate-700">
              {employees.map((employee) => (
                <tr key={employee.id} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
                  <td className="py-3 px-4 font-medium text-slate-800 dark:text-slate-100">{employee.name}</td>
                  <td className="py-3 px-4 text-slate-600 dark:text-slate-300">{employee.email}</td>
                  <td className="py-3 px-4">
                    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${getStatusClass(employee.status || 'pending')}`}>
                      {getStatusLabel(employee)}
                    </span>
                  </td>
                  <td className="py-3 px-4 text-xs text-slate-500 dark:text-slate-400">
                    {employee.status === 'pending' && employee.invitationExpiresAt ? (
                      <span>Expires: {new Date(employee.invitationExpiresAt).toLocaleString()}</span>
                    ) : employee.status === 'pending' ? (
                      <span className="text-amber-600 dark:text-amber-400">Awaiting activation</span>
                    ) : (
                      <span className="text-slate-400">—</span>
                    )}
                  </td>
                  <td className="py-3 px-4">
                    {employee.status === 'pending' && (
                      <button
                        onClick={() => handleResend(employee.id)}
                        disabled={resendingId === employee.id}
                        className="text-xs font-semibold text-indigo-600 dark:text-indigo-400 hover:text-indigo-700 dark:hover:text-indigo-300 disabled:opacity-50 disabled:cursor-not-allowed px-2 py-1 rounded hover:bg-indigo-50 dark:hover:bg-indigo-900/20 transition-colors"
                      >
                        {resendingId === employee.id ? 'Sending…' : 'Resend'}
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
};

export default EmployeeList;
