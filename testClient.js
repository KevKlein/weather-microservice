const http = require('http');

const postData = JSON.stringify({
  city: 'oxford',
  state: '',
  country: 'united kingdom',
  date: 'May 18, 2025'
});

const options = {
  hostname: 'localhost',
  port: 36199,
  path: '/fetchWeatherData',
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    // 'Content-Length': Buffer.byteLength(postData)
  }
};

const req = http.request(options, (res) => {
  let data = '';
  res.on('data', chunk => { data += chunk; });
  res.on('end', () => {
    const response = JSON.parse(data);
    console.log('Response from server:', response);
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();
