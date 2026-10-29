import { useEffect, useMemo, useState } from 'react';
import { GoogleMap, InfoWindowF, MarkerF, useJsApiLoader } from '@react-google-maps/api';
import { MapPin, Navigation } from 'lucide-react';
import type { Coordinates, Destination } from '../types/trip';
import { useTheme } from '../context/ThemeContext';
import { categoryLabels, directionsUrl, formatFee } from '../utils/places';

type Pin = { id: string; name: string; location: Coordinates; address?: string; details: string; notes?: string; hotel: boolean };
const mapOptions = { streetViewControl: false, mapTypeControl: false, fullscreenControl: true, maxZoom: 18, zoom: 5 };
function LoadedMap({ apiKey, destination }: { apiKey: string; destination: Destination }) {
  const { theme } = useTheme();
  const options = useMemo(() => ({ ...mapOptions, styles: theme === 'dark' ? [
    { elementType: 'geometry', stylers: [{ color: '#1e293b' }] },
    { elementType: 'labels.text.fill', stylers: [{ color: '#cbd5e1' }] },
    { elementType: 'labels.text.stroke', stylers: [{ color: '#0f172a' }] },
    { featureType: 'water', elementType: 'geometry', stylers: [{ color: '#0c2237' }] },
    { featureType: 'road', elementType: 'geometry', stylers: [{ color: '#334155' }] },
    { featureType: 'poi.park', elementType: 'geometry', stylers: [{ color: '#16352f' }] },
  ] : [] }), [theme]);
  const { isLoaded, loadError } = useJsApiLoader({ id: 'rota-google-map', googleMapsApiKey: apiKey, language: 'tr', region: 'TR' });
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const pins = useMemo<Pin[]>(() => [
    ...(destination.hotels ?? []).flatMap((hotel, index) => hotel.location ? [{ id: `hotel-${index}`, name: hotel.name, location: hotel.location, address: hotel.address, notes: hotel.notes, details: 'Konaklama', hotel: true }] : []),
    ...destination.places.flatMap(place => place.location ? [{ id: place.id, name: place.name, location: place.location, address: place.address, notes: place.notes, details: `${categoryLabels[place.category]} · ${formatFee(place.fee)}${place.mustVisit ? ' · Mutlaka gidilmeli' : ''}${place.visited ? ' · Ziyaret edildi' : ''}`, hotel: false }] : []),
  ], [destination]);
  const active = pins.find(pin => pin.id === activeId);
  useEffect(() => {
    if (!map) return;
    if (!pins.length) { map.setCenter({ lat: 39, lng: 35 }); map.setZoom(5); return; }
    if (pins.length === 1) { map.setCenter(pins[0].location); map.setZoom(14); }
    else { const bounds = new google.maps.LatLngBounds(); pins.forEach(pin => bounds.extend(pin.location)); map.fitBounds(bounds, 50); }
  }, [map, pins]);
  if (loadError) return <div className="map-placeholder" role="alert"><MapPin/><p>Harita yüklenemedi. Bağlantınızı ve Maps API yapılandırmasını kontrol edin.</p></div>;
  if (!isLoaded) return <div className="map-placeholder" role="status">Harita yükleniyor…</div>;
  const missing = (destination.hotels?.length ?? 0) + destination.places.length - pins.length;
  return <><GoogleMap mapContainerClassName="city-map" onLoad={setMap} onUnmount={() => setMap(null)} options={options}>
    {pins.map(pin => <MarkerF key={pin.id} position={pin.location} title={pin.name} label={pin.hotel ? 'H' : undefined} onClick={() => setActiveId(pin.id)}/>)}
    {active && <InfoWindowF position={active.location} onCloseClick={() => setActiveId(null)}><div className="map-popup"><strong>{active.name}</strong><p>{active.details}</p>{active.address && <p>{active.address}</p>}{active.notes && <p>{active.notes}</p>}<a href={directionsUrl(active.location)} target="_blank" rel="noopener noreferrer"><Navigation size={14}/> Google Maps Yol Tarifi Al</a></div></InfoWindowF>}
  </GoogleMap>{!pins.length && <p className="map-hint">Otel veya mekana koordinat eklediğinde haritada görünecek.</p>}{missing > 0 && <p className="map-hint">{missing} kaydın koordinatı eksik; haritada yalnızca konumu olan kayıtlar gösteriliyor.</p>}<div className="map-legend"><span>H · Otel</span><span>● Mekanlar</span><span>{pins.length} konum</span></div></>;
}
export default function CityMap({ destination }: { destination: Destination }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return <div className="map-placeholder"><MapPin size={32}/><h3>Rotan haritada hayat bulsun.</h3><p>Haritayı açmak için Google Maps bağlantısını yapılandırın.</p></div>;
  return <LoadedMap key={destination.id} apiKey={apiKey} destination={destination}/>;
}
