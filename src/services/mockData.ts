import { TowRequest, UserProfile, DriverStatus } from '../types';

export const MOCK_DRIVERS: DriverStatus[] = [
  { id: 'd1', isOnline: true, lat: -23.55052, lng: -46.633308, lastActive: new Date() },
  { id: 'd2', isOnline: true, lat: -23.55552, lng: -46.643308, lastActive: new Date() },
  { id: 'd3', isOnline: true, lat: -23.54552, lng: -46.623308, lastActive: new Date() },
];

export const MOCK_REQUESTS: TowRequest[] = [
  {
    id: 'r1',
    customerId: 'u1',
    customerName: 'João Silva',
    status: 'pending',
    price: 150.00,
    origin: { lat: -23.56052, lng: -46.653308, address: 'Av. Paulista, 1000' },
    destination: { lat: -23.58052, lng: -46.673308, address: 'Rua das Oliveiras, 500' },
    vehicleDetails: 'Fiat Uno Branco - AAA-1234',
    createdAt: new Date(),
    updatedAt: new Date()
  }
];

export const MOCK_DESTINATIONS = [
  { id: 'dest1', name: 'Concessionária Toyota Autostar', lat: -23.585, lng: -46.685, address: 'Av. Europa, 1200' },
  { id: 'dest2', name: 'Oficina Especializada Bosch', lat: -23.542, lng: -46.638, address: 'Rua da Consolação, 2500' },
  { id: 'dest3', name: 'Mecânica 24h Silva', lat: -23.568, lng: -46.662, address: 'Alameda Santos, 900' },
  { id: 'dest4', name: 'Pneus e Rodas Michelin', lat: -23.575, lng: -46.692, address: 'Av. Brigadeiro Faria Lima, 3400' },
];

export const MOCK_USER: UserProfile = {
  id: 'u1',
  name: 'João Silva',
  email: 'joao@example.com',
  role: 'customer',
  rating: 4.8,
  createdAt: new Date().toISOString()
};
