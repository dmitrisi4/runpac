# Run Tracker PWA Architecture

This document outlines the architecture and development plan for the Run Tracker Progressive Web App.

## 1. Core Features

- **Run Tracking:** Track the user's location in real-time using GPS.
- **Territory Capture:** When a running path forms a closed loop, the enclosed area is visually "captured" on the map.
- **Progressive Web App (PWA):** The application will be installable on a user's device and will have offline capabilities.

## 2. Architecture

The application will be a client-side focused PWA. A backend can be added later for user accounts and data synchronization, but the initial version will store all data in the browser.

### Frontend

- **Framework:** **React**. We will use `create-react-app` to bootstrap the project, which provides a modern toolchain and PWA support out of the box.
- **Mapping Library:** **Leaflet.js** with the **`react-leaflet`** wrapper. Leaflet is a lightweight, open-source mapping library that is perfect for our needs.
- **Geospatial Analysis:** **Turf.js**. This library will be used for the territory capture logic, such as creating polygons from paths and performing other GIS operations.
- **Geolocation:** The browser's native **`navigator.geolocation` API** will be used to get the user's GPS coordinates.
- **Data Persistence:** **`localStorage`** or **`IndexedDB`** will be used to store run data (paths and captured areas) on the client-side.
- **Styling:** We will start with basic CSS and can integrate a UI library like Material-UI or a utility-first framework like Tailwind CSS later if needed.

## 3. Development Plan

1.  **Project Setup:**
    - Initialize a new React project using `create-react-app`.
    - Install dependencies: `leaflet`, `react-leaflet`, `turf`.

2.  **Basic Map Display:**
    - Create a `Map` component that renders a full-screen Leaflet map.

3.  **Geolocation and Run Tracking:**
    - Implement a "Start" button that begins tracking the user's location.
    - As the location updates, draw a `Polyline` on the map to show the user's path.
    - Implement a "Stop" button to end the tracking session.

4.  **Territory Capture Logic:**
    - After a run is stopped, check if the path forms a closed loop (e.g., the start and end points are within a certain distance of each other).
    - If a loop is detected, use the path's coordinates to create a `Polygon` with Turf.js.
    - Render the filled `Polygon` on the map.

5.  **Data Persistence:**
    - Save the completed paths and captured polygons to `localStorage`.
    - On application load, retrieve and display any saved data from `localStorage`.

6.  **PWA Configuration:**
    - Customize the `public/manifest.json` file (app name, icons, theme color).
    - Ensure the service worker is registered and configured for basic offline caching.

7.  **UI/UX Refinements:**
    - Add UI elements to show run statistics (e.g., distance, time).
    - Improve the overall look and feel of the application.
