import { useMemo } from 'react';
import { useJsApiLoader, type Libraries } from '@react-google-maps/api';
import { useTheme } from '../context/ThemeContext';

// Every map shares the exact same loader options, including Places.
const libraries: Libraries = ['places'];
export function useGoogleMaps(apiKey: string) {
  return useJsApiLoader({ id: 'rota-google-map', googleMapsApiKey: apiKey, libraries, language: 'tr', region: 'TR', version: 'weekly' });
}
export function useMapOptions() {
  const { theme } = useTheme();
  return useMemo<google.maps.MapOptions>(() => ({ streetViewControl: false, mapTypeControl: false, fullscreenControl: true, maxZoom: 19, styles: theme === 'dark' ? [
    { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c2237' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#16352f' }] },
  ] : [] }), [theme]);
}
