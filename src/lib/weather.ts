export interface WeatherData {
  temperature: number;
  weatherCode: number;
  isRaining: boolean;
  description: string;
}

export async function fetchMedellinWeather(): Promise<WeatherData | null> {
  try {
    // Coordenadas de Medellín: 6.2442, -75.5812
    const url = 'https://api.open-meteo.com/v1/forecast?latitude=6.2442&longitude=-75.5812&current=temperature_2m,weather_code&timezone=auto';
    const response = await fetch(url);
    if (!response.ok) return null;
    
    const data = await response.json();
    const code = data.current.weather_code;
    
    // WMO Weather interpretation codes (WW)
    // 51, 53, 55: Drizzle
    // 61, 63, 65: Rain
    // 80, 81, 82: Rain showers
    // 95, 96, 99: Thunderstorm
    const isRaining = [51, 53, 55, 61, 63, 65, 80, 81, 82, 95, 96, 99].includes(code);
    
    let description = 'Cielo despejado';
    if (code === 1 || code === 2 || code === 3) description = 'Parcialmente nublado';
    if (code >= 45 && code <= 48) description = 'Neblina';
    if (isRaining) description = 'Lluvia / Tormenta';

    return {
      temperature: data.current.temperature_2m,
      weatherCode: code,
      isRaining,
      description
    };
  } catch (error) {
    console.error('Error fetching weather:', error);
    return null;
  }
}
