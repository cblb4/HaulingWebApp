import React, { useState, useCallback } from 'react';
import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  useJsApiLoader,
} from '@react-google-maps/api';
import './App.css';

const defaultCenter = { lat: 14.5995, lng: 120.9842 };

function App() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');
  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [isSidebarOpen, setIsSidebarOpen] = useState(true);

  const [result, setResult] = useState({
    distance: '',
    duration: '',
    cost: '',
  });

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [originLatLng, setOriginLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [destinationLatLng, setDestinationLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [waypointLatLngs, setWaypointLatLngs] = useState<google.maps.LatLngLiteral[]>([]);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
  });

  const calculate = async () => {
    try {
      // Parse origin & destination coordinates
      const [oLat, oLng] = origin.split(',').map((s) => parseFloat(s.trim()));
      const [dLat, dLng] = destination.split(',').map((s) => parseFloat(s.trim()));
      
      if (isNaN(oLat) || isNaN(oLng) || isNaN(dLat) || isNaN(dLng)) {
        alert('Please enter valid coordinates in the format "lat,lng".');
        return;
      }
      
      setOriginLatLng({ lat: oLat, lng: oLng });
      setDestinationLatLng({ lat: dLat, lng: dLng });

      // Parse optional waypoints
      const parsedWaypoints: google.maps.LatLngLiteral[] = [];
      for (const wpString of waypoints) {
        const [wLat, wLng] = wpString.split(',').map((s) => parseFloat(s.trim()));
        if (!isNaN(wLat) && !isNaN(wLng)) {
          parsedWaypoints.push({ lat: wLat, lng: wLng });
        }
      }
      setWaypointLatLngs(parsedWaypoints);

      // Use Google Maps DirectionsService to get route
      const directionsService = new window.google.maps.DirectionsService();
      const googleWaypoints: google.maps.DirectionsWaypoint[] = parsedWaypoints.map((latLng) => ({
        location: latLng,
        stopover: true,
      }));

      directionsService.route(
        {
          origin: { lat: oLat, lng: oLng },
          destination: { lat: dLat, lng: dLng },
          travelMode: window.google.maps.TravelMode.DRIVING,
          waypoints: googleWaypoints,
          optimizeWaypoints: false,
        },
        (response, status) => {
          if (status === 'OK' && response && response.routes?.[0]?.legs?.[0]) {
            setDirections(response);

            const leg0 = response.routes[0].legs[0];
            if (!leg0.distance || !leg0.duration) {
              alert('Could not retrieve distance/duration from Google.');
              return;
            }

            const distanceText = leg0.distance.text;
            const durationText = leg0.duration.text;
            const distanceMeters = leg0.distance.value;
            const distanceKm = distanceMeters / 1000;

            const weightNum = parseFloat(weight);
            if (isNaN(weightNum) || weightNum <= 0) {
              alert('Please enter a valid positive number for weight (kg).');
              return;
            }

            const weightFee = (weightNum * 350) / 50.0;
            const distanceFee = distanceKm * 220;
            const total = distanceFee + weightFee;

            setResult({
              distance: distanceText,
              duration: durationText,
              cost: total.toFixed(2),
            });
          } else {
            alert('Failed to load directions from Google Maps.');
          }
        }
      );
    } catch (error: any) {
      console.error('calculate() error:', error);
      alert(`Error calculating the cost:\n${error?.message || JSON.stringify(error)}`);
    }
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    const bounds = new window.google.maps.LatLngBounds(defaultCenter);
    map.fitBounds(bounds);
  }, []);

  return (
    <div className="dashboard-container">
      {/* Sidebar */}
      <div className={`sidebar ${isSidebarOpen ? 'open' : 'closed'}`}>
        <div className="sidebar-header">
          <div className="logo">
            <div className="logo-icon">
              <img 
                src="logo.png" 
                alt="Express Logo" 
                className="logo-image"
              />
            </div>
            <span className="logo-text">Express</span>
          </div>
        </div>
        
        <nav className="sidebar-nav">
          <div className="nav-item active">
            <div className="nav-icon">
              <svg width="20" height="20" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="3" width="7" height="7" rx="1"/>
                <rect x="14" y="14" width="7" height="7" rx="1"/>
                <rect x="3" y="14" width="7" height="7" rx="1"/>
              </svg>
            </div>
            <span className="nav-text">Dashboard</span>
          </div>
        </nav>
      </div>

      {/* Main Content */}
      <div className="main-content">
        {/* Top Header */}
        <header className="top-header">
          <div className="header-left">
            <button 
              className="menu-toggle"
              onClick={() => setIsSidebarOpen(!isSidebarOpen)}
            >
              <svg width="24" height="24" viewBox="0 0 24 24" fill="currentColor">
                <rect x="3" y="6" width="18" height="2" rx="1"/>
                <rect x="3" y="12" width="18" height="2" rx="1"/>
                <rect x="3" y="18" width="18" height="2" rx="1"/>
              </svg>
            </button>
          </div>
        </header>

        {/* Dashboard Content */}
        <div className="dashboard-content">
          <div className="calculator-section">
            <div className="page-title">
              <h1>Route Calculator</h1>
              <p>Calculate hauling costs and plan optimal delivery routes</p>
            </div>

            <div className="content-grid">
              {/* Left Panel - Calculator Form */}
              <div className="calculator-panel">
                <div className="panel-header">
                  <h2>Trip Details</h2>
                </div>
                
                <div className="form-grid">
                  <div className="form-group">
                    <label>Origin Location</label>
                    <input
                      type="text"
                      placeholder="14.5995,120.9842"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Destination</label>
                    <input
                      type="text"
                      placeholder="14.6760,121.0437"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="form-input"
                    />
                  </div>
                  
                  <div className="form-group">
                    <label>Weight (kg)</label>
                    <input
                      type="number"
                      placeholder="Enter weight..."
                      value={weight}
                      onChange={(e) => setWeight(e.target.value)}
                      className="form-input"
                    />
                  </div>
                </div>

                {waypoints.length > 0 && (
                  <div className="waypoints-section">
                    <h3>Waypoints</h3>
                    {waypoints.map((wp, idx) => (
                      <div key={idx} className="waypoint-row">
                        <input
                          type="text"
                          placeholder={`Waypoint ${idx + 1}`}
                          value={wp}
                          onChange={(e) => {
                            const arr = [...waypoints];
                            arr[idx] = e.target.value;
                            setWaypoints(arr);
                          }}
                          className="form-input"
                        />
                        <button
                          onClick={() => setWaypoints(waypoints.filter((_, i) => i !== idx))}
                          className="remove-btn"
                        >
                          <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                            <circle cx="12" cy="12" r="10"/>
                            <path d="M15 9L9 15M9 9l6 6" stroke="white" strokeWidth="2" fill="none"/>
                          </svg>
                        </button>
                      </div>
                    ))}
                  </div>
                )}

                <div className="action-buttons">
                  {waypoints.length < 3 && (
                    <button
                      onClick={() => setWaypoints([...waypoints, ''])}
                      className="secondary-btn"
                    >
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor" style={{ marginRight: '8px' }}>
                        <path d="M12 2C8.13 2 5 5.13 5 9c0 5.25 7 13 7 13s7-7.75 7-13c0-3.87-3.13-7-7-7zm0 9.5c-1.38 0-2.5-1.12-2.5-2.5s1.12-2.5 2.5-2.5 2.5 1.12 2.5 2.5-1.12 2.5-2.5 2.5z"/>
                      </svg>
                      Add Waypoint
                    </button>
                  )}
                  <button onClick={calculate} className="primary-btn">
                    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                      <rect x="4" y="4" width="16" height="16" rx="2"/>
                      <rect x="9" y="9" width="6" height="6"/>
                      <line x1="9" y1="1" x2="9" y2="4"/>
                      <line x1="15" y1="1" x2="15" y2="4"/>
                      <line x1="9" y1="20" x2="9" y2="23"/>
                      <line x1="15" y1="20" x2="15" y2="23"/>
                    </svg>
                    Calculate Route
                  </button>
                </div>

                {result.distance && (
                  <div className="results-panel">
                    <h3>Results</h3>
                    <div className="result-grid">
                      <div className="result-item">
                        <span className="result-label">Distance</span>
                        <span className="result-value">{result.distance}</span>
                      </div>
                      <div className="result-item">
                        <span className="result-label">Duration</span>
                        <span className="result-value">{result.duration}</span>
                      </div>
                      <div className="result-item total-cost">
                        <span className="result-label">Total Cost</span>
                        <span className="result-value">₱{result.cost}</span>
                      </div>
                    </div>
                  </div>
                )}
              </div>

              {/* Right Panel - Map Placeholder */}
              <div className="map-panel">
                <div className="panel-header">
                  <h2>Route Map</h2>
                </div>
                
                <div className="map-container">
                  {isLoaded ? (
                    <GoogleMap
                      mapContainerStyle={{ width: '100%', height: '100%' }}
                      center={defaultCenter}
                      zoom={10}
                      onLoad={onLoad}
                      options={{
                        // Eto ang styles for the google maps hehe
                        styles: [
                          {
                            featureType: 'poi',
                            elementType: 'labels',
                            stylers: [{ visibility: 'off' }]
                          },
                          {
                            featureType: 'all',
                            elementType: 'geometry',
                            stylers: [{ color: '#f8fffe' }]
                          },
                          {
                            featureType: 'water',
                            elementType: 'geometry',
                            stylers: [{ color: '#e0f7f7' }]
                          },
                          {
                            featureType: 'water',
                            elementType: 'labels.text.fill',
                            stylers: [{ color: '#00B69B' }]
                          },
                          {
                            featureType: 'road',
                            elementType: 'geometry',
                            stylers: [{ color: '#ffffff' }]
                          },
                          {
                            featureType: 'road',
                            elementType: 'geometry.stroke',
                            stylers: [{ color: '#e5e7eb' }]
                          },
                          {
                            featureType: 'road.highway',
                            elementType: 'geometry',
                            stylers: [{ color: '#f3f4f6' }]
                          },
                          {
                            featureType: 'road.highway',
                            elementType: 'geometry.stroke',
                            stylers: [{ color: '#00B69B', weight: 1 }]
                          },
                          {
                            featureType: 'landscape.natural',
                            elementType: 'geometry',
                            stylers: [{ color: '#f0fdf4' }]
                          },
                          {
                            featureType: 'poi.business',
                            elementType: 'geometry',
                            stylers: [{ color: '#f9fafb' }]
                          },
                          {
                            featureType: 'all',
                            elementType: 'labels.text.fill',
                            stylers: [{ color: '#374151' }]
                          },
                          {
                            featureType: 'all',
                            elementType: 'labels.text.stroke',
                            stylers: [{ color: '#ffffff', weight: 2 }]
                          },
                          {
                            featureType: 'transit.station',
                            elementType: 'geometry',
                            stylers: [{ color: '#00B69B' }]
                          }
                        ],
                        disableDefaultUI: false,
                        zoomControl: true,
                        mapTypeControl: true,
                        scaleControl: true,
                        streetViewControl: false,
                        rotateControl: false,
                        fullscreenControl: true
                      }}
                    >
                      {directions && <DirectionsRenderer directions={directions} />}
                      
                      {originLatLng && (
                        <Marker
                          position={originLatLng}
                          label="A"
                        />
                      )}
                      
                      {destinationLatLng && (
                        <Marker
                          position={destinationLatLng}
                          label="B"
                        />
                      )}
                      
                      {waypointLatLngs.map((latLng, idx) => (
                        <Marker
                          key={idx}
                          position={latLng}
                          label={`${idx + 1}`}
                        />
                      ))}
                    </GoogleMap>
                  ) : (
                    <div className="map-loading">
                      <div style={{ textAlign: 'center', padding: '60px' }}>
                        <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#00B69B" strokeWidth="2" style={{ marginBottom: '16px' }}>
                          <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/>
                          <line x1="8" y1="2" x2="8" y2="18"/>
                          <line x1="16" y1="6" x2="16" y2="22"/>
                        </svg>
                        <h3>Loading Google Maps...</h3>
                        <p>Please wait while the map loads</p>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;