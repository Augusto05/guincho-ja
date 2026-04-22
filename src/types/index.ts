export type UserRole = 'customer' | 'driver';

export interface UserProfile {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  avatar?: string;
  rating?: number;
  createdAt: string;
}

export type RequestStatus = 'pending' | 'accepted' | 'in_progress' | 'completed' | 'cancelled';

export interface Location {
  lat: number;
  lng: number;
  address: string;
}

export interface TowRequest {
  id: string;
  customerId: string;
  customerName: string;
  driverId?: string;
  status: RequestStatus;
  price: number;
  origin: Location;
  destination: Location;
  vehicleDetails: string;
  driverLocation?: { lat: number; lng: number };
  securityCode?: string;
  createdAt: any;
  updatedAt: any;
}

export interface DriverStatus {
  id: string;
  isOnline: boolean;
  lat: number;
  lng: number;
  lastActive: any;
}
