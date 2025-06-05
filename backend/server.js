// backend/server.js

require('dotenv').config();
const express = require('express');
const cors = require('cors');
const axios = require('axios');

const app = express();
app.use(cors());
app.use(express.json());

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
console.log('Loaded env, API_KEY:', API_KEY ? '✓ present' : '✗ missing');

app.post('/calculate-cost', async (req, res) => {
  console.log('POST /calculate-cost body:', req.body);
  const { origin, destination, ratePerKm } = req.body;

  // Fallback to default if not sent:
  const kmRate = typeof ratePerKm === 'number' ? ratePerKm : 220;

  try {
    // 1. Call Distance Matrix API to get numeric distance in meters
    const response = await axios.get(
      'https://maps.googleapis.com/maps/api/distancematrix/json',
      {
        params: { origins: origin, destinations: destination, key: API_KEY },
      }
    );

    const element = response.data.rows[0].elements[0];
    if (element.status !== 'OK') {
      return res.status(400).json({ message: 'Could not get distance from Google.' });
    }

    const distanceMeters = element.distance.value;   // e.g. 14700
    const distanceKm = distanceMeters / 1000;        // e.g. 14.7

    // 2. Compute distance fee and total (no weight fee)
    const distanceFee = distanceKm * kmRate;         // e.g. 14.7 * 220
    const totalCost = distanceFee;

    console.log(
      `Computed: distanceKm=${distanceKm.toFixed(2)}, distanceFee=${distanceFee.toFixed(2)}`
    );

    // 3. Return distanceKm, distanceFee, totalCost
    return res.json({
      distanceKm: distanceKm.toFixed(2),   // "14.70"
      distanceFee: distanceFee.toFixed(2), // "3234.00"
      totalCost: totalCost.toFixed(2),     // "3234.00"
    });
  } catch (err) {
    console.error('Error in /calculate-cost:', err.response?.data || err.message);
    return res.status(500).json({ message: 'Server error calculating cost.' });
  }
});

app.listen(5000, () => console.log('Backend running on port 5000'));
