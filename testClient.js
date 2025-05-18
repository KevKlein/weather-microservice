const http = require('http');

const postData = JSON.stringify({
  city: 'london',
  state: 'oh',
  country: 'usa',
  startDate: '2025-05-31',
  endDate: '2025-06-04'
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
