import React, { useState, useEffect } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { User, AttendanceRecord } from '../../types';
import { API_URL } from '../../src/config';

const AttendanceViewer: React.FC = () => {
  const [employees, setEmployees] = useState<User[]>([]);
  const [selectedEmployeeId, setSelectedEmployeeId] = useState<string>('');
  const [attendance, setAttendance] = useState<AttendanceRecord[]>([]);
  const { token } = useAuth();

  useEffect(() => {
    const fetchEmployees = async () => {
        if (token) {
            const response = await fetch(`${API_URL}/employees`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setEmployees(data);
            if (data.length > 0) {
                setSelectedEmployeeId(data[0].id);
            }
        }
    };
    fetchEmployees();
  }, [token]);

  useEffect(() => {
    const fetchAttendance = async () => {
        if (selectedEmployeeId && token) {
            const response = await fetch(`${API_URL}/attendance/${selectedEmployeeId}`, {
                headers: { 'Authorization': `Bearer ${token}` }
            });
            const data = await response.json();
            setAttendance(data);
        } else {
            setAttendance([]);
        }
    };
    fetchAttendance();
  }, [selectedEmployeeId, token]);

  const formatTime = (isoString?: string) => {
    if (!isoString) return 'N/A';
    return new Date(isoString).toLocaleTimeString();
  };

  const formatDate = (isoString: string) => {
      return new Date(isoString).toLocaleDateString();
  }

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
      <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">View Attendance</h3>
      <div className="mb-4">
        <label htmlFor="employee-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300">Select Employee</label>
        <select
          id="employee-select"
          value={selectedEmployeeId}
          onChange={(e) => setSelectedEmployeeId(e.target.value)}
          className="mt-1 block w-full pl-3 pr-10 py-2 text-base border-slate-300 dark:border-slate-600 focus:outline-none focus:ring-indigo-500 focus:border-indigo-500 sm:text-sm rounded-md bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white"
        >
          {employees.map(emp => (
            <option key={emp.id} value={emp.id}>{emp.name}</option>
          ))}
        </select>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-left">
          <thead className="border-b border-slate-300 dark:border-slate-700">
            <tr>
              <th className="py-2 px-4 text-slate-600 dark:text-slate-400 font-semibold">Date</th>
              <th className="py-2 px-4 text-slate-600 dark:text-slate-400 font-semibold">Check-In</th>
              <th className="py-2 px-4 text-slate-600 dark:text-slate-400 font-semibold">Check-Out</th>
              <th className="py-2 px-4 text-slate-600 dark:text-slate-400 font-semibold">Location</th>
            </tr>
          </thead>
          <tbody>
            {attendance.length > 0 ? (
              attendance.map((record) => (
                <tr key={record.id} className="border-b border-slate-200 dark:border-slate-700">
                  <td className="py-3 px-4">{formatDate(record.checkInTime)}</td>
                  <td className="py-3 px-4">{formatTime(record.checkInTime)}</td>
                  <td className="py-3 px-4">{formatTime(record.checkOutTime)}</td>
                  <td className="py-3 px-4">{record.locationName || 'N/A'}</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={4} className="text-center py-4 text-slate-500 dark:text-slate-400">
                  No attendance records found for this employee.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
};

export default AttendanceViewer;
