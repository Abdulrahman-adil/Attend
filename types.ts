export enum UserRole {
  MANAGER = 'manager',
  EMPLOYEE = 'employee',
}

export interface User {
  id: string;
  name: string;
  email: string;
  passwordHash?: string;
  role?: UserRole;
  companyId: string;
  google_id?: string;
}

export interface Company {
  id: string;
  name: string;
  ownerId: string;
  logoUrl?: string;
}

export interface WorkLocation {
  id: string;
  name: string;
  latitude: number;
  longitude: number;
  radius: number; // in meters
  companyId: string;
}

export interface AttendanceRecord {
  id: string;
  employeeId: string;
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
