const http = require('http');

const postData = JSON.stringify({
  message: 'Hello from client!'
});

const options = {
  hostname: 'localhost',
  port: 36112,
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
    console.log('Response from server:', data);
  });
});

req.on('error', (e) => {
  console.error(`Request error: ${e.message}`);
});

req.write(postData);
req.end();
