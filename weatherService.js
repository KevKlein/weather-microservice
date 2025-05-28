const  { createServer } = require('http');

const apiKey = YOUR_API_KEY_HERE; // get an API key from openweathermap.org


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
        'precipitation_hours'
    ].join();
    const historicalMetrics = [
        'weather_code',
        'temperature_2m_max',
        'temperature_2m_min',
        'precipitation_sum',
        'precipitation_hours',
    ].join();

    // URLs
    const forecastURL = 
        `https://api.open-meteo.com/v1/forecast?`+
        `latitude=${lat}&longitude=${lon}` +
        `&daily=${forecastMetrics}&timezone=auto&forecast_days=14` +
        `&temperature_unit=fahrenheit&precipitation_unit=inch`;
    const historicalURL = 
        `https://archive-api.open-meteo.com/v1/archive?` +
        `latitude=${lat}&longitude=${lon}` +
        `&start_date=${pastYear(startDate)}&end_date=${pastYear(endDate)}` +
        `&daily=${historicalMetrics}&timezone=auto` +
        `&temperature_unit=fahrenheit&precipitation_unit=inch`;

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

/* Returns whether the given date string matches YYYY-MM-DD */
function isValidDate(dateStr) {
    const regex = /^\d{4}-\d{2}-\d{2}$/;
    return regex.test(dateStr);
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
        status: 'OK',
        tempMin: rawData.daily.temperature_2m_min[i],
        tempMax: rawData.daily.temperature_2m_max[i],
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
 * Return list of forecast entries in date range, 
 * with a dummy entry if there's no data for a date, like
 * {date: '2025-7-01', status: 'unavailable'} .
 */
function filterForecast(parsedForecast, startDate, endDate) {
    // Get range of dates
    const forecastByDay = new Map();
    parsedForecast.forEach(entry => {
        forecastByDay.set(entry.day, entry);
    });
    // For each date in range, include forecast entry if there is one, else dummy entry.
    const result = [];
    let current = new Date(startDate);
    const last = new Date(endDate);
    while (current <= last) {
        const dayStr = current.toISOString().split("T")[0]; // format: YYYY-MM-DD
        if (forecastByDay.has(dayStr)) {
            result.push(forecastByDay.get(dayStr));
        } else {
            result.push({ day: dayStr, status: "unavailable" });
        }
        current.setDate(current.getDate() + 1);
    }

    return result;
}



/**
 * Set up server
 */
const server = createServer(async (req, res) => {
    if (req.method !== 'POST' || req.url !== '/fetchWeatherData') {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid request to server' }));
    }

    // Parse request JSON, do some validation
    let body = '';
    for await (const chunk of req) { body += chunk; }
    let payload, city, state, country, startDate, endDate;
    try {
        payload = JSON.parse(body);
        ({ city, state, country, startDate, endDate } = payload)
        console.log(
            `Client sent - city: ${city}, state: ${state}, country: ${country}, ` +
            `startDate: ${startDate}, endDate: ${endDate}`);
        if (!city || !startDate || !endDate) {
            res.writeHead(400, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: 'Missing required field'}));
        }
        if (!isValidDate(startDate) || !isValidDate(endDate)){
            res.writeHead(404, { 'Content-Type': 'application/json' });
            return res.end(JSON.stringify({ error: `Invalid date format. Dates should be 'YYYY-MM'DD`}));
        }
    } catch (err) {
        res.writeHead(400, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: 'Invalid JSON' }));
    }

    // Geocode location via API
    let coordData = {};
    coordData = await getCoordData(city, state, country);
    if (!coordData || coordData.length === 0 || !coordData[0].lat || !coordData[0].lon) {
        res.writeHead(404, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: `Couldn't get coordinates for ${city}, ${state}, ${country}. Please check city/state/country.`}));
    }
    const { lat, lon } = coordData[0];

    // Get forecast and historical data via API
    let weatherData = {};
    weatherData = await getWeatherData(lat, lon, startDate, endDate)
    if (!weatherData || weatherData.length === 0 || !weatherData.forecast || !weatherData.history) {
        res.writeHead(500, { 'Content-Type': 'application/json' });
        return res.end(JSON.stringify({ error: "Error getting weather data."}));
    }

    // Parse weather data, only keep forecast data from dates in given range
    const parsedForecast = parseWeatherData(weatherData.forecast);
    const filteredForecast = filterForecast(parsedForecast, startDate, endDate);
    const parsedHistory = parseWeatherData(weatherData.history);

    // Send response back to client
    res.writeHead(200, { 'Content-Type': 'application/json' });
    responseBody = {
        location: coordData,
        forecast: filteredForecast,
        history: parsedHistory
    };
    console.log('Server sending: ', responseBody);
    res.end(JSON.stringify(responseBody));
    console.log('Awaiting request from client...\n');
    return;

});


/* Bind server to endpoint */
const PORT = 36199;
server.listen(PORT, () => {
    console.log(`Microservice A - Weather Service running at http://localhost:${PORT}`);
});
