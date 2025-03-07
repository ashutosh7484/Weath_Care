export interface WeatherData {
  location: string;
  coordinates: {
    lat: number;
    lon: number;
  };
  current: {
    temp: number;
    humidity: number;
    conditions: string;
    aqi: number;
    precipitation: number;
    windSpeed: number;
    pressure: number;
    feelsLike: number;
    visibility: number;
  };
  forecast: Array<{
    date: string;
    temp: number;
    conditions: string;
    precipitation: number;
    windSpeed: number;
    humidity: number;
  }>;
}

export interface HealthRecommendation {
  type: string;
  title: string;
  description: string;
  severity: "low" | "medium" | "high";
  actions: string[];
}

export interface AIResponse {
  recommendations: HealthRecommendation[];
  dietarySuggestions: {
    meals: string[];
    hydration: string;
    supplements?: string[];
  };
}