import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from '@turf/turf';
import { LatLngExpression } from 'leaflet';

// Define a type for latitude/longitude tuples for better readability.
type LatLngTuple = [number, number];

/**
 * A utility component that automatically changes the map's view (center and zoom)
 * whenever the `center` or `zoom` props change.
 * @param {object} props - The component props.
 * @param {LatLngExpression | null} props.center - The new center for the map.
 * @param {number} props.zoom - The new zoom level for the map.
 * @returns {null} This component does not render anything.
 */
const ChangeView: React.FC<{ center: LatLngExpression | null; zoom: number }> = ({ center, zoom }) => {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom);
    }
  }, [center, zoom, map]);
  return null;
};

/**
 * The main Map component that handles all the run tracking and territory capture logic.
 * @returns {React.ReactElement} The Map component.
 */
const Map: React.FC = () => {
  // State to track if the user is currently recording a run.
  const [tracking, setTracking] = useState<boolean>(false);
  // State to store the coordinates of the current run's path.
  const [path, setPath] = useState<LatLngTuple[]>([]);
  // State to store the user's current geographical position.
  const [currentPosition, setCurrentPosition] = useState<LatLngTuple | null>(null);
  // State to store the polygons of captured areas. Each area is an array of coordinates.
  const [capturedAreas, setCapturedAreas] = useState<LatLngTuple[][]>([]);

  // A ref to hold the ID of the geolocation watcher, so it can be cleared later.
  const watchId = useRef<number | null>(null);

  /**
   * Starts tracking the user's location.
   * It clears any previous path and sets up a geolocation watcher.
   */
  const handleStartTracking = () => {
    setTracking(true);
    setPath([]); // Clear previous path

    if (!navigator.geolocation) {
      alert("Geolocation is not supported by your browser");
      setTracking(false);
      return;
    }

    watchId.current = navigator.geolocation.watchPosition(
      (position: GeolocationPosition) => {
        const { latitude, longitude } = position.coords;
        const newPosition: LatLngTuple = [latitude, longitude];
        setCurrentPosition(newPosition);
        setPath((prevPath) => [...prevPath, newPosition]);
      },
      (error: GeolocationPositionError) => {
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

  /**
   * Stops tracking the user's location and checks if a territory was captured.
   */
  const handleStopTracking = () => {
    setTracking(false);
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }

    // Territory capture logic: check if the path forms a closed loop.
    if (path.length > 2) {
      // Turf.js expects coordinates in [longitude, latitude] format for its points.
      const startPointCoords: [number, number] = [path[0][1], path[0][0]];
      const endPointCoords: [number, number] = [path[path.length - 1][1], path[path.length - 1][0]];

      const startPoint = turf.point(startPointCoords);
      const endPoint = turf.point(endPointCoords);
      const distance = turf.distance(startPoint, endPoint, { units: 'meters' });

      // If the start and end points are within a 50-meter threshold, consider it a closed loop.
      if (distance < 50) {
        // Create a closed loop by adding the first point to the end of the path.
        const closedPath: LatLngTuple[] = [...path, path[0]];

        // Add the new captured area to the state.
        // The react-leaflet Polygon component expects [latitude, longitude], which is our format.
        setCapturedAreas(prevAreas => [...prevAreas, closedPath]);
      }
    }
  };

  // Default position for the map if the user's location is not yet available.
  const initialPosition: LatLngTuple = [51.505, -0.09];

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
        {currentPosition && <ChangeView center={currentPosition} zoom={16} />}
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
