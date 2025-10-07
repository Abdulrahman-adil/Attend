import React, { useState, useEffect } from 'react';
import type { GeolocationState, WorkLocation, AttendanceRecord } from '../../types';
import { useAuth } from '../../contexts/AuthContext';
import { API_URL } from '../../src/config';

interface ClockInOutProps {
  currentLocation: GeolocationState;
  allowedLocations: WorkLocation[];
  latestAttendance: AttendanceRecord | null;
}

const ClockInOut: React.FC<ClockInOutProps> = ({ currentLocation, allowedLocations, latestAttendance }) => {
  const [isCheckedIn, setIsCheckedIn] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);
  const [selectedLocationId, setSelectedLocationId] = useState<string>('');
  const [loading, setLoading] = useState(false);
  const { token } = useAuth();

  useEffect(() => {
    if (latestAttendance && !latestAttendance.checkOutTime) {
      setIsCheckedIn(true);
      // Pre-select the location if the user is already checked in
      if(latestAttendance.locationId) {
        setSelectedLocationId(latestAttendance.locationId.toString());
      }
    } else {
      setIsCheckedIn(false);
      setSelectedLocationId('');
    }
  }, [latestAttendance]);

  const handleAction = async () => {
    setMessage(null);
    setLoading(true);

    if (!isCheckedIn && !selectedLocationId) {
      setMessage({ type: 'error', text: 'Please select a work location before checking in.' });
      setLoading(false);
      return;
    }
    
    const { latitude, longitude, error: locationError } = currentLocation;
    if (locationError || !latitude || !longitude) {
      setMessage({ type: 'error', text: `Could not get location: ${locationError || 'Unknown error'}` });
      setLoading(false);
      return;
    }
    
    if (!token) {
        setMessage({ type: 'error', text: 'Authentication error. Please log in again.' });
        setLoading(false);
        return;
    }

    try {
        const response = await fetch(`${API_URL}/attendance/clock`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${token}`},
            body: JSON.stringify({ latitude, longitude, locationId: parseInt(selectedLocationId, 10) })
        });

      let data;
      try
      {
        data = await response.json();
      } catch {
        data = {};
      }

        if (!response.ok) throw new Error(data.message || 'Action failed.');
        setMessage({ type: 'success', text: data.message });
        window.dispatchEvent(new CustomEvent('dataChanged', { detail: 'attendance' }));
    } catch (e: any) {
      setMessage({ type: 'error', text: e.message });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md flex flex-col justify-center items-center space-y-4">
      <h3 className="text-xl font-semibold text-slate-800 dark:text-white">Attendance</h3>
      
      {!isCheckedIn && (
        <div className="w-full">
            <label htmlFor="location-select" className="block text-sm font-medium text-slate-700 dark:text-slate-300 mb-1">Select Location</label>
            <select
                id="location-select"
                value={selectedLocationId}
                onChange={(e) => setSelectedLocationId(e.target.value)}
                className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
                <option value="" disabled>-- Choose a location --</option>
                {allowedLocations.map(loc => (
                    <option key={loc.id} value={loc.id}>{loc.name}</option>
                ))}
            </select>
        </div>
      )}

      <div className="flex space-x-4">
        <button
          onClick={handleAction}
          disabled={isCheckedIn || loading || (!isCheckedIn && !selectedLocationId)}
          className="px-8 py-4 text-lg font-bold text-white bg-green-500 rounded-lg shadow-md hover:bg-green-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
        >
          {loading && !isCheckedIn ? 'Checking In...' : 'Check-In'}
        </button>
        <button
          onClick={handleAction}
          disabled={!isCheckedIn || loading}
          className="px-8 py-4 text-lg font-bold text-white bg-red-500 rounded-lg shadow-md hover:bg-red-600 disabled:bg-slate-400 disabled:cursor-not-allowed transition"
        >
          {loading && isCheckedIn ? 'Checking Out...' : 'Check-Out'}
        </button>
      </div>
      {message && (
        <p className={`text-center p-3 rounded-lg w-full ${message.type === 'success' ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
          {message.text}
        </p>
      )}
       <p className="text-sm text-slate-500 dark:text-slate-400">
        Status: {isCheckedIn ? `Checked in at ${new Date(latestAttendance?.checkInTime || '').toLocaleTimeString()}` : 'Checked out'}
      </p>
    </div>
  );
};

export default ClockInOut;
