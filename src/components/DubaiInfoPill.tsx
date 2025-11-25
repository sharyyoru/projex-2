"use client";

import { useEffect, useState } from "react";

type WeatherData = {
  temperature: number;
  weatherCode: number;
};

function getWeatherIcon(code: number): string {
  // WMO Weather interpretation codes
  if (code === 0) return "☀️"; // Clear sky
  if (code === 1 || code === 2 || code === 3) return "⛅"; // Partly cloudy
  if (code >= 45 && code <= 48) return "🌫️"; // Fog
  if (code >= 51 && code <= 55) return "🌧️"; // Drizzle
  if (code >= 56 && code <= 57) return "🌧️"; // Freezing drizzle
  if (code >= 61 && code <= 65) return "🌧️"; // Rain
  if (code >= 66 && code <= 67) return "🌧️"; // Freezing rain
  if (code >= 71 && code <= 77) return "❄️"; // Snow
  if (code >= 80 && code <= 82) return "🌦️"; // Rain showers
  if (code >= 85 && code <= 86) return "🌨️"; // Snow showers
  if (code >= 95 && code <= 99) return "⛈️"; // Thunderstorm
  return "🌤️";
}

function getWeatherLabel(code: number): string {
  if (code === 0) return "Clear";
  if (code === 1 || code === 2 || code === 3) return "Partly Cloudy";
  if (code >= 45 && code <= 48) return "Foggy";
  if (code >= 51 && code <= 67) return "Rainy";
  if (code >= 71 && code <= 77) return "Snowy";
  if (code >= 80 && code <= 82) return "Showers";
  if (code >= 85 && code <= 86) return "Snow Showers";
  if (code >= 95 && code <= 99) return "Thunderstorm";
  return "Cloudy";
}

export default function DubaiInfoPill() {
  const [time, setTime] = useState<string>("");
  const [date, setDate] = useState<string>("");
  const [weather, setWeather] = useState<WeatherData | null>(null);

  // Update time every second
  useEffect(() => {
    function updateDateTime() {
      const now = new Date();
      // Dubai is UTC+4
      const dubaiTime = new Date(
        now.toLocaleString("en-US", { timeZone: "Asia/Dubai" })
      );

      const timeStr = dubaiTime.toLocaleTimeString("en-US", {
        hour: "2-digit",
        minute: "2-digit",
        second: "2-digit",
        hour12: true,
      });

      const dateStr = dubaiTime.toLocaleDateString("en-US", {
        weekday: "short",
        month: "short",
        day: "numeric",
      });

      setTime(timeStr);
      setDate(dateStr);
    }

    updateDateTime();
    const interval = setInterval(updateDateTime, 1000);

    return () => clearInterval(interval);
  }, []);

  // Fetch weather from Open-Meteo (free, no API key)
  useEffect(() => {
    let cancelled = false;

    async function fetchWeather() {
      try {
        // Dubai coordinates: 25.2048, 55.2708
        const response = await fetch(
          "https://api.open-meteo.com/v1/forecast?latitude=25.2048&longitude=55.2708&current=temperature_2m,weather_code&timezone=Asia%2FDubai"
        );

        if (!response.ok) return;

        const data = await response.json();

        if (cancelled) return;

        if (data?.current) {
          setWeather({
            temperature: Math.round(data.current.temperature_2m),
            weatherCode: data.current.weather_code,
          });
        }
      } catch {
        // Silently fail - weather is optional
      }
    }

    void fetchWeather();

    // Refresh weather every 10 minutes
    const interval = setInterval(fetchWeather, 10 * 60 * 1000);

    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="mb-1 inline-flex items-center gap-2 rounded-full bg-gradient-to-r from-amber-50 to-sky-50 px-3 py-1 text-[11px] font-medium text-slate-700 shadow-sm">
      <span className="flex items-center gap-1">
        <svg
          className="h-3 w-3 text-amber-500"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <path d="M20 10c0 6-8 12-8 12s-8-6-8-12a8 8 0 1 1 16 0Z" />
          <circle cx="12" cy="10" r="3" />
        </svg>
        <span className="font-semibold text-amber-700">Today in Dubai</span>
      </span>
      <span className="text-slate-400">•</span>
      <span className="text-slate-600">{date}</span>
      <span className="text-slate-400">•</span>
      <span className="font-mono text-sky-700">{time}</span>
      {weather ? (
        <>
          <span className="text-slate-400">•</span>
          <span className="flex items-center gap-1">
            <span className="text-sm">{getWeatherIcon(weather.weatherCode)}</span>
            <span className="font-semibold text-slate-700">
              {weather.temperature}°C
            </span>
            <span className="text-slate-500">{getWeatherLabel(weather.weatherCode)}</span>
          </span>
        </>
      ) : null}
    </div>
  );
}
