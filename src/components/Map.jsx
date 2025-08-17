import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';

// A component to automatically center the map on the user's position
const ChangeView = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
}

const Map = () => {
  const [tracking, setTracking] = useState(false);
  const [path, setPath] = useState([]);
  const [currentPosition, setCurrentPosition] = useState(null);
  const [capturedAreas, setCapturedAreas] = useState([]);

  const watchId = useRef(null);

  const handleStartTracking = () => {
    setTracking(true);
    setPath([]); // Clear previous path

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setTracking(false);
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        const newPosition = [latitude, longitude];
        setCurrentPosition(newPosition);
        setPath((prevPath) => [...prevPath, newPosition]);
      },
      (error) => {
        console.error("Error getting geolocation", error);
        alert("Error getting location. Make sure you have enabled location services.");
        setTracking(false);
      },
      {
        enableHighAccuracy: true,
        timeout: 10000,
        maximumAge: 0,
      }
    );
  };

  const handleStopTracking = () => {
    setTracking(false);
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    // Territory capture logic
    if (path.length > 2) {
      // Turf expects [lng, lat]
      const startPointCoords = [path[0][1], path[0][0]];
      const endPointCoords = [path[path.length - 1][1], path[path.length - 1][0]];

      const startPoint = turf.point(startPointCoords);
      const endPoint = turf.point(endPointCoords);
      const distance = turf.distance(startPoint, endPoint, { units: 'meters' });

      // If start and end points are close enough, consider it a closed loop
      if (distance < 50) { // 50 meters threshold
        const closedPath = [...path, path[0]]; // Close the loop for the polygon

        // react-leaflet's Polygon expects [lat, lng], which is what our path is in
        setCapturedAreas(prevAreas => [...prevAreas, closedPath]);
      }
    }
  };

  const initialPosition = [51.505, -0.09];

  return (
    <div>
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'white', padding: '10px', borderRadius: '5px', display: 'flex', gap: '10px' }}>
        {!tracking ? (
          <button onClick={handleStartTracking}>Start Run</button>
        ) : (
          <button onClick={handleStopTracking}>Stop Run</button>
        )}
      </div>
      <MapContainer center={initialPosition} zoom={13} style={{ height: '100vh', width: '100%' }}>
        <ChangeView center={currentPosition} zoom={16} />
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {currentPosition && (
          <Marker position={currentPosition}>
            <Popup>You are here</Popup>
          </Marker>
        )}
        <Polyline positions={path} color="blue" />
        {capturedAreas.map((area, index) => (
          <Polygon key={index} positions={area} color="purple" />
        ))}
      </MapContainer>
    </div>
  );
};

export default Map;
