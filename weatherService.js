const  { createServer } = require('http');

const apiKey = '0af16c3db66bb3520fcd39ef0e56ba9a'; // openweathermap.org API key

/** Get lat and lon by geocoding location using https://www.openweathermap.org.
 *  Takes city, state, country as parameters. State and country can be blank.
 *  State and country can be written out, or abbreviated to state code
 *  and country code. https://www.countrycode.org/
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

/**
 * Get forecast for given dates and historical data for a year prior.
 * Uses data from https://open-meteo.com.
 * Takes latitude, longitude, starting date, ending date as parameters.
 * Only returns forecast for dates up to 16 days in the future. If no such
 * days are within the date range, forecast data will be [].
 * Dates should be in format 'YYYY-MM-DD'.
 * citation: https://www.seanmcp.com/articles/await-multiple-promises-in-javascript/
 */
async function getWeatherData(lat, lon, startDate, endDate) {
    // Weather data metrics to be fetched
    const forecastMetrics = [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_probability_max',
        'precipitation_sum',
        'precipitation_hours',
        'apparent_temperature_max',
        'apparent_temperature_min'
    ].join();
    const historicalMetrics = [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_hours',
        'apparent_temperature_max',
        'apparent_temperature_min'
    ].join();

    // URLs
    const forecastURL = 
        `https://api.open-meteo.com/v1/forecast?`+
        `latitude=${lat}&longitude=${lon}` +
        `&daily=${forecastMetrics}&timezone=auto&forecast_days=14`;
    const historicalURL = 
        `https://archive-api.open-meteo.com/v1/archive?` +
        `latitude=${lat}&longitude=${lon}` +
        `&start_date=${pastYear(startDate)}&end_date=${pastYear(endDate)}` +
        `&daily=${historicalMetrics}&timezone=auto`;

    // Fetch weather data
    try {
        const [forecastResp, historicalResp] = await Promise.all([
            fetch(forecastURL), 
            fetch(historicalURL)
        ]);
        if (!forecastResp.ok || !historicalResp.ok) {
            throw new Error('Weather fetch failed');
        }
        const [forecastData, historicalData] = await Promise.all([
            forecastResp.json(),
            historicalResp.json()
        ]);
        return { forecast: forecastData, history: historicalData };
    } catch (error) {
        console.error("Error:", error);
        return null;
    }
}

/** 
 * Returns the given date but with the year prior to now. 
 * Date should be in YYYY-MM-DD format.
 */
function pastYear(date) {
    const  prevYear = new Date().getFullYear() - 1;
    return [prevYear, date.substring(4)].join('');
}

/* Parse raw weather data. */
function parseWeatherData(rawData) {
    const days = rawData.daily.time;
    const data = days.map((day, i) => ({
        day,
        tempMin: rawData.daily.temperature_2m_min[i],
        tempMax: rawData.daily.temperature_2m_max[i],
        apparentTempMin: rawData.daily.apparent_temperature_min[i],
        apparentTempMax: rawData.daily.apparent_temperature_max[i],
        weatherCode: rawData.daily.weather_code[i],
        precipSum: rawData.daily.precipitation_sum[i],
        precipHours: rawData.daily.precipitation_hours[i],
        ...( 'precipitation_probability_max' in rawData.daily
            ? { precipChance: rawData.daily.precipitation_probability_max[i] }
            : {}
        )
    }));
    return data;
}


/**
 * Set up server
 */
const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/fetchWeatherData') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        res.end(JSON.stringify({ error: 'Invalid request to server' }));
    }

    // Parse request JSON
    let body = '';
    for await (const chunk of req) { body += chunk; }
    let payload;
    try {
        payload = JSON.parse(body);
        console.log("client sent: ", payload);
    } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }

    // Geocode location via API
    let coordData = {};
    coordData = await getCoordData(payload.city, payload.state, payload.country);
    // console.log("coords: ", coordData);
    if (!coordData || coordData.length === 0) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end("Error geocoding location.");
    }
    const { lat, lon } = coordData[0];

    // Get forecast and historical data via API
    let weatherData = {};
    // console.log("coordData: ", lat, lon, payload.startDate, payload.endDate);
    weatherData = await getWeatherData(lat, lon, payload.startDate, payload.endDate)
    if (!weatherData || weatherData.length === 0) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end("Error getting weather data.");
    }

    // Parse weather data, only keep forecast data from dates in given range
    const parsedForecast = parseWeatherData(weatherData.forecast);
    const filteredForecast = parsedForecast.filter((row) => (payload.startDate <= row.day && row.day <= payload.endDate));
    console.log('parsedForecast: ', parsedForecast);
    console.log('filteredForecast: ', filteredForecast);
    const parsedHistory = parseWeatherData(weatherData.history);

    // Send response back to client
    res.writeHead(200, { 'Content-Type': 'application/json' });
    return res.end(JSON.stringify({
        location: coordData,
        forecast: filteredForecast,
        history: parsedHistory
    }));
});


// Bind server to endpoint
const PORT = 36199;
server.listen(PORT, () => {
  console.log(`Microservice A - Weather Service running at http://localhost:${PORT}`);
});
