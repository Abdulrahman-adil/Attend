
import React from 'react';
import { isWithinRange } from '../../services/locationService';
import type { GeolocationState, WorkLocation } from '../../types';

interface LocationStatusProps {
    currentLocation: GeolocationState;
    allowedLocations: WorkLocation[];
}

const LocationStatus: React.FC<LocationStatusProps> = ({ currentLocation, allowedLocations }) => {
    const { latitude, longitude, loading, error } = currentLocation;
    const { inRange, closestLocation } = (latitude && longitude) 
        ? isWithinRange(latitude, longitude, allowedLocations) 
        : { inRange: false, closestLocation: undefined };

    const renderStatus = () => {
        if (loading) {
            return <p className="text-slate-500 dark:text-slate-400">Fetching your location...</p>;
        }
        if (error) {
            return <p className="text-red-500">Error: {error}</p>;
        }
        if (inRange) {
            return (
                <div className="p-3 text-center bg-green-100 text-green-800 dark:bg-green-900/50 dark:text-green-300 rounded-lg">
                    <p className="font-bold">You are within the work location range.</p>
                    <p className="text-sm">Nearest location: {closestLocation?.name}</p>
                </div>
            );
        }
        return (
            <div className="p-3 text-center bg-red-100 text-red-800 dark:bg-red-900/50 dark:text-red-300 rounded-lg">
                <p className="font-bold">You are outside the work location.</p>
                <p className="text-sm">Move closer to an allowed location to check in.</p>
            </div>
        );
    };

    return (
        <div className="bg-white dark:bg-slate-800 p-6 rounded-lg shadow-md">
            <h3 className="text-xl font-semibold mb-4 text-slate-800 dark:text-white">Location Status</h3>
            <div className="space-y-4">
                {renderStatus()}
                <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">Your Current Location:</h4>
                    {latitude && longitude ? (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Lat: {latitude.toFixed(5)}, Lon: {longitude.toFixed(5)}</p>
                    ) : (
                        <p className="text-sm text-slate-500 dark:text-slate-400">Unavailable</p>
                    )}
                </div>
                <div>
                    <h4 className="font-semibold text-slate-700 dark:text-slate-300">Allowed Locations:</h4>
                    <ul className="list-disc list-inside text-sm text-slate-500 dark:text-slate-400">
                        {allowedLocations.length > 0 ? (
                            allowedLocations.map(loc => <li key={loc.id}>{loc.name}</li>)
                        ) : (
                            <li>No locations defined by manager.</li>
                        )}
                    </ul>
                </div>
            </div>
        </div>
    );
}

export default LocationStatus;
