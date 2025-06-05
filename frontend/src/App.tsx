// src/App.tsx

import React, { useState, useCallback } from 'react';
import {
  GoogleMap,
  Marker,
  DirectionsRenderer,
  useJsApiLoader,
} from '@react-google-maps/api';

const defaultCenter = { lat: 14.5995, lng: 120.9842 };

// Fixed rates:
const RATE_PER_KM = 220;      // ₱220 per km
const FEE_PER_50_KG = 350;    // ₱350 per 50 kg → ₱(350/50)=₱7 per kg if prorated

function App() {
  // ─── State Declarations ───
  const [origin, setOrigin] = useState('');
  const [destination, setDestination] = useState('');
  const [weight, setWeight] = useState('');               // Weight in kg (string from input)
  const [waypoints, setWaypoints] = useState<string[]>([]);

  const [result, setResult] = useState({
    distance: '',    // e.g. "6.9 km"
    duration: '',    // e.g. "22 mins"
    cost: '',        // final cost string, e.g. "1838.40"
  });

  const [directions, setDirections] = useState<google.maps.DirectionsResult | null>(null);
  const [originLatLng, setOriginLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [destinationLatLng, setDestinationLatLng] = useState<google.maps.LatLngLiteral | null>(null);
  const [waypointLatLngs, setWaypointLatLngs] = useState<google.maps.LatLngLiteral[]>([]);

  // ─── Load Google Maps API ───
  const { isLoaded } = useJsApiLoader({
    googleMapsApiKey: process.env.REACT_APP_GOOGLE_MAPS_API_KEY!,
  });

  // ─── Calculate total cost ───
  const calculate = async () => {
    try {
      // 1. Parse origin & destination coordinates
      const [oLat, oLng] = origin.split(',').map((s) => parseFloat(s.trim()));
      const [dLat, dLng] = destination.split(',').map((s) => parseFloat(s.trim()));
      if (
        isNaN(oLat) || isNaN(oLng) ||
        isNaN(dLat) || isNaN(dLng)
      ) {
        alert('Please enter valid coordinates in the format "lat,lng".');
        return;
      }
      setOriginLatLng({ lat: oLat, lng: oLng });
      setDestinationLatLng({ lat: dLat, lng: dLng });

      // 2. Parse optional waypoints
      const parsedWaypoints: google.maps.LatLngLiteral[] = [];
      for (const wpString of waypoints) {
        const [wLat, wLng] = wpString.split(',').map((s) => parseFloat(s.trim()));
        if (!isNaN(wLat) && !isNaN(wLng)) {
          parsedWaypoints.push({ lat: wLat, lng: wLng });
        }
      }
      setWaypointLatLngs(parsedWaypoints);

      // 3. Use Google Maps DirectionsService to get route
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

            // Extract text and numeric distance:
            const distanceText   = leg0.distance.text;    // e.g. "6.9 km"
            const durationText   = leg0.duration.text;    // e.g. "22 mins"
            const distanceMeters = leg0.distance.value;   // e.g. 6900
            const distanceKm     = distanceMeters / 1000; // e.g. 6.9

            // 4. Parse and validate weight input
            const weightNum = parseFloat(weight);
            if (isNaN(weightNum) || weightNum <= 0) {
              alert('Please enter a valid positive number for weight (kg).');
              return;
            }

            // 5. Compute weight fee:
            // Pro-rated: ₱(FEE_PER_50_KG / 50) per kg:
            const weightFee = (weightNum * FEE_PER_50_KG) / 50.0;
            // If you want discrete 50 kg blocks (round up), uncomment:
            // const blocks = Math.ceil(weightNum / 50.0);
            // const weightFee = blocks * FEE_PER_50_KG;

            // 6. Compute distance fee:
            const distanceFee = distanceKm * RATE_PER_KM; // e.g. 6.9 * 220 = ₱1 518.00

            // 7. Total cost = distanceFee + weightFee
            const total = distanceFee + weightFee;
            const totalString = total.toFixed(2);         // e.g. "1838.40"

            // 8. Update state
            setResult({
              distance: distanceText,
              duration: durationText,
              cost: totalString,
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

  // ─── Map onLoad callback ───
  const onLoad = useCallback((map: google.maps.Map) => {
    const bounds = new window.google.maps.LatLngBounds(defaultCenter);
    map.fitBounds(bounds);
  }, []);

  // ─── JSX Render ───
  return (
    <div className="max-w-5xl mx-auto p-4">
      <h1 className="text-2xl font-bold">Hauling Cost Calculator</h1>

      <div className="flex flex-col md:flex-row gap-4 mt-4">
        {/* ─── Input Panel ─── */}
        <div className="flex-1">
          {/* Origin */}
          <input
            className="border p-2 w-full mb-2"
            placeholder="Origin (lat,lng) — e.g. 14.5995,120.9842"
            value={origin}
            onChange={(e) => setOrigin(e.target.value)}
          />

          {/* Destination */}
          <input
            className="border p-2 w-full mb-2"
            placeholder="Destination (lat,lng) — e.g. 14.6760,121.0437"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
          />

          {/* Weight (kg) */}
          <input
            className="border p-2 w-full mb-2"
            type="number"
            placeholder="Weight (kg)"
            value={weight}
            onChange={(e) => setWeight(e.target.value)}
          />

          {/* Waypoints (optional) */}
          <div className="mb-2">
            <p className="font-semibold">Waypoints (optional):</p>
            {waypoints.map((wp, idx) => (
              <div key={idx} className="flex gap-2 mb-1">
                <input
                  className="border p-2 flex-1"
                  placeholder={`Waypoint ${idx + 1} (lat,lng)`}
                  value={wp}
                  onChange={(e) => {
                    const arr = [...waypoints];
                    arr[idx] = e.target.value;
                    setWaypoints(arr);
                  }}
                />
                <button
                  className="text-red-500 px-2"
                  onClick={() => setWaypoints(waypoints.filter((_, i) => i !== idx))}
                >
                  ×
                </button>
              </div>
            ))}
            {waypoints.length < 3 && (
              <button
                className="text-blue-500 text-sm"
                onClick={() => setWaypoints([...waypoints, ''])}
              >
                + Add waypoint
              </button>
            )}
          </div>

          {/* Calculate Button */}
          <button className="bg-blue-500 text-white p-2 w-full" onClick={calculate}>
            Calculate
          </button>

          {/* Result Display */}
          {result.distance && (
            <div className="mt-4 space-y-1">
              <p>
                <strong>Distance:</strong> {result.distance}
              </p>
              <p>
                <strong>Duration:</strong> {result.duration}
              </p>
              <p className="font-bold">
                <strong>Total Cost (₱):</strong> {result.cost}
              </p>
            </div>
          )}
        </div>

        {/* ─── Map Panel ─── */}
        <div className="flex-1">
          {isLoaded ? (
            <GoogleMap
              mapContainerStyle={{ width: '100%', height: '400px' }}
              center={defaultCenter}
              zoom={10}
              onLoad={onLoad}
            >
              {/* Route Polyline */}
              {directions && <DirectionsRenderer directions={directions} />}

              {/* Origin Marker (A) */}
              {originLatLng && (
                <Marker
                  position={originLatLng}
                  label="A"
                  icon={{
                    url: 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi2_hdpi.png',
                    scaledSize: new window.google.maps.Size(30, 30),
                  }}
                />
              )}

              {/* Destination Marker (B) */}
              {destinationLatLng && (
                <Marker
                  position={destinationLatLng}
                  label="B"
                  icon={{
                    url: 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi-dotless2_hdpi.png',
                    scaledSize: new window.google.maps.Size(30, 30),
                  }}
                />
              )}

              {/* Waypoint Markers */}
              {waypointLatLngs.map((latLng, idx) => (
                <Marker
                  key={idx}
                  position={latLng}
                  label={`${idx + 1}`}
                  icon={{
                    url: 'https://maps.gstatic.com/mapfiles/api-3/images/spotlight-poi.png',
                    scaledSize: new window.google.maps.Size(25, 25),
                  }}
                />
              ))}
            </GoogleMap>
          ) : (
            <p>Loading map...</p>
          )}
        </div>
      </div>
    </div>
  );
}

export default App;
