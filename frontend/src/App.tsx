import React, { useState, useCallback, useRef, useEffect } from 'react';
import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  useJsApiLoader,
  Autocomplete,
} from '@react-google-maps/api';
import './App.css';

const defaultCenter = { lat: 14.5995, lng: 120.9842 };
const libraries: ("places")[] = ["places"];

// Toast notification component
const Toast = ({ message, type, onClose }: { message: string; type: 'success' | 'error' | 'info'; onClose: () => void }) => (
  <div className={`toast toast-${type}`}>
    <div className="toast-content">
      <span>{message}</span>
      <button onClick={onClose} className="toast-close">×</button>
    </div>
  </div>
);

function App() {
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');

  const [waypoints, setWaypoints] = useState<string[]>([]);
  const [isCalculating, setIsCalculating] = useState(false);
  const [showPriceBreakdown, setShowPriceBreakdown] = useState(false);
  const [toast, setToast] = useState<{ message: string; type: 'success' | 'error' | 'info' } | null>(null);

  const [result, setResult] = useState({
    distance: '',
    duration: '',
    cost: '',
    distanceFee: 0,
    weightFee: 0,
    total: 0,
  });

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [originLatLng, setOriginLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [destinationLatLng, setDestinationLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [waypointLatLngs, setWaypointLatLngs] = useState<google.maps.LatLngLiteral[]>([]);

  const originAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);
  const destinationAutocompleteRef = useRef<google.maps.places.Autocomplete | null>(null);

  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY || '',
    libraries,
  });



  const showToast = (message: string, type: 'success' | 'error' | 'info') => {
    setToast({ message, type });
    setTimeout(() => setToast(null), 5000);
  };

  const getCurrentLocation = () => {
    if (!navigator.geolocation) {
      showToast('Geolocation is not supported by this browser', 'error');
      return;
    }

    navigator.geolocation.getCurrentPosition(
      (position) => {
        const { latitude, longitude } = position.coords;
        setOrigin(`${latitude}, ${longitude}`);
        setOriginLatLng({ lat: latitude, lng: longitude });
        showToast('Current location set as origin', 'success');
      },
      (error) => {
        showToast('Unable to get your location', 'error');
      }
    );
  };

  const validateInputs = () => {
    if (!origin.trim()) {
      showToast('Please enter an origin location', 'error');
      return false;
    }
    if (!destination.trim()) {
      showToast('Please enter a destination', 'error');
      return false;
    }
    if (!weight || parseFloat(weight) <= 0) {
      showToast('Please enter a valid weight', 'error');
      return false;
    }
    return true;
  };

  const geocodeAddress = async (address: string): Promise<google.maps.LatLngLiteral | null> => {
    return new Promise((resolve) => {
      const geocoder = new google.maps.Geocoder();
      geocoder.geocode({ 
        address,
        region: 'PH' // Bias results to Philippines
      }, (results, status) => {
        console.log('Geocoding status:', status, 'for address:', address);
        
        if (status === 'OK' && results && results[0]) {
          const location = results[0].geometry.location;
          console.log('Geocoded successfully:', { lat: location.lat(), lng: location.lng() });
          resolve({ lat: location.lat(), lng: location.lng() });
        } else {
          console.error('Geocoding failed:', status, results);
          
          // Provide more specific error messages
          let errorMessage = 'Could not find location';
          switch (status) {
            case 'ZERO_RESULTS':
              errorMessage = `No results found for "${address}". Try a more specific address.`;
              break;
            case 'OVER_QUERY_LIMIT':
              errorMessage = 'Too many requests. Please try again in a moment.';
              break;
            case 'REQUEST_DENIED':
              errorMessage = 'Geocoding service denied. Please check API configuration.';
              break;
            case 'INVALID_REQUEST':
              errorMessage = 'Invalid address format. Please check your input.';
              break;
            case 'UNKNOWN_ERROR':
              errorMessage = 'Server error. Please try again.';
              break;
          }
          
          showToast(errorMessage, 'error');
          resolve(null);
        }
      });
    });
  };

  const calculate = async () => {
    if (!validateInputs()) return;

    // Check if Google Maps is loaded
    if (!window.google || !window.google.maps) {
      showToast('Google Maps is still loading. Please wait a moment and try again.', 'error');
      return;
    }

    setIsCalculating(true);
    
    try {
      let originCoords: google.maps.LatLngLiteral | null = null;
      let destinationCoords: google.maps.LatLngLiteral | null = null;

      console.log('Processing origin:', origin);
      console.log('Processing destination:', destination);

      // Handle origin (coordinates or address)
      if (origin.includes(',') && origin.split(',').length === 2) {
        const [oLat, oLng] = origin.split(',').map((s) => parseFloat(s.trim()));
        if (!isNaN(oLat) && !isNaN(oLng) && Math.abs(oLat) <= 90 && Math.abs(oLng) <= 180) {
          originCoords = { lat: oLat, lng: oLng };
          console.log('Origin coordinates valid:', originCoords);
        } else {
          showToast('Invalid origin coordinates. Please check latitude and longitude values.', 'error');
          setIsCalculating(false);
          return;
        }
      } else {
        console.log('Geocoding origin address...');
        originCoords = await geocodeAddress(origin);
      }

      // Handle destination (coordinates or address)
      if (destination.includes(',') && destination.split(',').length === 2) {
        const [dLat, dLng] = destination.split(',').map((s) => parseFloat(s.trim()));
        if (!isNaN(dLat) && !isNaN(dLng) && Math.abs(dLat) <= 90 && Math.abs(dLng) <= 180) {
          destinationCoords = { lat: dLat, lng: dLng };
          console.log('Destination coordinates valid:', destinationCoords);
        } else {
          showToast('Invalid destination coordinates. Please check latitude and longitude values.', 'error');
          setIsCalculating(false);
          return;
        }
      } else {
        console.log('Geocoding destination address...');
        destinationCoords = await geocodeAddress(destination);
      }

      if (!originCoords) {
        showToast('Could not locate origin. Please try a different address or use coordinates.', 'error');
        setIsCalculating(false);
        return;
      }

      if (!destinationCoords) {
        showToast('Could not locate destination. Please try a different address or use coordinates.', 'error');
        setIsCalculating(false);
        return;
      }

      console.log('Both locations found:', { originCoords, destinationCoords });

      setOriginLatLng(originCoords);
      setDestinationLatLng(destinationCoords);

      // Handle waypoints
      const parsedWaypoints: google.maps.LatLngLiteral[] = [];
      for (let i = 0; i < waypoints.length; i++) {
        const wpString = waypoints[i].trim();
        if (wpString) {
          let wpCoords: google.maps.LatLngLiteral | null = null;
          
          if (wpString.includes(',') && wpString.split(',').length === 2) {
            const [wLat, wLng] = wpString.split(',').map((s) => parseFloat(s.trim()));
            if (!isNaN(wLat) && !isNaN(wLng) && Math.abs(wLat) <= 90 && Math.abs(wLng) <= 180) {
              wpCoords = { lat: wLat, lng: wLng };
            }
          } else {
            wpCoords = await geocodeAddress(wpString);
          }
          
          if (wpCoords) {
            parsedWaypoints.push(wpCoords);
          } else {
            showToast(`Could not locate waypoint ${i + 1}: "${wpString}"`, 'error');
          }
        }
      }
      setWaypointLatLngs(parsedWaypoints);

      console.log('Calculating route with DirectionsService...');

      const directionsService = new window.google.maps.DirectionsService();
      const googleWaypoints: google.maps.DirectionsWaypoint[] = parsedWaypoints.map((latLng) => ({
        location: latLng,
        stopover: true,
      }));

      directionsService.route(
        {
          origin: originCoords,
          destination: destinationCoords,
          travelMode: window.google.maps.TravelMode.DRIVING,
          waypoints: googleWaypoints,
          optimizeWaypoints: true,
          avoidHighways: false,
          avoidTolls: false,
        },
        (response, status) => {
          setIsCalculating(false);
          
          console.log('Directions API response:', status, response);
          
          if (status === 'OK' && response && response.routes?.[0]?.legs?.[0]) {
            setDirections(response);

            // Calculate total distance and duration across all legs
            let totalDistance = 0;
            let totalDuration = 0;
            
            response.routes[0].legs.forEach(leg => {
              if (leg.distance && leg.duration) {
                totalDistance += leg.distance.value;
                totalDuration += leg.duration.value;
              }
            });

            const distanceKm = totalDistance / 1000;
            const durationHours = totalDuration / 3600;
            
            const distanceText = `${distanceKm.toFixed(1)} km`;
            const durationText = `${Math.floor(durationHours)}h ${Math.floor((durationHours % 1) * 60)}m`;

            const weightNum = parseFloat(weight);
            
            // Original pricing calculation
            const weightFee = (weightNum * 350) / 50.0;
            const distanceFee = distanceKm * 220; // Fixed rate of 220 per km
            const total = distanceFee + weightFee;

            setResult({
              distance: distanceText,
              duration: durationText,
              cost: total.toFixed(2),
              distanceFee: distanceFee,
              weightFee: weightFee,
              total: total,
            });

            showToast('Route calculated successfully!', 'success');
          } else {
            console.error('Directions API failed:', status, response);
            
            let errorMessage = 'Failed to calculate route';
            switch (status) {
              case 'NOT_FOUND':
                errorMessage = 'One or more locations could not be reached by road.';
                break;
              case 'ZERO_RESULTS':
                errorMessage = 'No route could be found between these locations.';
                break;
              case 'MAX_WAYPOINTS_EXCEEDED':
                errorMessage = 'Too many waypoints. Please reduce the number of stops.';
                break;
              case 'INVALID_REQUEST':
                errorMessage = 'Invalid route request. Please check your inputs.';
                break;
              case 'OVER_QUERY_LIMIT':
                errorMessage = 'Service temporarily unavailable. Please try again later.';
                break;
              case 'REQUEST_DENIED':
                errorMessage = 'Route service denied. Please check API configuration.';
                break;
              default:
                errorMessage = 'Unable to calculate route. Please try again.';
            }
            
            showToast(errorMessage, 'error');
          }
        }
      );
    } catch (error: any) {
      setIsCalculating(false);
      console.error('calculate() error:', error);
      showToast(`Unexpected error: ${error?.message || 'Please try again'}`, 'error');
    }
  };

  const exportRoute = () => {
    const routeData = {
      origin,
      destination,
      waypoints,
      weight,
      result,
      timestamp: new Date().toISOString(),
    };
    
    const dataStr = JSON.stringify(routeData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `route-${Date.now()}.json`;
    link.click();
    URL.revokeObjectURL(url);
    
    showToast('Route exported successfully!', 'success');
  };

  const shareRoute = () => {
    const shareData = {
      title: 'Hauling Route',
      text: `Route from ${origin} to ${destination} - Distance: ${result.distance}, Cost: ₱${result.cost}`,
      url: window.location.href,
    };

    if (navigator.share) {
      navigator.share(shareData);
    } else {
      // Fallback: copy to clipboard
      navigator.clipboard.writeText(shareData.text);
      showToast('Route details copied to clipboard!', 'info');
    }
  };

  const onLoad = useCallback((map: google.maps.Map) => {
    const bounds = new window.google.maps.LatLngBounds(defaultCenter);
    map.fitBounds(bounds);
  }, []);

  const onOriginLoad = (autocomplete: google.maps.places.Autocomplete) => {
    originAutocompleteRef.current = autocomplete;
  };

  const onDestinationLoad = (autocomplete: google.maps.places.Autocomplete) => {
    destinationAutocompleteRef.current = autocomplete;
  };

  const onOriginPlaceChanged = () => {
    if (originAutocompleteRef.current) {
      const place = originAutocompleteRef.current.getPlace();
      if (place.formatted_address) {
        setOrigin(place.formatted_address);
      }
    }
  };

  const onDestinationPlaceChanged = () => {
    if (destinationAutocompleteRef.current) {
      const place = destinationAutocompleteRef.current.getPlace();
      if (place.formatted_address) {
        setDestination(place.formatted_address);
      }
    }
  };

  return (
    <div className="app-container">
      {toast && (
        <Toast 
          message={toast.message} 
          type={toast.type} 
          onClose={() => setToast(null)} 
        />
      )}

      <header className="app-header">
        <div className="header-content">
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
          <div className="header-actions">
            <button onClick={getCurrentLocation} className="location-btn">
              <svg width="16" height="16" viewBox="0 0 24 24" fill="currentColor">
                <path d="M12 8c-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4-1.79-4-4-4zm8.94 3A8.994 8.994 0 0 0 13 3.06V1h-2v2.06A8.994 8.994 0 0 0 3.06 11H1v2h2.06A8.994 8.994 0 0 0 11 20.94V23h2v-2.06A8.994 8.994 0 0 0 20.94 13H23v-2h-2.06zM12 19c-3.87 0-7-3.13-7-7s3.13-7 7-7 7 3.13 7 7-3.13 7-7 7z"/>
              </svg>
              Use Location
            </button>
          </div>
        </div>
      </header>

      <div className="map-background">
        {isLoaded ? (
          <GoogleMap
            mapContainerStyle={{ width: '100%', height: '100%' }}
            center={defaultCenter}
            zoom={10}
            onLoad={onLoad}
            options={{
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
                  stylers: [{ color: '#B3E5FC' }]
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
                  stylers: [{ color: '#FFF3E0' }]
                },
                {
                  featureType: 'road.highway',
                  elementType: 'geometry.stroke',
                  stylers: [{ color: '#00B69B', weight: 1 }]
                },
                {
                  featureType: 'landscape.natural',
                  elementType: 'geometry',
                  stylers: [{ color: '#E8F5E8' }]
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
            <svg width="64" height="64" viewBox="0 0 24 24" fill="none" stroke="#00B69B" strokeWidth="2" style={{ marginBottom: '16px' }}>
              <polygon points="1,6 1,22 8,18 16,22 23,18 23,2 16,6 8,2"/>
              <line x1="8" y1="2" x2="8" y2="18"/>
              <line x1="16" y1="6" x2="16" y2="22"/>
            </svg>
            <h3>Loading Google Maps...</h3>
            <p>Please wait while the map loads</p>
          </div>
        )}
      </div>

      <div className="bottom-panel">
        <div className="panel-content">
          <div className="panel-header">
            <h2>Route Calculator</h2>
            <p>Calculate hauling costs and plan optimal delivery routes</p>
          </div>
          
          <div className="form-grid">
            <div className="form-row">
              <div className="form-group">
                <label>Origin Location</label>
                {isLoaded ? (
                  <Autocomplete
                    onLoad={onOriginLoad}
                    onPlaceChanged={onOriginPlaceChanged}
                  >
                    <input
                      type="text"
                      placeholder="Enter address or coordinates"
                      value={origin}
                      onChange={(e) => setOrigin(e.target.value)}
                      className="form-input"
                    />
                  </Autocomplete>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter address or coordinates"
                    value={origin}
                    onChange={(e) => setOrigin(e.target.value)}
                    className="form-input"
                  />
                )}
              </div>
              
              <div className="form-group">
                <label>Destination</label>
                {isLoaded ? (
                  <Autocomplete
                    onLoad={onDestinationLoad}
                    onPlaceChanged={onDestinationPlaceChanged}
                  >
                    <input
                      type="text"
                      placeholder="Enter address or coordinates"
                      value={destination}
                      onChange={(e) => setDestination(e.target.value)}
                      className="form-input"
                    />
                  </Autocomplete>
                ) : (
                  <input
                    type="text"
                    placeholder="Enter address or coordinates"
                    value={destination}
                    onChange={(e) => setDestination(e.target.value)}
                    className="form-input"
                  />
                )}
              </div>
              
              <div className="form-group">
                <label>Weight (kg)</label>
                <input
                  type="number"
                  placeholder="Enter weight..."
                  value={weight}
                  onChange={(e) => setWeight(e.target.value)}
                  className="form-input"
                  min="0.1"
                  step="0.1"
                />
              </div>
            </div>

            {waypoints.length > 0 && (
              <div className="waypoints-section">
                <h3>Waypoints</h3>
                <div className="waypoints-grid">
                  {waypoints.map((wp, idx) => (
                    <div key={idx} className="waypoint-row">
                      <input
                        type="text"
                        placeholder={`Waypoint ${idx + 1} (address or coordinates)`}
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
                        aria-label={`Remove waypoint ${idx + 1}`}
                      >
                        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                          <line x1="18" y1="6" x2="6" y2="18"/>
                          <line x1="6" y1="6" x2="18" y2="18"/>
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
              </div>
            )}

            <div className="action-section">
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
                <button 
                  onClick={calculate} 
                  className="primary-btn"
                  disabled={isCalculating}
                >
                  {isCalculating ? (
                    <>
                      <div className="spinner" style={{ marginRight: '8px' }}></div>
                      Calculating...
                    </>
                  ) : (
                    <>
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" style={{ marginRight: '8px' }}>
                        <rect x="4" y="4" width="16" height="16" rx="2"/>
                        <rect x="9" y="9" width="6" height="6"/>
                        <line x1="9" y1="1" x2="9" y2="4"/>
                        <line x1="15" y1="1" x2="15" y2="4"/>
                        <line x1="9" y1="20" x2="9" y2="23"/>
                        <line x1="15" y1="20" x2="15" y2="23"/>
                      </svg>
                      Calculate Route
                    </>
                  )}
                </button>
              </div>

              {result.distance && (
                <div className="results-section">
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
                  
                  <div className="result-actions">
                    <button
                      onClick={() => setShowPriceBreakdown(!showPriceBreakdown)}
                      className="breakdown-btn"
                    >
                      {showPriceBreakdown ? 'Hide' : 'Show'} Breakdown
                    </button>
                    <button onClick={exportRoute} className="export-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4"/>
                        <polyline points="7,10 12,15 17,10"/>
                        <line x1="12" y1="15" x2="12" y2="3"/>
                      </svg>
                      Export
                    </button>
                    <button onClick={shareRoute} className="share-btn">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                        <circle cx="18" cy="5" r="3"/>
                        <circle cx="6" cy="12" r="3"/>
                        <circle cx="18" cy="19" r="3"/>
                        <line x1="8.59" y1="13.51" x2="15.42" y2="17.49"/>
                        <line x1="15.41" y1="6.51" x2="8.59" y2="10.49"/>
                      </svg>
                      Share
                    </button>
                  </div>

                  {showPriceBreakdown && (
                    <div className="price-breakdown">
                      <h4>Price Breakdown</h4>
                      <div className="breakdown-item">
                        <span>Distance Fee ({result.distance})</span>
                        <span>₱{result.distanceFee.toFixed(2)}</span>
                      </div>
                      <div className="breakdown-item">
                        <span>Weight Fee ({weight}kg)</span>
                        <span>₱{result.weightFee.toFixed(2)}</span>
                      </div>
                      <div className="breakdown-total">
                        <span>Total</span>
                        <span>₱{result.total.toFixed(2)}</span>
                      </div>
                    </div>
                  )}
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

export default App;