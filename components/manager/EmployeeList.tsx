import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User } from '../../types';
import { API_URL } from '../../src/config';

const EmployeeList: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const { token } = useAuth();
  const [error, setError] = useState('');

  const fetchEmployees = useCallback(async () => {
    if (token) {
        setError('');
      try {
        const response = await fetch(`${API_URL}/employees`, {
            headers: { 'Authorization': `Bearer ${token}` }
        });
        if (!response.ok) throw new Error('Failed to fetch employees');
        const data = await response.json();
        setEmployees(data);
      } catch (err: any) {
        setError(err.message);
      }
    }
  }, [token]);
  
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

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">Employee Roster</h3>
      {error && <p className="text-red-500 text-center">{error}</p>}
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-300 dark:border-slate-700">
            <tr>
              <th className="py-2 px-4 text-slate-600 dark:text-slate-400 font-semibold">Name</th>
              <th className="py-2 px-4 text-slate-600 dark:text-slate-400 font-semibold">Email</th>
            </tr>
          </thead>
          <tbody>
            {employees.length > 0 ? (
              employees.map((employee) => (
                <tr key={employee.id} className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-3 px-4">{employee.name}</td>
                  <td className="py-3 px-4">{employee.email}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={2} className="text-center py-4 text-slate-500 dark:text-slate-400">
                  No employees added yet.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default EmployeeList;
