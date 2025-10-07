import React, { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../../contexts/AuthContext';
import { WorkLocation } from '../../types';
import { API_URL } from '../../src/config';

const LocationManager: React.FC = () => {
  const [locations, setLocations] = useState<WorkLocation[]>([]);
  const [name, setName] = useState('');
  const [latitude, setLatitude] = useState('');
  const [longitude, setLongitude] = useState('');
  const [radius, setRadius] = useState('100');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const { token } = useAuth();
  
  const fetchLocations = useCallback(async () => {
    if (token) {
      const response = await fetch(`${API_URL}/locations`, {
        headers: { 'Authorization': `Bearer ${token}` }
      });
      const data = await response.json();
      setLocations(data);
    }
  }, [token]);
  
  useEffect(() => {
    fetchLocations();
  }, [fetchLocations]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (token) {
      setIsSubmitting(true);
      try {
        await fetch(`${API_URL}/locations`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${token}`
          },
          body: JSON.stringify({ name, latitude: parseFloat(latitude), longitude: parseFloat(longitude), radius: parseInt(radius) })
        });
        setName('');
        setLatitude('');
        setLongitude('');
        setRadius('100');
        fetchLocations();
      } catch (error) {
        console.error("Failed to add location", error);
      } finally {
        setIsSubmitting(false);
      }
    }
  };

  const handleDelete = async (locationId: string) => {
    if (window.confirm("Are you sure you want to delete this location?")) {
      if(token) {
        setDeletingId(locationId);
        try {
          await fetch(`${API_URL}/locations/${locationId}`, {
            method: 'DELETE',
            headers: { 'Authorization': `Bearer ${token}` }
          });
          fetchLocations();
        } catch (error) {
          console.error("Failed to delete location", error);
        } finally {
          setDeletingId(null);
        }
      }
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">Add Work Location</h3>
        <form onSubmit={handleSubmit}>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <input type="text" placeholder="Location Name (e.g., Main Office)" value={name} onChange={e => setName(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="number" placeholder="Radius (meters)" value={radius} onChange={e => setRadius(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="number" step="any" placeholder="Latitude" value={latitude} onChange={e => setLatitude(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
            <input type="number" step="any" placeholder="Longitude" value={longitude} onChange={e => setLongitude(e.target.value)} required className="w-full px-4 py-2 border border-slate-300 dark:border-slate-600 rounded-lg bg-slate-50 dark:bg-slate-700 text-slate-900 dark:text-white focus:outline-none focus:ring-2 focus:ring-indigo-500" />
          </div>
          <button type="submit" disabled={isSubmitting} className="w-full mt-4 bg-indigo-600 text-white py-2 rounded-lg hover:bg-indigo-700 transition duration-300 disabled:bg-indigo-400">
            {isSubmitting ? 'Adding...' : 'Add Location'}
          </button>
        </form>
      </div>
      <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
        <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">Allowed Locations</h3>
        <ul className="space-y-3">
          {locations.length > 0 ? locations.map(loc => (
            <li key={loc.id} className="flex justify-between items-center p-3 bg-slate-100 dark:bg-slate-700 rounded-md">
              <div>
                <p className="font-semibold">{loc.name}</p>
                <p className="text-sm text-slate-500 dark:text-slate-400">Radius: {loc.radius}m</p>
              </div>
              <button 
                onClick={() => handleDelete(loc.id)} 
                disabled={deletingId === loc.id}
                className="text-red-500 hover:text-red-700 disabled:text-slate-400 disabled:cursor-not-allowed"
              >
                {deletingId === loc.id ? 'Deleting...' : 'Delete'}
              </button>
            </li>
          )) : <p className="text-slate-500 dark:text-slate-400">No locations defined.</p>}
        </ul>
      </div>
    </div>
  );
};

export default LocationManager;