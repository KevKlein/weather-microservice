const http = require('http');

/** 
 * ===Test client demonstrating how to call microservice===
 * Change the postData values for your query.
 * State and Country can be written out or abbreviated as state/country codes. 
 *   See https://www.countrycode.org/ for country codes.
 *   State is optional, leave as '' if not applicable.
 * Dates should be written in 'YYYY-MM-DD' format.
 * History data will be from the previous year (2024).
 * Forecast data for days beyond the next 14 days will be unavailable.
 *   Entries will thus have status: 'OK' or status: 'unavailable'.
*/
const postData = JSON.stringify({
  // Change these values for your query
  city: 'Corvallis',
  state: 'OR',
  country: 'US',
  startDate: '2025-06-01',
  endDate: '2025-06-02'
});

const options = {
  hostname: 'localhost',
  port: 36199,
  path: '/fetchWeatherData',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    if (res.statusCode !== 200) {
      try {
        const errObj = JSON.parse(data);
        console.error(`Server Error (${res.statusCode}):`, errObj.error || errObj);
      } catch {
        console.error(`Server Error (${res.statusCode}):`, data);
      }
      return;
    }

    let payload;
    try {
      payload = JSON.parse(data);
    } catch (err) {
      console.error('Failed to parse JSON from server:', data);
      return;
    }

    // Display results in the console
    console.log('Received from server: ');
    console.log('Location:', payload.location);
    console.log('Forecast:', payload.forecast);
    console.log('History :', payload.history);
  });
});


req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();
