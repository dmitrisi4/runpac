import React, { useState, useRef, useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, Polyline, Polygon, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import * as turf from 'turf';
import { length } from '@turf/length';
import { LatLngExpression } from 'leaflet';
import HistoryIcon from "./icons/HistoryIcon";
import LocationIcon from "./icons/LocationIcon";
import RunIcon from "./icons/RunIcon";
import RunTestIcon from "./icons/RunTestIcon";

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
const ChangeView: React.FC<{ center: LatLngExpression | null; zoom: number }> = ({center, zoom}) => {
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
	// State to track geolocation permission status
	const [geolocationStatus, setGeolocationStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');

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
	const lastGPSPoint = useRef<{ lat: number, lng: number, timestamp: number, accuracy: number } | null>(null);

	// Effect to check geolocation permission status on component mount
	useEffect(() => {
		const checkGeolocationPermission = async () => {
			if (!navigator.geolocation) {
				setGeolocationStatus('denied');
				return;
			}

			try {
				if (navigator.permissions) {
					const permission = await navigator.permissions.query({name: 'geolocation'});
					setGeolocationStatus(permission.state);

					// Listen for permission changes
					permission.addEventListener('change', () => {
						setGeolocationStatus(permission.state);
					});
				} else {
					// Fallback for browsers that don't support permissions API
					setGeolocationStatus('unknown');
				}
			} catch (error) {
				console.error('Error checking geolocation permission:', error);
				setGeolocationStatus('unknown');
			}
		};

		checkGeolocationPermission();
	}, []);

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
			const lengthVal = length(line, {units: 'kilometers'});
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
				const {latitude, longitude, accuracy} = position.coords;
				const timestamp = Date.now();

				console.log(`GPS update: lat=${latitude}, lng=${longitude}, accuracy=${accuracy}m`);

				// Filter out inaccurate GPS points
				if (accuracy > MIN_ACCURACY) {
					console.log(`GPS point filtered: accuracy ${accuracy}m > ${MIN_ACCURACY}m`);
					return;
				}

				const newGPSPoint = {lat: latitude, lng: longitude, timestamp, accuracy};

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
				switch (error.code) {
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
			{enableHighAccuracy: true, timeout: 10000, maximumAge: 1000}
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
				const {latitude, longitude, accuracy} = position.coords;
				const timestamp = Date.now();

				console.log(`GPS update (resumed): lat=${latitude}, lng=${longitude}, accuracy=${accuracy}m`);

				// Filter out inaccurate GPS points
				if (accuracy > MIN_ACCURACY) {
					console.log(`GPS point filtered: accuracy ${accuracy}m > ${MIN_ACCURACY}m`);
					return;
				}

				const newGPSPoint = {lat: latitude, lng: longitude, timestamp, accuracy};

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
				switch (error.code) {
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
			{enableHighAccuracy: true, timeout: 10000, maximumAge: 1000}
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
				return 'Activado';
			case TrackingState.PAUSED:
				return 'Pausa';
			case TrackingState.STOPPED:
			default:
				return 'Suspender';
		}
	};

	// Function to get geolocation status text and color
	const getGeolocationStatusInfo = (): { text: string; color: string } => {
		switch (geolocationStatus) {
			case 'granted':
				return {text: 'GPS: Permitido', color: '#10b981'}; // green
			case 'denied':
				return {text: 'GPS: Prohibido', color: '#ef4444'}; // red
			case 'prompt':
				return {text: 'GPS: Se requiere permiso', color: '#f59e0b'}; // amber
			default:
				return {text: 'GPS: Comprobando...', color: '#6b7280'}; // gray
		}
	};

	// --- RENDER ---
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

			<div>
				<div style={{
					position: 'absolute',
					top: '10px',
					left: '60px',
					zIndex: 1000,
					background: 'white',
					padding: '0 10px',
					display: 'flex',
					borderRadius: '15px',
					gap: '10px',
					alignItems: 'center',
					overflow: 'hidden',
				}}>
					{/* Status Indicator */}
					<div style={{
						padding: '8px 12px',
						borderRight: `2px solid rgb(158 158 158 / 20%)`,
						// borderRadius: '15px',
						color: 'black',
						backgroundColor: trackingState === TrackingState.PAUSED ? '#FFF3E0' : 'white',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						fontWeight: 'bold',
						fontSize: '14px',
					}}>
						<div style={{
							width: '10px',
							height: '10px',
							borderRadius: '50%',
							backgroundColor: getStatusColor(),
							animation: trackingState === TrackingState.RUNNING ? 'pulse 2s infinite' : 'none'
						}}></div>
						Estado: {getStatusText()}
					</div>

					{/* Geolocation Status Indicator */}
					<div style={{
						// padding: '8px 12px',
						// border: `2px solid ${getGeolocationStatusInfo().color}`,
						borderRadius: '5px',
						color: 'black',
						backgroundColor: 'white',
						display: 'flex',
						alignItems: 'center',
						gap: '8px',
						fontWeight: 'bold'
					}}>
						<div style={{
							width: '10px',
							height: '10px',
							borderRadius: '50%',
							backgroundColor: getGeolocationStatusInfo().color
						}}></div>
						{/*<span>GPS</span>*/}
						<LocationIcon style={{width: '30px', height: '30px'}}/>
						{/*{getGeolocationStatusInfo().text}*/}
					</div>
				</div>
			</div>

			<div style={{
				position: 'absolute',
				top: '10px',
				right: '10px',
				zIndex: 1000,
				background: 'white',
				borderRadius: '15px',
				gap: '20px',
				padding: '5px 15px',
				alignItems: 'center',
				display: 'flex',

			}}>
				<button onClick={toggleHistory} style={{
					backgroundColor: 'transparent',
					color: 'white',
					border: 'none',
					padding: '0',
					borderRadius: '4px',
					cursor: 'pointer',
					display: 'flex',
				}}>
					<HistoryIcon style={{width: '30px', height: '30px'}}/>
				</button>
			</div>


			<div style={{
				position: 'absolute',
				bottom: '20%',
				left: '50%',
				transform: 'translateX(-50%)',
				display: 'grid',
				zIndex: 1000,
				background: 'white',
				padding: '10px',
				borderRadius: '15px',
				gap: '10px',
				alignItems: 'center'
			}}>

				{/* Timer Display */}
				{trackingState !== TrackingState.STOPPED && (
					<div style={{
						padding: '5px',
						border: '1px solid #2563eb',
						borderRadius: '5px',
						color: 'black',
						backgroundColor: '#eff6ff',
						fontWeight: 'bold'
					}}>
						Tiempo: {formatDuration(Math.floor(currentRunTime / 1000))}
					</div>
				)}

				{/* Distance Display */}
				{trackingState !== TrackingState.STOPPED && (
					<div style={{padding: '5px', border: '1px solid #ccc', borderRadius: '5px', color: 'black'}}>
						Distancia: {distance.toFixed(2)} km
					</div>
				)}

				{/* Pause Information */}
				{(trackingState === TrackingState.PAUSED || (trackingState === TrackingState.STOPPED && pauseCount > 0)) && (
					<div style={{
						padding: '5px',
						border: '1px solid #FF9800',
						borderRadius: '5px',
						color: 'black',
						backgroundColor: '#FFF3E0',
						marginBottom: '10px',
					}}>
						Pausas: {pauseCount} | Tiempo de
						pausa: {Math.floor(totalPauseTime / 60)}:{(totalPauseTime % 60).toString().padStart(2, '0')}
					</div>
				)}

				<div style={{
					padding: '0',
					borderRadius: '5px',
					display: 'flex',
					gap: '20px',
					alignItems: 'center',
					justifyContent: 'center'
				}}>
					{/* Dynamic Control Buttons */}
					{trackingState === TrackingState.STOPPED && !isSimulating && (
						<button onClick={handleStartTracking} style={{
							// backgroundColor: '#4CAF50',
							display: 'flex',
							flexDirection: 'column',
							alignItems: 'center',
							gap: '5px',
							backgroundColor: '#48ceac',
							color: '#F9FAFB',
							padding: '5px 10px',
							border: 'none',
							// padding: '8px 16px',
							borderRadius: '4px',
							cursor: 'pointer',
						}}>
							<RunIcon style={{width: '40px', height: '40px'}}/>
							<span style={{fontSize: '13px', fontWeight: 700}}>Iniciar</span>
						</button>
					)}

					{trackingState === TrackingState.RUNNING && (
						<>
							<button onClick={handlePauseTracking} style={{
								backgroundColor: '#FF9800',
								color: 'white',
								border: 'none',
								padding: '8px 16px',
								borderRadius: '4px',
								cursor: 'pointer'
							}}>
								Pausa
							</button>
							<button onClick={handleStopTracking} style={{
								backgroundColor: '#f44336',
								color: 'white',
								border: 'none',
								padding: '8px 16px',
								borderRadius: '4px',
								cursor: 'pointer'
							}}>
								Detener
							</button>
						</>
					)}

					{trackingState === TrackingState.PAUSED && (
						<>
							<button onClick={handleResumeTracking} style={{
								backgroundColor: '#4CAF50',
								color: 'white',
								border: 'none',
								padding: '8px 16px',
								borderRadius: '4px',
								cursor: 'pointer'
							}}>
								Reanudar
							</button>
							<button onClick={handleStopTracking} style={{
								backgroundColor: '#f44336',
								color: 'white',
								border: 'none',
								padding: '8px 16px',
								borderRadius: '4px',
								cursor: 'pointer'
							}}>
								Detener
							</button>
						</>
					)}

					{trackingState === TrackingState.STOPPED && (
						<button onClick={handleSimulateRun}
						        style={{
							        // backgroundColor: (trackingState !== TrackingState.STOPPED || isSimulating) ? '#ccc' : '#2196F3',
							        display: 'flex',
							        flexDirection: 'column',
							        alignItems: 'center',
							        gap: '5px',
							        backgroundColor: '#5046cf',
							        color: '#F9FAFB',
							        border: 'none',
							        // padding: '8px 16px',
							        padding: '5px 10px',
							        borderRadius: '4px',
							        cursor: (trackingState !== TrackingState.STOPPED || isSimulating) ? 'not-allowed' : 'pointer'
						        }}>
							{/*Simulate Run*/}
							<RunTestIcon style={{width: '40px', height: '40px'}}/>
							<span style={{fontSize: '13px', fontWeight: 700}}>Iniciar Test</span>
						</button>
					)}
				</div>
			</div>
			<MapContainer center={initialPosition} zoom={13} style={{height: '100vh', width: '100%'}}>
				{currentPosition && <ChangeView center={currentPosition} zoom={14}/>}
				<TileLayer
					url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
					attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
				/>
				{currentPosition && (
					<Marker position={currentPosition}>
						<Popup>Current Position</Popup>
					</Marker>
				)}
				<Polyline positions={path} color="blue"/>
				{capturedAreas.map((area, index) => (
					<Polygon key={index} positions={area} color="purple"/>
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
						<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
							<h2>История пробежек</h2>
							<button onClick={toggleHistory} style={{fontSize: '18px', cursor: 'pointer'}}>✕</button>
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
										<div style={{fontWeight: 'bold', marginBottom: '5px'}}>
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
