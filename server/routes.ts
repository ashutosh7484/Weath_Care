import type { Express } from "express";
import { createServer } from "http";
import { storage } from "./storage";
import OpenAI from "openai";
import { WeatherData } from "@shared/types";

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });

export async function registerRoutes(app: Express) {
  // Config endpoint
  app.get("/api/config", (req, res) => {
    res.json({
      OPENWEATHER_API_KEY: process.env.OPENWEATHER_API_KEY,
    });
  });
  app.get("/api/config", (req, res) => {
    res.json({
      OPENWEATHER_API_KEY: "b6c80afe73fe8301f2295cc4b9b18896",
    });
  });
  
  // Weather endpoints
  app.get("/api/weather", async (req, res) => {
    try {
      const { lat, lon } = req.query;

      // Validate lat/lon parameters
      if (!lat || !lon || typeof lat !== 'string' || typeof lon !== 'string') {
        return res.status(400).json({ 
          error: "Missing or invalid latitude/longitude parameters" 
        });
      }

      const weatherApiKey = process.env.OPENWEATHER_API_KEY;

      // Fetch current weather and forecast in parallel
      const [currentWeather, forecast] = await Promise.all([
        fetch(
          `https://api.openweathermap.org/data/2.5/weather?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=metric`
        ),
        fetch(
          `https://api.openweathermap.org/data/2.5/forecast?lat=${lat}&lon=${lon}&appid=${weatherApiKey}&units=metric`
        )
      ]);

      if (!currentWeather.ok || !forecast.ok) {
        throw new Error(`Weather API error: ${currentWeather.statusText || forecast.statusText}`);
      }

      const [currentData, forecastData] = await Promise.all([
        currentWeather.json(),
        forecast.json()
      ]);

      // Transform the OpenWeather response into our WeatherData format
      const weatherData: WeatherData = {
        location: currentData.name,
        coordinates: {
          lat: Number(lat),
          lon: Number(lon)
        },
        current: {
          temp: Math.round(currentData.main.temp),
          humidity: currentData.main.humidity,
          conditions: currentData.weather[0].main.toLowerCase(),
          aqi: 50, // Default AQI since it's not available in the free tier
          precipitation: currentData.rain ? currentData.rain['1h'] || 0 : 0,
          windSpeed: Math.round(currentData.wind.speed),
          pressure: currentData.main.pressure,
          feelsLike: Math.round(currentData.main.feels_like),
          visibility: Math.round(currentData.visibility / 1000), // Convert to kilometers
        },
        forecast: forecastData.list
          .filter((_: any, index: number) => index % 8 === 0) // Get one forecast per day
          .slice(0, 5) // Limit to 5 days
          .map((item: any) => ({
            date: item.dt_txt.split(" ")[0],
            temp: Math.round(item.main.temp),
            conditions: item.weather[0].main.toLowerCase(),
            precipitation: item.rain ? item.rain['3h'] || 0 : 0,
            windSpeed: Math.round(item.wind.speed),
            humidity: item.main.humidity,
          })),
      };

      res.json(weatherData);
    } catch (error) {
      console.error("Weather API Error:", error);
      res.status(500).json({ error: "Failed to fetch weather data" });
    }
  });

  // Health recommendations
  app.get("/api/health-recommendations", async (req, res) => {
    try {
      // Add rate limiting protection
      // TODO: Implement proper rate limiting middleware

      const completion = await openai.chat.completions.create({
        // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: "Generate health recommendations based on current weather conditions"
          }
        ],
        response_format: { type: "json_object" }
      });

      const content = completion.choices[0].message.content;
      if (!content) {
        throw new Error("Empty response from OpenAI");
      }

      res.json(JSON.parse(content));
    } catch (error) {
      console.error("OpenAI API Error:", error);

      // Handle rate limiting specifically
      if ((error as any).code === 'insufficient_quota' || (error as any).status === 429) {
        // Return fallback recommendations when API is unavailable
        return res.json({
          recommendations: [
            {
              type: "general",
              title: "Stay Hydrated",
              description: "Maintain proper hydration throughout the day",
              severity: "medium",
              actions: [
                "Drink water regularly",
                "Monitor urine color",
                "Increase intake during physical activity"
              ]
            },
            {
              type: "activity",
              title: "Weather-Appropriate Exercise",
              description: "Adjust your activities based on current weather conditions",
              severity: "low",
              actions: [
                "Choose indoor activities during extreme weather",
                "Wear appropriate clothing",
                "Listen to your body's signals"
              ]
            },
            {
              type: "protection",
              title: "Weather Protection",
              description: "Protect yourself from current weather conditions",
              severity: "medium",
              actions: [
                "Use appropriate sun protection",
                "Wear weather-appropriate clothing",
                "Stay informed about weather changes"
              ]
            }
          ]
        });
      }

      res.status(500).json({ error: "Failed to generate recommendations" });
    }
  });

  // Chat endpoint
  app.post("/api/chat", async (req, res) => {
    try {
      const { message, context } = req.body;

      const completion = await openai.chat.completions.create({
        // the newest OpenAI model is "gpt-4o" which was released May 13, 2024
        model: "gpt-4o",
        messages: [
          {
            role: "system",
            content: `You are a helpful weather and health advisor. Current weather context:
            Temperature: ${context.weather.temperature}°C
            Conditions: ${context.weather.conditions}
            Humidity: ${context.weather.humidity}%

            Provide relevant health and weather-related advice based on these conditions.`
          },
          {
            role: "user",
            content: message
          }
        ]
      });

      const response = completion.choices[0].message.content;
      if (!response) {
        throw new Error("Empty response from OpenAI");
      }

      res.json({ response });
    } catch (error) {
      console.error("OpenAI Chat API Error:", error);

      // Handle rate limiting specifically
      if ((error as any).code === 'insufficient_quota' || (error as any).status === 429) {
        return res.status(429).json({ 
          error: "Service temporarily unavailable. Please try again later." 
        });
      }

      res.status(500).json({ error: "Failed to process chat message" });
    }
  });

  const httpServer = createServer(app);
  return httpServer;
}