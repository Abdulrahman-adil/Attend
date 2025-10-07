
import { WorkLocation } from '../types';

// Haversine formula to calculate distance between two lat/lon points in meters
export const calculateDistance = (lat1: number, lon1: number, lat2: number, lon2: number): number => {
  const R = 6371e3; // metres
  const φ1 = lat1 * Math.PI / 180;
  const φ2 = lat2 * Math.PI / 180;
  const Δφ = (lat2 - lat1) * Math.PI / 180;
  const Δλ = (lon2 - lon1) * Math.PI / 180;

  const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
            Math.cos(φ1) * Math.cos(φ2) *
            Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
  const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

  return R * c;
};

export const isWithinRange = (
  currentLat: number,
  currentLon: number,
  allowedLocations: WorkLocation[]
): { inRange: boolean; closestLocation?: WorkLocation } => {
  for (const location of allowedLocations) {
    const distance = calculateDistance(currentLat, currentLon, location.latitude, location.longitude);
    if (distance <= location.radius) {
      return { inRange: true, closestLocation: location };
    }
  }
  return { inRange: false };
};
