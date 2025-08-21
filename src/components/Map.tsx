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
	[51.51, -0.10]
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
// Enum for tracking states
enum TrackingState {
  STOPPED = 'stopped',
  RUNNING = 'running',
  PAUSED = 'paused'
}

// Interface for saved run data
interface SavedRun {
  id: string;
  date: string;
  path: LatLngTuple[];
  distance: number;
  duration: number; // in seconds (active time only)
  totalTime: number; // total time including pauses
  pauseCount: number;
  pauseDuration: number; // total pause time in seconds
  capturedAreas: LatLngTuple[][];
}

const Map: React.FC = () => {
  // State to track the current tracking state
  const [trackingState, setTrackingState] = useState<TrackingState>(TrackingState.STOPPED);
  const [isSimulating, setIsSimulating] = useState<boolean>(false);
  const [path, setPath] = useState<LatLngTuple[]>([]);
  // State to store the user's current geographical position.
  const [currentPosition, setCurrentPosition] = useState<LatLngTuple | null>(null);
  // State to store the polygons of captured areas. Each area is an array of coordinates.
  const [capturedAreas, setCapturedAreas] = useState<LatLngTuple[][]>([]);
  // State to track the total distance of the current run in kilometers.
  const [distance, setDistance] = useState<number>(0);
  // State to track the start time of the current run.
  const [startTime, setStartTime] = useState<number | null>(null);
  // Pause-related states
  const [pauseStartTime, setPauseStartTime] = useState<number | null>(null);
  const [totalPauseTime, setTotalPauseTime] = useState<number>(0);
  const [pauseCount, setPauseCount] = useState<number>(0);
  const [currentRunTime, setCurrentRunTime] = useState<number>(0);
  // State to store all saved runs.
  const [savedRuns, setSavedRuns] = useState<SavedRun[]>([]);
  // State to control the visibility of the run history modal.
  const [showHistory, setShowHistory] = useState<boolean>(false);
  
  // Real-time timer effect
  useEffect(() => {
    let interval: NodeJS.Timeout;
    
    if (trackingState === TrackingState.RUNNING && startTime) {
      interval = setInterval(() => {
        const now = Date.now();
        const elapsed = now - startTime - totalPauseTime;
        setCurrentRunTime(elapsed);
      }, 1000);
    }
    
    return () => {
      if (interval) {
        clearInterval(interval);
      }
    };
  }, [trackingState, startTime, totalPauseTime]);
  
  // Computed state for backward compatibility
  const tracking = trackingState === TrackingState.RUNNING;
  const isPaused = trackingState === TrackingState.PAUSED;

  // A ref to hold the ID of the geolocation watcher, so it can be cleared later.
  const watchId = useRef<number | null>(null);
  const simulationIntervalId = useRef<number | null>(null);
  
  // GPS filtering constants (relaxed for better tracking)
  const MIN_ACCURACY = 50; // meters (increased from 20)
  const MAX_SPEED = 25; // m/s (90 km/h, increased from 15)
  const MIN_DISTANCE = 2; // meters between points (decreased from 5)
  
  // Store last GPS point for filtering
  const lastGPSPoint = useRef<{lat: number, lng: number, timestamp: number, accuracy: number} | null>(null);

  // Effect to load saved runs from localStorage on component mount.
  useEffect(() => {
    const loadSavedRuns = () => {
      try {
        const saved = localStorage.getItem('runTracker_savedRuns');
        if (saved) {
          const parsedRuns: SavedRun[] = JSON.parse(saved);
          setSavedRuns(parsedRuns);
        }
      } catch (error) {
        console.error('Error loading saved runs:', error);
      }
    };
    loadSavedRuns();
  }, []);

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
   * Saves a run to localStorage.
   * @param {SavedRun} run - The run data to save.
   */
  const saveRunToLocalStorage = (run: SavedRun) => {
    try {
      const updatedRuns = [...savedRuns, run];
      localStorage.setItem('runTracker_savedRuns', JSON.stringify(updatedRuns));
      setSavedRuns(updatedRuns);
      console.log('Run saved successfully:', run);
    } catch (error) {
      console.error('Error saving run:', error);
      alert('Ошибка при сохранении пробежки');
    }
  };

  /**
   * Formats duration in seconds to MM:SS format.
   * @param {number} seconds - Duration in seconds.
   * @returns {string} Formatted time string.
   */
  const formatDuration = (seconds: number): string => {
    const minutes = Math.floor(seconds / 60);
    const remainingSeconds = seconds % 60;
    return `${minutes}:${remainingSeconds.toString().padStart(2, '0')}`;
  };

  /**
   * Toggles the visibility of the run history modal.
   */
  const toggleHistory = () => {
    setShowHistory(!showHistory);
  };

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
    console.log('Starting GPS tracking...');
    setTrackingState(TrackingState.RUNNING);
    setPath([]);
    setCapturedAreas([]); // Clear previous captures
    setDistance(0);
    setStartTime(Date.now()); // Record start time
    // Reset pause-related states
    setPauseStartTime(null);
    setTotalPauseTime(0);
    setPauseCount(0);
    setCurrentRunTime(0);
    lastGPSPoint.current = null; // Reset GPS filtering

    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      alert("Geolocation is not supported by your browser");
      setTrackingState(TrackingState.STOPPED);
      return;
    }
    
    console.log('Geolocation supported, requesting position...');

    watchId.current = navigator.geolocation.watchPosition(
      (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = Date.now();
        
        console.log(`GPS update: lat=${latitude}, lng=${longitude}, accuracy=${accuracy}m`);
        
        // Filter out inaccurate GPS points
        if (accuracy > MIN_ACCURACY) {
          console.log(`GPS point filtered: accuracy ${accuracy}m > ${MIN_ACCURACY}m`);
          return;
        }
        
        const newGPSPoint = { lat: latitude, lng: longitude, timestamp, accuracy };
        
        // Filter based on distance and speed if we have a previous point
        if (lastGPSPoint.current) {
          const distance = turf.distance(
             turf.point([lastGPSPoint.current.lng, lastGPSPoint.current.lat]),
             turf.point([longitude, latitude]),
             'meters'
           );
          
          // Skip if distance is too small
          if (distance < MIN_DISTANCE) {
            console.log(`GPS point filtered: distance ${distance}m < ${MIN_DISTANCE}m`);
            return;
          }
          
          // Calculate speed and filter anomalous jumps
          const timeDiff = (timestamp - lastGPSPoint.current.timestamp) / 1000; // seconds
          const speed = timeDiff > 0 ? distance / timeDiff : 0; // m/s
          
          if (speed > MAX_SPEED) {
            console.log(`GPS point filtered: speed ${speed}m/s > ${MAX_SPEED}m/s`);
            return;
          }
        }
        
        // Point passed all filters, add it to the path
        console.log(`GPS point accepted: lat=${latitude}, lng=${longitude}`);
        lastGPSPoint.current = newGPSPoint;
        const newPosition: LatLngTuple = [latitude, longitude];
        setCurrentPosition(newPosition);
        setPath((prevPath) => [...prevPath, newPosition]);
      },
      (error: GeolocationPositionError) => {
        console.error("Geolocation error:", error.code, error.message);
        let errorMessage = "Error getting location. ";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Location access denied. Please enable location services.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out.";
            break;
          default:
            errorMessage += "Unknown error occurred.";
            break;
        }
        alert(errorMessage);
        setTrackingState(TrackingState.STOPPED);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );
    
    console.log('GPS watch started with ID:', watchId.current);
  };

  /**
   * Stops the GPS tracking and checks for territory capture.
   */
  const handleStopTracking = () => {
    console.log('Stopping GPS tracking...');
    console.log('Current path length:', path.length);
    console.log('Current distance:', distance);
    console.log('Start time:', startTime);
    
    setTrackingState(TrackingState.STOPPED);
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      console.log('GPS watch cleared');
    }
    lastGPSPoint.current = null; // Reset GPS filtering
    setCurrentRunTime(0);
    checkForTerritoryCapture(path);
    
    // Save run data to localStorage
    if (startTime && path.length > 0) {
      const endTime = Date.now();
      const totalRunTime = Math.floor((endTime - startTime) / 1000); // total time in seconds
      const activeDuration = totalRunTime - totalPauseTime; // active time excluding pauses
      
      const runData: SavedRun = {
        id: `run_${Date.now()}`,
        date: new Date().toISOString(),
        path: [...path],
        distance: distance,
        duration: activeDuration,
        totalTime: totalRunTime,
        pauseCount: pauseCount,
        pauseDuration: totalPauseTime,
        capturedAreas: [...capturedAreas]
      };
      
      console.log('Saving run data:', runData);
      saveRunToLocalStorage(runData);
      alert(`Пробежка сохранена! Расстояние: ${distance.toFixed(2)} км, Время: ${Math.floor(activeDuration / 60)}:${(activeDuration % 60).toString().padStart(2, '0')}`);
    } else {
      console.log('Not saving run - no start time or empty path');
      if (!startTime) console.log('Missing start time');
      if (path.length === 0) console.log('Empty path');
    }
  };

  /**
   * Pauses the GPS tracking.
   */
  const handlePauseTracking = () => {
    console.log('Pausing GPS tracking...');
    setTrackingState(TrackingState.PAUSED);
    setPauseStartTime(Date.now());
    setPauseCount(prev => prev + 1);
    
    // Stop GPS watching during pause
    if (watchId.current) {
      navigator.geolocation.clearWatch(watchId.current);
      watchId.current = null;
      console.log('GPS watch paused');
    }
  };

  /**
   * Resumes the GPS tracking from pause.
   */
  const handleResumeTracking = () => {
    console.log('Resuming GPS tracking...');
    
    // Calculate pause duration and add to total
    if (pauseStartTime) {
      const pauseDuration = Date.now() - pauseStartTime;
      setTotalPauseTime(prev => prev + Math.floor(pauseDuration / 1000));
      setPauseStartTime(null);
    }
    
    setTrackingState(TrackingState.RUNNING);
    
    // Resume GPS watching
    if (!navigator.geolocation) {
      console.error('Geolocation not supported');
      alert("Geolocation is not supported by your browser");
      setTrackingState(TrackingState.STOPPED);
      return;
    }
    
    console.log('Resuming GPS watch...');
    watchId.current = navigator.geolocation.watchPosition(
      (position: GeolocationPosition) => {
        const { latitude, longitude, accuracy } = position.coords;
        const timestamp = Date.now();
        
        console.log(`GPS update (resumed): lat=${latitude}, lng=${longitude}, accuracy=${accuracy}m`);
        
        // Filter out inaccurate GPS points
        if (accuracy > MIN_ACCURACY) {
          console.log(`GPS point filtered: accuracy ${accuracy}m > ${MIN_ACCURACY}m`);
          return;
        }
        
        const newGPSPoint = { lat: latitude, lng: longitude, timestamp, accuracy };
        
        // Filter based on distance and speed if we have a previous point
        if (lastGPSPoint.current) {
          const distance = turf.distance(
             turf.point([lastGPSPoint.current.lng, lastGPSPoint.current.lat]),
             turf.point([longitude, latitude]),
             'meters'
           );
          
          // Skip if distance is too small
          if (distance < MIN_DISTANCE) {
            console.log(`GPS point filtered: distance ${distance}m < ${MIN_DISTANCE}m`);
            return;
          }
          
          // Calculate speed and filter anomalous jumps
          const timeDiff = (timestamp - lastGPSPoint.current.timestamp) / 1000; // seconds
          const speed = timeDiff > 0 ? distance / timeDiff : 0; // m/s
          
          if (speed > MAX_SPEED) {
            console.log(`GPS point filtered: speed ${speed}m/s > ${MAX_SPEED}m/s`);
            return;
          }
        }
        
        // Point passed all filters, add it to the path
        console.log(`GPS point accepted (resumed): lat=${latitude}, lng=${longitude}`);
        lastGPSPoint.current = newGPSPoint;
        const newPosition: LatLngTuple = [latitude, longitude];
        setCurrentPosition(newPosition);
        setPath((prevPath) => [...prevPath, newPosition]);
      },
      (error: GeolocationPositionError) => {
        console.error("Geolocation error (resumed):", error.code, error.message);
        let errorMessage = "Error getting location. ";
        switch(error.code) {
          case error.PERMISSION_DENIED:
            errorMessage += "Location access denied. Please enable location services.";
            break;
          case error.POSITION_UNAVAILABLE:
            errorMessage += "Location information unavailable.";
            break;
          case error.TIMEOUT:
            errorMessage += "Location request timed out.";
            break;
          default:
            errorMessage += "Unknown error occurred.";
            break;
        }
        alert(errorMessage);
        setTrackingState(TrackingState.STOPPED);
      },
      { enableHighAccuracy: true, timeout: 10000, maximumAge: 1000 }
    );
    
    console.log('GPS watch resumed with ID:', watchId.current);
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
    setDistance(0);
    setStartTime(Date.now()); // Record start time for simulation
    setCurrentPosition(MOCK_RUN_PATH[0]);

    let step = 0;
    simulationIntervalId.current = window.setInterval(() => {
      if (step >= MOCK_RUN_PATH.length) {
        if (simulationIntervalId.current) clearInterval(simulationIntervalId.current);
        setIsSimulating(false);
        checkForTerritoryCapture(MOCK_RUN_PATH);
        
        // Save simulated run data to localStorage
        if (startTime) {
          const endTime = Date.now();
          const duration = Math.floor((endTime - startTime) / 1000); // duration in seconds
          
          const runData: SavedRun = {
            id: `simulation_${Date.now()}`,
            date: new Date().toISOString(),
            path: [...MOCK_RUN_PATH],
            distance: distance,
            duration: duration,
            totalTime: duration,
            pauseCount: 0,
            pauseDuration: 0,
            capturedAreas: [...capturedAreas]
          };
          
          saveRunToLocalStorage(runData);
          alert(`Симуляция сохранена! Расстояние: ${distance.toFixed(2)} км, Время: ${Math.floor(duration / 60)}:${(duration % 60).toString().padStart(2, '0')}`);
        }
        return;
      }

      const point = MOCK_RUN_PATH[step];
      setCurrentPosition(point);
      setPath(prevPath => [...prevPath, point]);
      step++;
    }, 500); // 500ms delay between steps
  };

  const initialPosition: LatLngTuple = [51.505, -0.09];

  // Helper function to get status color
  const getStatusColor = () => {
    switch (trackingState) {
      case TrackingState.RUNNING:
        return '#4CAF50'; // Green
      case TrackingState.PAUSED:
        return '#FF9800'; // Orange
      case TrackingState.STOPPED:
      default:
        return '#9E9E9E'; // Gray
    }
  };

  // Helper function to get status text
  const getStatusText = () => {
    switch (trackingState) {
      case TrackingState.RUNNING:
        return 'Запущено';
      case TrackingState.PAUSED:
        return 'Пауза';
      case TrackingState.STOPPED:
      default:
        return 'Остановлено';
    }
  };

  return (
    <div>
      {/* CSS for pulse animation */}
      <style>
        {`
          @keyframes pulse {
            0% {
              opacity: 1;
              transform: scale(1);
            }
            50% {
              opacity: 0.7;
              transform: scale(1.1);
            }
            100% {
              opacity: 1;
              transform: scale(1);
            }
          }
        `}
      </style>
      <div style={{ position: 'absolute', bottom: '20%', left: '50%', transform: 'translateX(-50%)', zIndex: 1000, background: 'white', padding: '10px', borderRadius: '5px', gap: '10px', alignItems: 'center' }}>
        {/* Status Indicator */}
        <div style={{ 
          padding: '8px 12px', 
          border: `2px solid ${getStatusColor()}`, 
          borderRadius: '5px', 
          color: 'black',
          backgroundColor: trackingState === TrackingState.PAUSED ? '#FFF3E0' : 'white',
          display: 'flex',
          alignItems: 'center',
          gap: '8px',
          fontWeight: 'bold'
        }}>
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            backgroundColor: getStatusColor(),
            animation: trackingState === TrackingState.RUNNING ? 'pulse 2s infinite' : 'none'
          }}></div>
          Статус: {getStatusText()}
        </div>

        {/* Timer Display */}
        {trackingState !== TrackingState.STOPPED && (
          <div style={{ padding: '5px', border: '1px solid #2563eb', borderRadius: '5px', color: 'black', backgroundColor: '#eff6ff', fontWeight: 'bold' }}>
            Время: {formatDuration(Math.floor(currentRunTime / 1000))}
          </div>
        )}

        {/* Distance Display */}
        <div style={{ padding: '5px', border: '1px solid #ccc', borderRadius: '5px', color: 'black' }}>
          Distance: {distance.toFixed(2)} km
        </div>

        {/* Pause Information */}
        {(trackingState === TrackingState.PAUSED || (trackingState === TrackingState.STOPPED && pauseCount > 0)) && (
          <div style={{ padding: '5px', border: '1px solid #FF9800', borderRadius: '5px', color: 'black', backgroundColor: '#FFF3E0' }}>
            Пауз: {pauseCount} | Время пауз: {Math.floor(totalPauseTime / 60)}:{(totalPauseTime % 60).toString().padStart(2, '0')}
          </div>
        )}

	      <div style={{ padding: '10px', borderRadius: '5px', display: 'flex', gap: '10px', alignItems: 'center' }}>
        {/* Dynamic Control Buttons */}
        {trackingState === TrackingState.STOPPED && !isSimulating && (
          <button onClick={handleStartTracking} style={{ backgroundColor: '#4CAF50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
            Start Run
          </button>
        )}
        
        {trackingState === TrackingState.RUNNING && (
          <>
            <button onClick={handlePauseTracking} style={{ backgroundColor: '#FF9800', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              Pause
            </button>
            <button onClick={handleStopTracking} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              Stop Run
            </button>
          </>
        )}
        
        {trackingState === TrackingState.PAUSED && (
          <>
            <button onClick={handleResumeTracking} style={{ backgroundColor: '#4CAF50', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              Resume
            </button>
            <button onClick={handleStopTracking} style={{ backgroundColor: '#f44336', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
              Stop Run
            </button>
          </>
        )}
        
        <button onClick={handleSimulateRun} disabled={trackingState !== TrackingState.STOPPED || isSimulating} style={{ 
          backgroundColor: (trackingState !== TrackingState.STOPPED || isSimulating) ? '#ccc' : '#2196F3', 
          color: 'white', 
          border: 'none', 
          padding: '8px 16px', 
          borderRadius: '4px', 
          cursor: (trackingState !== TrackingState.STOPPED || isSimulating) ? 'not-allowed' : 'pointer' 
        }}>
          Simulate Run
        </button>
        
        <button onClick={toggleHistory} style={{ backgroundColor: '#9C27B0', color: 'white', border: 'none', padding: '8px 16px', borderRadius: '4px', cursor: 'pointer' }}>
          История
        </button>
	      </div>
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
      
      {/* Run History Modal */}
      {showHistory && (
        <div style={{
          position: 'fixed',
          top: 0,
          left: 0,
          width: '100%',
          height: '100%',
          backgroundColor: 'rgba(0, 0, 0, 0.5)',
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          zIndex: 2000
        }}>
          <div style={{
            backgroundColor: 'white',
            padding: '20px',
            borderRadius: '10px',
            maxWidth: '90%',
            maxHeight: '80%',
            overflow: 'auto',
            color: 'black'
          }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px' }}>
              <h2>История пробежек</h2>
              <button onClick={toggleHistory} style={{ fontSize: '18px', cursor: 'pointer' }}>✕</button>
            </div>
            
            {savedRuns.length === 0 ? (
              <p>Пока нет сохраненных пробежек</p>
            ) : (
              <div>
                {savedRuns.map((run) => (
                  <div key={run.id} style={{
                    border: '1px solid #ddd',
                    borderRadius: '5px',
                    padding: '15px',
                    marginBottom: '10px',
                    backgroundColor: '#f9f9f9'
                  }}>
                    <div style={{ fontWeight: 'bold', marginBottom: '5px' }}>
                      {new Date(run.date).toLocaleDateString('ru-RU')} в {new Date(run.date).toLocaleTimeString('ru-RU')}
                    </div>
                    <div>Дистанция: {run.distance.toFixed(2)} км</div>
                    <div>Активное время: {formatDuration(run.duration)}</div>
                    {run.totalTime && run.totalTime !== run.duration && (
                      <div>Общее время: {formatDuration(run.totalTime)}</div>
                    )}
                    {run.pauseCount > 0 && (
                      <div>Пауз: {run.pauseCount} | Время пауз: {formatDuration(run.pauseDuration || 0)}</div>
                    )}
                    <div>Захваченных территорий: {run.capturedAreas.length}</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default Map;
