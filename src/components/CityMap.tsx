import { useEffect, useMemo, useState } from 'react';
import { GoogleMap, InfoWindowF, MarkerF } from '@react-google-maps/api';
import { MapPin, Navigation } from 'lucide-react';
import type { Coordinates, Destination, PlaceCategory } from '../types/trip';
import { useGoogleMaps, useMapOptions } from '../hooks/useGoogleMaps';
import { categoryLabels, directionsUrl, formatFee } from '../utils/places';
import { pinAppearance, pinKinds } from '../utils/mapPins';

type Pin = { id: string; name: string; location: Coordinates; address?: string; category?: PlaceCategory; details: string; notes?: string; famousFor?: string; hotel: boolean; mustVisit: boolean };
function LoadedMap({ apiKey, destination }: { apiKey: string; destination: Destination }) {
  const { isLoaded, loadError } = useGoogleMaps(apiKey);
  const options = useMapOptions();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [activeId, setActiveId] = useState<string | null>(null);
  const pins = useMemo<Pin[]>(() => [
    ...(destination.hotels ?? []).flatMap((hotel, index) => hotel.location ? [{ id: `hotel-${index}`, name: hotel.name, location: hotel.location, address: hotel.address, notes: hotel.notes, famousFor: hotel.famousFor, details: 'Konaklama', hotel: true, mustVisit: false }] : []),
    ...destination.places.flatMap(place => place.location ? [{ id: `place-${place.id}`, name: place.name, location: place.location, address: place.address, notes: place.notes, famousFor: place.famousFor, category: place.category, details: `${categoryLabels[place.category]} · ${formatFee(place.fee)}${place.mustVisit ? ' · Mutlaka gidilmeli' : ''}${place.visited ? ' · Ziyaret edildi' : ''}`, hotel: false, mustVisit: place.mustVisit }] : []),
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
    {pins.map(pin => <MarkerF key={pin.id} position={pin.location} title={`${pin.name} — ${pinAppearance(pin.hotel, pin.mustVisit, pin.category).label}`} icon={pinAppearance(pin.hotel, pin.mustVisit, pin.category).icon} onClick={() => setActiveId(pin.id)}/>)}
    {active && <InfoWindowF position={active.location} onCloseClick={() => setActiveId(null)}><div className="map-popup"><strong>{active.name}</strong><p>{active.details}</p>{active.famousFor ? <p><b>Neyiyle meşhur?</b> {active.famousFor}</p> : <p>Meşhur olduğu özellik henüz eklenmedi.</p>}{active.address && <p>{active.address}</p>}{active.notes && <p>{active.notes}</p>}<a href={directionsUrl(active.location)} target="_blank" rel="noopener noreferrer"><Navigation size={14}/> Google Maps'te Yol Tarifi Al</a></div></InfoWindowF>}
  </GoogleMap>{!pins.length && <p className="map-hint">Otel veya mekan formunda haritadan bir konum seçerek ilk pinini ekle.</p>}{missing > 0 && <p className="map-hint">{missing} kaydın koordinatı eksik; konum eklemek için kaydı düzenleyebilirsin.</p>}<div className="map-legend">{Object.entries(pinKinds).filter(([key]) => key !== 'food-and-drink').map(([key, kind]) => <span key={key}>{kind.glyph} {kind.label}</span>)}<span>{pins.length} konum</span></div></>;
}
export default function CityMap({ destination }: { destination: Destination }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  if (!apiKey) return <div className="map-placeholder"><MapPin size={32}/><h3>Rotan haritada hayat bulsun.</h3><p>Haritayı açmak için Google Maps bağlantısını yapılandırın.</p></div>;
  return <LoadedMap key={destination.id} apiKey={apiKey} destination={destination}/>;
}
