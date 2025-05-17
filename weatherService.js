const  { createServer } = require('http');

const apiKey = '0af16c3db66bb3520fcd39ef0e56ba9a'; // openweathermap.org api key

/** Get lat and lon by geocoding location using https://www.openweathermap.org.
 *  Takes city, state, country as parameters. State and country may be blank.
 *  For country, use country code for best results. https://www.countrycode.org/
 */
async function getCoordData(city, state='', country='') {
    const url = `https://api.openweathermap.org/geo/1.0/direct?q=${city},${state},${country}&limit=1&appid=${apiKey}`
    try {
        const response = await fetch(url);
        if (!response.ok) throw new Error("Couldn't fetch weather data from online source");
        const data = await response.json();
        return data;
    } catch (error) {
        console.error("Error fetching weather data:", error);
        return null;
    }
}

const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/fetchWeatherData') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request to server' }));
    }

    // Get request payload
    let body = '';
    for await (const chunk of req) { body += chunk; }
    let payload;
    try {
        payload = JSON.parse(body);
        console.log("client sent: ", payload);
    } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }

    // Get coordinates
    let coordData = {}
    coordData = await getCoordData(payload.city, payload.state, payload.country);
    console.log("coords: ", coordData);

    const responseBody = JSON.stringify({
        coords: coordData
    });
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(responseBody);



});




const PORT = 36199;
server.listen(PORT, () => {
  console.log(`Microservice A - Weather Data Fetcher running at http://localhost:${PORT}`);
});
