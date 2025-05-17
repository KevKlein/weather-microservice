const  { createServer } = require('http');
const Geocodio = require('geocodio-library-node');

const apiKey = 'dac6d882a65a5f876a7728ec8faaa5ddc82afaf';
const geocoder = new Geocodio(apiKey); // const geocoder = new Geocodio(apiKey, 'api.enterprise.geocod.io'); // optionally overwrite the API hostname

const server = createServer((req, res) => {
    if (req.method === 'POST' && req.url === '/fetchWeatherData') {
        let body = '';
        req.on('data', chunk => { body += chunk; });
        req.on('end', () => {
            try {
                console.log(body); // debug
                const data = JSON.parse(body);
                const clientMessage = data.message || 'Client sent no message';

                geocoder
                    .geocode('1109 N Highland St, Arlington, VA')
                    .then(response => {
                        console.log("geocode resp: ", response);
                    })

                    .catch(error => {
                        console.error(error);
                    });

                const response = {
                    reply: `Server received: "${clientMessage}"`
                };

                res.writeHead(200, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify(response));

            } catch (err) {
                res.writeHead(400, { 'Content-Type': 'application/json' });
                res.end(JSON.stringify({ error: 'Invalid JSON' }));
            }
        });
    } else {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request to server' }));
    }
});




const PORT = 36112;
server.listen(PORT, () => {
  console.log(`Microservice A - Weather Data Fetcher running at http://localhost:${PORT}`);
});
