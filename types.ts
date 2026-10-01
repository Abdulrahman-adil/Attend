export enum UserRole {
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

export interface User {
  id: number;
  name: string;
  email: string;
  passwordHash?: string;
  role?: UserRole;
  companyId: number | null;
  google_id?: string;
}

export interface Company {
  id: number;
  name: string;
  ownerId: number;
  logoUrl?: string;
}

export interface WorkLocation {
  id: number;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  companyId: string;
}

export interface AttendanceRecord {
  id: number;
  employeeId: number;
  locationId?: number;
  locationName?: string;
  checkInTime: string;
  checkOutTime?: string;
  checkInLocation: { latitude: number; longitude: number };
  checkOutLocation?: { latitude: number; longitude: number };
}

export interface GeolocationState {
    latitude: number | null;
    longitude: number | null;
    error: string | null;
    loading: boolean;
}
