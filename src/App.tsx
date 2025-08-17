import React from 'react';
import Map from './components/Map';
import './App.css';

/**
 * The main application component.
 * It renders the primary Map component which contains all the core functionality.
 * @returns {React.ReactElement} The App component.
 */
const App: React.FC = () => {
  return (
    <div className="App">
      <Map />
    </div>
  );
}

export default App;
