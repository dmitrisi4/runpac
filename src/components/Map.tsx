import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from 'turf';
import {length} from '@turf/length';
import { LatLngExpression } from 'leaflet';

// Define a type for latitude/longitude tuples for better readability.
type LatLngTuple = [number, number];

// A predefined path for the simulated run. It forms a simple closed loop.
const MOCK_RUN_PATH: LatLngTuple[] = [
  [51.51, -0.10],
  [51.515, -0.09],
  [51.52, -0.08],
  [51.515, -0.07],
  [51.51, -0.06],
  [51.505, -0.07],
  [51.50, -0.08],
  [51.495, -0.09],
];

/**
 * A utility component that automatically changes the map's view (center and zoom)
 * whenever the `center` or `zoom` props change.
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
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [path, setPath] = useState<LatLngTuple[]>([]);
  // State to store the user's current geographical position.
  const [currentPosition, setCurrentPosition] = useState<LatLngTuple | null>(null);
  // State to store the polygons of captured areas. Each area is an array of coordinates.
  const [capturedAreas, setCapturedAreas] = useState<LatLngTuple[][]>([]);
  // State to track the total distance of the current run in kilometers.
  const [distance, setDistance] = useState<number>(0);

  // A ref to hold the ID of the geolocation watcher, so it can be cleared later.
  const watchId = useRef<number | null>(null);
  const simulationIntervalId = useRef<number | null>(null);

  // Effect to calculate the total distance of the run whenever the path updates.
  useEffect(() => {
    if (path.length > 1) {
      const line = turf.lineString(path.map(p => [p[1], p[0]]));
      const lengthVal =  length(line, { units: 'kilometers' });
      setDistance(lengthVal);
    } else {
      setDistance(0);
    }
  }, [path]);

  /**
   * Checks if a given path forms a closed loop and, if so, adds it to the captured areas.
   * @param {LatLngTuple[]} pathToCheck - The path to analyze.
   */
  const checkForTerritoryCapture = (pathToCheck: LatLngTuple[]) => {
    if (pathToCheck.length > 2) {
      const startPointCoords: [number, number] = [pathToCheck[0][1], pathToCheck[0][0]];
      const endPointCoords: [number, number] = [pathToCheck[pathToCheck.length - 1][1], pathToCheck[pathToCheck.length - 1][0]];

      const startPoint = turf.point(startPointCoords);
      const endPoint = turf.point(endPointCoords);
      const distance = turf.distance(startPoint, endPoint, 'meters');

      // If start and end points are close enough, consider it a closed loop.
      // Increased threshold to ensure mock path is captured.
      if (distance < 150) {
        const closedPath: LatLngTuple[] = [...pathToCheck, pathToCheck[0]];
        setCapturedAreas(prevAreas => [...prevAreas, closedPath]);
      }
    }
  };

  /**
   * Starts tracking the user's location via GPS.
   */
  const handleStartTracking = () => {
    setTracking(true);
    setPath([]);
    setCapturedAreas([]); // Clear previous captures

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
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 0 }
    );
  };

  /**
   * Stops the GPS tracking and checks for territory capture.
   */
  const handleStopTracking = () => {
    setTracking(false);
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
    }
    checkForTerritoryCapture(path);
  };

  /**
   * Starts a simulated run using the predefined MOCK_RUN_PATH.
   */
  const handleSimulateRun = () => {
    if (simulationIntervalId.current) {
      clearInterval(simulationIntervalId.current);
    }

    setIsSimulating(true);
    setPath([]);
    setCapturedAreas([]);
    setCurrentPosition(MOCK_RUN_PATH[0]);

    let step = 0;
    simulationIntervalId.current = window.setInterval(() => {
      if (step >= MOCK_RUN_PATH.length) {
        if (simulationIntervalId.current) clearInterval(simulationIntervalId.current);
        setIsSimulating(false);
        checkForTerritoryCapture(MOCK_RUN_PATH);
        return;
      }

      const point = MOCK_RUN_PATH[step];
      setCurrentPosition(point);
      setPath(prevPath => [...prevPath, point]);
      step++;
    }, 500); // 500ms delay between steps
  };

  const initialPosition: LatLngTuple = [51.505, -0.09];

  return (
    <div>
      <div style={{ position: 'absolute', top: 10, left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'white', padding: '10px', borderRadius: '5px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        <div style={{ padding: '5px', border: '1px solid #ccc', borderRadius: '5px' }}>
          Distance: {distance.toFixed(2)} km
        </div>
        {!tracking && !isSimulating && (
          <button onClick={handleStartTracking}>Start Run</button>
        )}
        {tracking && (
          <button onClick={handleStopTracking}>Stop Run</button>
        )}
        <button onClick={handleSimulateRun} disabled={tracking || isSimulating}>
          Simulate Run
        </button>
      </div>
      <MapContainer center={initialPosition} zoom={13} style={{ height: '100vh', width: '100%' }}>
        {currentPosition && <ChangeView center={currentPosition} zoom={14} />}
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        />
        {currentPosition && (
          <Marker position={currentPosition}>
            <Popup>Current Position</Popup>
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
