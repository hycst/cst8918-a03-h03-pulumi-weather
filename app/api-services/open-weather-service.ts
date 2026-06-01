import { redis } from '../data-access/redis-connection'

const API_KEY = process.env.WEATHER_API_KEY
const TEN_MINUTES = 1000 * 60 * 10 // in milliseconds

interface FetchWeatherDataParams {
  lat: number
  lon: number
  units: string
}

export async function fetchWeatherData({
  lat,
  lon,
  units,
}: FetchWeatherDataParams) {
  const baseURL = 'https://api.openweathermap.org/data/2.5/weather'
  const queryString = `lat=${lat}&lon=${lon}&units=${units}`

  const cacheEntry = await redis.get(queryString)
  if (cacheEntry) {
    return JSON.parse(cacheEntry)
  }

  const response = await fetch(`${baseURL}?${queryString}&appid=${API_KEY}`)
  const data = await response.text()

  await redis.set(queryString, data, { PX: TEN_MINUTES })

  return JSON.parse(data)
}

export async function getGeoCoordsForPostalCode(
  postalCode: string,
  countryCode: string,
) {
  const url = `http://api.openweathermap.org/geo/1.0/zip?zip=${postalCode},${countryCode}&appid=${API_KEY}`
  const response = await fetch(url)
  const data = response.json()
  return data
}