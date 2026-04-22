import React, { useState, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, useMap } from 'react-leaflet';
import * as L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix Leaflet marker icons via prototype options to avoid constructor issues
// We move this inside the component to ensure it's client-side and L is fully loaded
const fixLeafletIcons = () => {
  if (typeof window !== 'undefined' && L.Marker.prototype.options.icon) {
    // @ts-ignore
    delete L.Icon.Default.prototype._getIconUrl;
    L.Icon.Default.mergeOptions({
      iconRetinaUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon-2x.png',
      iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
      shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    });
  }
};

interface MapProps {
  center: { lat: number; lng: number };
  markers?: Array<{
    id: string;
    position: { lat: number; lng: number };
    title: string;
    type: 'driver' | 'user' | 'active-driver';
    price?: number;
  }>;
  origin?: { lat: number; lng: number };
  destination?: { lat: number; lng: number };
}

// Sub-component to handle map view updates and auto-zoom to route
function MapViewHandler({ center, route }: { center: { lat: number; lng: number }, route: [number, number][] }) {
  const map = useMap();
  const [hasFitBounds, setHasFitBounds] = useState(false);
  
  // Reset hasFitBounds when route changes
  useEffect(() => {
    setHasFitBounds(false);
  }, [route.length]);

  useEffect(() => {
    if (route.length > 0 && !hasFitBounds) {
      const bounds = L.latLngBounds(route);
      map.fitBounds(bounds, { padding: [80, 80], maxZoom: 16 });
      setHasFitBounds(true);
    } else if (route.length === 0) {
      map.setView([center.lat, center.lng], 14);
    }
  }, [center, route, map, hasFitBounds]);
  
  return null;
}

export const InteractiveMap: React.FC<MapProps> = ({ center, markers = [], origin, destination }) => {
  const [route, setRoute] = useState<[number, number][]>([]);

  useEffect(() => {
    fixLeafletIcons();
  }, []);

  const icons = React.useMemo(() => ({
    user: L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/684/684908.png',
      iconSize: [32, 32],
      iconAnchor: [16, 32],
    }),
    driver: L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/2555/2555013.png',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    }),
    active: L.icon({
      iconUrl: 'https://cdn-icons-png.flaticon.com/512/3202/3202926.png',
      iconSize: [36, 36],
      iconAnchor: [18, 18],
    })
  }), []);

  // Fetch route from OSRM (Open Source Routing Machine)
  useEffect(() => {
    if (origin && destination && (origin.lat !== destination.lat || origin.lng !== destination.lng)) {
      const fetchRoute = async () => {
        try {
          const response = await fetch(
            `https://router.project-osrm.org/route/v1/driving/${origin.lng},${origin.lat};${destination.lng},${destination.lat}?overview=full&geometries=geojson`
          );
          const data = await response.json();
          if (data.routes && data.routes[0]) {
            const coordinates = data.routes[0].geometry.coordinates.map(
              (coord: [number, number]) => [coord[1], coord[0]]
            );
            setRoute(coordinates);
          }
        } catch (error) {
          console.error("Error fetching OSRM route:", error);
        }
      };
      fetchRoute();
    } else {
      setRoute([]);
    }
  }, [origin?.lat, origin?.lng, destination?.lat, destination?.lng]);

  return (
    <MapContainer 
      center={[center.lat, center.lng]} 
      zoom={14} 
      className="h-full w-full z-0 map-grid"
      zoomControl={false}
    >
      <TileLayer
        attribution='&copy; OpenStreetMap'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        className="map-tiles"
      />
      
      <MapViewHandler center={center} route={route} />

      {markers.map((marker) => (
        <Marker 
          key={marker.id} 
          position={[marker.position.lat, marker.position.lng]}
          icon={marker.type === 'active-driver' ? icons.active : (marker.type === 'driver' ? icons.driver : icons.user)}
          zIndexOffset={marker.type === 'user' ? 1000 : 500}
        >
          <Popup className="minimalist-popup">
            <div className="p-1 text-center">
              <h4 className="font-bold text-slate-900">{marker.title}</h4>
              {marker.price && <p className="text-black font-black">R$ {marker.price.toFixed(2)}</p>}
            </div>
          </Popup>
        </Marker>
      ))}

      {route.length > 0 && (
        <>
          {/* Outer Border for contrast */}
          <Polyline 
            positions={route} 
            pathOptions={{ 
              color: '#ffffff', 
              weight: 12, 
              opacity: 0.4,
              lineCap: 'round',
              lineJoin: 'round'
            }} 
          />
          {/* Main Route Line */}
          <Polyline 
            positions={route} 
            pathOptions={{ 
              color: '#3b82f6', 
              weight: 6, 
              opacity: 0.9,
              lineCap: 'round',
              lineJoin: 'round'
            }} 
          />
        </>
      )}
    </MapContainer>
  );
};
