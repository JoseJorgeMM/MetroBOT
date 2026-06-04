export interface NewsItem {
  title: string;
  pubDate: string;
  link: string;
  guid: string;
  author: string;
  thumbnail: string;
  description: string;
  content: string;
}

export async function fetchMetroNews(): Promise<NewsItem[]> {
  try {
    // Usamos Google News RSS filtrado por "Metro de Medellín" y lo pasamos por un convertidor RSS a JSON gratuito
    const query = encodeURIComponent('Metro de Medellín');
    const rssUrl = `https://news.google.com/rss/search?q=${query}&hl=es-419&gl=CO&ceid=CO:es-419`;
    const apiUrl = `https://api.rss2json.com/v1/api.json?rss_url=${encodeURIComponent(rssUrl)}`;

    const response = await fetch(apiUrl);
    if (!response.ok) throw new Error('Error al obtener noticias');
    
    const data = await response.json();
    if (data.status === 'ok') {
      return data.items;
    }
    return [];
  } catch (error) {
    console.error('Error fetching news:', error);
    return [];
  }
}
