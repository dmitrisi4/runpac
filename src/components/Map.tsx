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
import LocationArrowIcon from "./icons/LocationArrowIcon";

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
	// State to store the current heading/direction in degrees (0 = North)
	const [currentHeading, setCurrentHeading] = useState<number>(0);
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
	// State to control the visibility of the Telegram share modal.
	const [showTelegramShare, setShowTelegramShare] = useState<boolean>(false);
	// State to track geolocation permission status
	const [geolocationStatus, setGeolocationStatus] = useState<'unknown' | 'granted' | 'denied' | 'prompt'>('unknown');
	// State to store the selected run for viewing on the map
	const [selectedRun, setSelectedRun] = useState<SavedRun | null>(null);


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

	// Custom location marker with rotating arrow using ReactDOM
	const LocationMarker: React.FC<{ position: LatLngTuple; heading: number }> = ({position, heading}) => {
		const markerRef = useRef<any>(null);

		useEffect(() => {
			if (markerRef.current) {
				const markerElement = markerRef.current.getElement();
				if (markerElement) {
					const iconElement = markerElement.querySelector('.custom-location-icon');
					if (iconElement) {
						iconElement.style.transform = `rotate(${heading}deg)`;
					}
				}
			}
		}, [heading]);

		return (
			<Marker
				ref={markerRef}
				position={position}
				icon={new (window as any).L.DivIcon({
					html: `
						<div class="custom-location-icon" style="
							width: 32px; 
							height: 32px; 
							transform: rotate(${heading}deg);
							transition: transform 0.3s ease-out;
							display: flex;
							align-items: center;
							justify-content: center;
						">
							<svg height="64px" width="64px" version="1.1" id="Layer_1" xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" viewBox="0 0 512 512" xml:space="preserve" fill="#000000" transform="rotate(270)"><g id="SVGRepo_bgCarrier" stroke-width="0"></g><g id="SVGRepo_tracerCarrier" stroke-linecap="round" stroke-linejoin="round"></g><g id="SVGRepo_iconCarrier"> <circle style="fill:#FFD15D;" cx="256" cy="256" r="256"></circle> <path style="fill:#F9B54C;" d="M511.986,257.072L384.338,129.424L205.174,334.465l-76.35,49.299l128.224,128.224 C397.591,511.422,511.409,397.614,511.986,257.072z"></path> <path style="fill:#31BAFD;" d="M153.715,118.088h204.571c19.677,0,35.628,15.951,35.628,35.626v204.571 c0,19.677-15.951,35.628-35.626,35.628H153.717c-19.677,0-35.628-15.951-35.628-35.626V153.715 C118.088,134.039,134.039,118.088,153.715,118.088z"></path> <path style="fill:#2B9ED8;" d="M118.089,255.426v102.86c0,19.677,15.951,35.626,35.628,35.626h204.571 c19.677,0,35.628-15.951,35.626-35.628v-102.86H118.089V255.426z"></path> <polygon style="fill:#324A5E;" points="223.794,362.467 195.756,334.429 274.189,256 195.758,177.571 223.796,149.533 330.264,256 "></polygon> <polygon style="fill:#2B3B4E;" points="273.615,255.426 274.189,256 195.756,334.429 223.794,362.467 330.264,256 329.688,255.426 "></polygon> </g></svg>
						</div>
					`,
					className: 'custom-location-marker',
					iconSize: [32, 32],
					iconAnchor: [16, 16]
				})}
			>
				<Popup>Текущее местоположение</Popup>
			</Marker>
		);
	};

	// Component for polyline with auto-opening popup
	const PolylineWithAutoPopup: React.FC<{ run: SavedRun }> = ({run}) => {
		const polylineRef = useRef<any>(null);

		useEffect(() => {
			if (polylineRef.current) {
				// Small delay to ensure polyline is rendered
				setTimeout(() => {
					if (polylineRef.current) {
						// Simulate click to open popup
						polylineRef.current.fire('click');
					}
				}, 200);
			}
		}, []);

		return (
			<Polyline
				ref={polylineRef}
				positions={run.path}
				color="red"
				weight={4}
				opacity={0.8}
			>
				<Popup>
					<div style={{minWidth: '200px'}}>
						<h3 style={{margin: '0 0 10px 0', fontSize: '16px', fontWeight: 'bold'}}>Информация о пробежке</h3>
						<p style={{margin: '5px 0'}}><strong>Дата:</strong> {new Date(run.date).toLocaleDateString('ru-RU')}</p>
						<p style={{margin: '5px 0'}}><strong>Расстояние:</strong> {run.distance.toFixed(2)} км</p>
						<p style={{margin: '5px 0'}}><strong>Активное
							время:</strong> {Math.floor(run.duration / 60)}:{(run.duration % 60).toString().padStart(2, '0')}</p>
						<p style={{margin: '5px 0'}}><strong>Общее
							время:</strong> {Math.floor(run.totalTime / 60)}:{(run.totalTime % 60).toString().padStart(2, '0')}</p>
						{run.pauseCount > 0 && (
							<>
								<p style={{margin: '5px 0'}}><strong>Количество пауз:</strong> {run.pauseCount}</p>
								<p style={{margin: '5px 0'}}><strong>Время
									пауз:</strong> {Math.floor(run.pauseDuration / 60)}:{(run.pauseDuration % 60).toString().padStart(2, '0')}
								</p>
							</>
						)}
						<p style={{margin: '5px 0'}}><strong>Захваченных территорий:</strong> {run.capturedAreas.length}</p>
					</div>
				</Popup>
			</Polyline>
		);
	};

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
	 * Generates a summary message of all runs for sharing.
	 */
	const generateRunSummary = () => {
		if (savedRuns.length === 0) {
			return '🏃‍♂️ RunPac - Мой трекер пробежек\n\nПока нет сохраненных пробежек.';
		}

		const totalDistance = savedRuns.reduce((sum, run) => sum + run.distance, 0);
		const totalDuration = savedRuns.reduce((sum, run) => sum + run.duration, 0);
		const totalAreas = savedRuns.reduce((sum, run) => sum + run.capturedAreas.length, 0);
		const avgDistance = totalDistance / savedRuns.length;

		return `🏃‍♂️ RunPac - Мои результаты\n\n` +
			`📊 Общая статистика:\n` +
			`• Всего пробежек: ${savedRuns.length}\n` +
			`• Общая дистанция: ${totalDistance.toFixed(2)} км\n` +
			`• Общее время: ${formatDuration(totalDuration)}\n` +
			`• Средняя дистанция: ${avgDistance.toFixed(2)} км\n` +
			`• Захвачено территорий: ${totalAreas}\n\n` +
			`🎯 Присоединяйся к RunPac и начни свои пробежки!`;
	};

	/**
	 * Generates a detailed history message for sharing.
	 */
	const generateDetailedRunHistory = () => {
		if (savedRuns.length === 0) {
			return '🏃‍♂️ RunPac - История пробежек\n\nПока нет сохраненных пробежек.';
		}

		let message = `🏃‍♂️ RunPac - История пробежек\n\n`;

		// Ограничиваем до 10 последних пробежек для избежания слишком длинного URL
		const runsToShow = savedRuns.slice(-10).reverse();
		runsToShow.forEach((run, index) => {
			const date = new Date(run.date);
			message += `${index + 1}. ${date.toLocaleDateString('ru-RU')} - ${run.distance.toFixed(2)}км, ${formatDuration(run.duration)}`;
			if (run.pauseCount > 0) {
				message += `, пауз: ${run.pauseCount}`;
			}
			if (run.capturedAreas.length > 0) {
				message += `, территорий: ${run.capturedAreas.length}`;
			}
			message += `\n`;
		});

		if (savedRuns.length > 10) {
			message += `\n... и еще ${savedRuns.length - 10} пробежек\n`;
		}

		message += `\n🎯 Присоединяйся к RunPac!`;
		return message;
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

		// Immediately get current position to center the map
		navigator.geolocation.getCurrentPosition(
			(position: GeolocationPosition) => {
				const {latitude, longitude} = position.coords;
				const initialPosition: LatLngTuple = [latitude, longitude];
				setCurrentPosition(initialPosition);
				console.log(`Initial position set: lat=${latitude}, lng=${longitude}`);
			},
			(error: GeolocationPositionError) => {
				console.warn('Could not get initial position:', error.message);
			},
			{
				enableHighAccuracy: true,
				timeout: 10000,
				maximumAge: 60000
			}
		);

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

				// Calculate heading if we have a previous position
				if (lastGPSPoint.current) {
					const bearing = turf.bearing(
						turf.point([lastGPSPoint.current.lng, lastGPSPoint.current.lat]),
						turf.point([longitude, latitude])
					);
					// Convert bearing to 0-360 degrees (turf.bearing returns -180 to 180)
					const heading = bearing < 0 ? bearing + 360 : bearing;
					setCurrentHeading(heading);
					console.log(`Heading updated: ${heading.toFixed(1)}°`);
				}

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
			</div>

			{/*TIMER BLOCK*/}
			{trackingState !== TrackingState.STOPPED &&
		  <div style={{
						position: 'absolute',
						top: '100px',
						left: '50%',
						transform: 'translateX(-50%)',
						zIndex: 1000,
						background: '#FAF9F6',
						padding: '6px 10px',
						display: 'grid',
						borderRadius: '15px',
						gap: '0',
						alignItems: 'center',
						overflow: 'hidden',
					}}>
						{/* Timer Display */}
			  <div style={{
								padding: '5px',
								// border: '1px solid #2563eb',
								borderRadius: '5px',
								color: '#333333',
								fontWeight: 'bold'
							}}>
				  Tiempo: {formatDuration(Math.floor(currentRunTime / 1000))}
			  </div>

						{/* Distance Display */}
			  <div style={{
								padding: '5px',
								// border: '1px solid #ccc',
				        borderTop: '1px solid #333333',
								// borderRadius: '5px',
								color: '#333333'
							}}>
				  Distancia: {distance.toFixed(2)} km
			  </div>
		  </div>
			}
			{/**/}

			<div style={{
				position: 'absolute',
				bottom: '5%',
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
							// padding: '5px 10px',
							border: 'none',
							// padding: '8px 16px',
							// borderRadius: '4px',
							borderRadius: '50%',
							padding: '3px',
							cursor: 'pointer',
						}}>
							<RunIcon style={{width: '40px', height: '40px'}}/>
							{/*<span style={{fontSize: '13px', fontWeight: 700}}>Iniciar</span>*/}
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
							        // padding: '5px 10px',
							        // borderRadius: '4px',
							        borderRadius: '50%',
							        padding: '3px',
							        cursor: (trackingState !== TrackingState.STOPPED || isSimulating) ? 'not-allowed' : 'pointer'
						        }}>
							{/*Simulate Run*/}
							<RunTestIcon style={{width: '40px', height: '40px'}}/>
							{/*<span style={{fontSize: '13px', fontWeight: 700}}>Iniciar Test</span>*/}
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
					<LocationMarker position={currentPosition} heading={currentHeading}/>
				)}
				<Polyline positions={path} color="blue"/>
				{capturedAreas.map((area, index) => (
					<Polygon key={index} positions={area} color="purple"/>
				))}
				{/* Display selected run path and captured areas */}
				{selectedRun && (
					<>
						<PolylineWithAutoPopup key={selectedRun.id} run={selectedRun}/>
						{selectedRun.capturedAreas.map((area, index) => (
							<Polygon key={`selected-${index}`} positions={area} color="orange" fillOpacity={0.3}/>
						))}
					</>
				)}
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
						<div style={{marginBottom: '20px'}}>
							<div>
								<h2>История пробежек</h2>
								{selectedRun && (
									<p style={{margin: '5px 0 0 0', fontSize: '14px', color: '#666'}}>
										📍 Показан маршрут от {new Date(selectedRun.date).toLocaleDateString('ru-RU')}
									</p>
								)}
							</div>
							<div style={{display: 'flex', gap: '10px', alignItems: 'center'}}>
								{selectedRun && (
									<button
										onClick={() => setSelectedRun(null)}
										style={{
											padding: '8px 16px',
											backgroundColor: '#dc3545',
											color: 'white',
											border: 'none',
											borderRadius: '5px',
											cursor: 'pointer',
											fontSize: '14px',
											fontWeight: 'bold'
										}}
									>
										🗑️ Очистить
									</button>
								)}
								<button
									onClick={() => setShowTelegramShare(true)}
									style={{
										padding: '8px 16px',
										backgroundColor: '#0088cc',
										color: 'white',
										border: 'none',
										borderRadius: '5px',
										cursor: 'pointer',
										fontSize: '14px',
										fontWeight: 'bold'
									}}
								>
									📤 Export
								</button>
								<button onClick={toggleHistory} style={{fontSize: '14px', cursor: 'pointer'}}>✕</button>
							</div>
						</div>

						{savedRuns.length === 0 ? (
							<p>Пока нет сохраненных пробежек</p>
						) : (
							<div>
								{savedRuns.map((run) => (
									<div
										key={run.id}
										onClick={() => {
											setSelectedRun(run);
											setShowHistory(false);
										}}
										style={{
											border: selectedRun?.id === run.id ? '2px solid #0088cc' : '1px solid #ddd',
											borderRadius: '5px',
											padding: '15px',
											marginBottom: '10px',
											backgroundColor: selectedRun?.id === run.id ? '#e6f3ff' : '#f9f9f9',
											cursor: 'pointer',
											transition: 'all 0.2s ease'
										}}
										onMouseEnter={(e) => {
											if (selectedRun?.id !== run.id) {
												e.currentTarget.style.backgroundColor = '#f0f0f0';
											}
										}}
										onMouseLeave={(e) => {
											if (selectedRun?.id !== run.id) {
												e.currentTarget.style.backgroundColor = '#f9f9f9';
											}
										}}
									>
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

			{/* Telegram Share Modal */}
			{showTelegramShare && (
				<div style={{
					position: 'fixed',
					top: 0,
					left: 0,
					width: '100%',
					height: '100%',
					backgroundColor: 'rgba(0, 0, 0, 0.7)',
					display: 'flex',
					justifyContent: 'center',
					alignItems: 'center',
					zIndex: 3000
				}}>
					<div style={{
						backgroundColor: 'white',
						padding: '30px',
						borderRadius: '15px',
						maxWidth: '400px',
						width: '90%',
						color: 'black',
						textAlign: 'center'
					}}>
						<div style={{display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '20px'}}>
							<h3 style={{margin: 0}}>Поделиться в Telegram</h3>
							<button
								onClick={() => setShowTelegramShare(false)}
								style={{fontSize: '18px', cursor: 'pointer', background: 'none', border: 'none'}}
							>
								✕
							</button>
						</div>

						<div style={{marginBottom: '20px'}}>
							<p style={{marginBottom: '15px', color: '#666'}}>Выберите, что хотите экспортировать:</p>

							<button
								onClick={() => {
									const message = generateRunSummary();
									const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(message)}`;
									window.open(telegramUrl, '_blank');
								}}
								style={{
									width: '100%',
									padding: '12px',
									marginBottom: '10px',
									backgroundColor: '#0088cc',
									color: 'white',
									border: 'none',
									borderRadius: '8px',
									cursor: 'pointer',
									fontSize: '16px',
									fontWeight: 'bold'
								}}
							>
								📊 Сводка всех пробежек
							</button>

							<button
								onClick={() => {
									const message = generateDetailedRunHistory();
									const telegramUrl = `https://t.me/share/url?url=${encodeURIComponent(window.location.href)}&text=${encodeURIComponent(message)}`;
									window.open(telegramUrl, '_blank');
								}}
								style={{
									width: '100%',
									padding: '12px',
									marginBottom: '10px',
									backgroundColor: '#229ED9',
									color: 'white',
									border: 'none',
									borderRadius: '8px',
									cursor: 'pointer',
									fontSize: '16px',
									fontWeight: 'bold'
								}}
							>
								📋 Детальная история
							</button>

							<button
								onClick={() => {
									const dataString = JSON.stringify(savedRuns, null, 2);
									navigator.clipboard.writeText(dataString).then(() => {
										alert('Данные пробежек скопированы в буфер обмена!');
									}).catch(() => {
										alert('Ошибка при копировании данных');
									});
								}}
								style={{
									width: '100%',
									padding: '12px',
									backgroundColor: '#6b7280',
									color: 'white',
									border: 'none',
									borderRadius: '8px',
									cursor: 'pointer',
									fontSize: '16px',
									fontWeight: 'bold'
								}}
							>
								📄 Копировать JSON
							</button>
						</div>
					</div>
				</div>
			)}
		</div>
	);
};

export default Map;
