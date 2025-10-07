import React, { useState } from 'react';
import AddEmployee from './AddEmployee';
import EmployeeList from './EmployeeList';
import LocationManager from './LocationManager';
import AttendanceViewer from './AttendanceViewer';

const ManagerDashboard: React.FC = () => {
  const [activeTab, setActiveTab] = useState('employees');

  const tabs = [
    { id: 'employees', label: 'Manage Employees' },
    { id: 'locations', label: 'Manage Locations' },
    { id: 'attendance', label: 'View Attendance' },
  ];

  const renderContent = () => {
    switch (activeTab) {
      case 'employees':
        return (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2">
              <EmployeeList />
            </div>
            <div>
              <AddEmployee />
            </div>
          </div>
        );
      case 'locations':
        return <LocationManager />;
      case 'attendance':
        return <AttendanceViewer />;
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <h2 className="text-3xl font-bold text-slate-800 dark:text-white">Manager Dashboard</h2>
      <div className="border-b border-slate-300 dark:border-slate-700">
        <nav className="-mb-px flex space-x-6 overflow-x-auto" aria-label="Tabs">
          {tabs.map((tab) => (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`${
                activeTab === tab.id
                  ? 'border-indigo-500 text-indigo-600 dark:border-indigo-400 dark:text-indigo-400'
                  : 'border-transparent text-slate-500 hover:text-slate-700 hover:border-slate-300 dark:text-slate-400 dark:hover:text-slate-200 dark:hover:border-slate-600'
              } whitespace-nowrap py-4 px-1 border-b-2 font-medium text-sm`}
            >
              {tab.label}
            </button>
          ))}
        </nav>
      </div>
      <div>
        {renderContent()}
      </div>
    </div>
  );
};

export default ManagerDashboard;