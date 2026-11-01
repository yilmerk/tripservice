import { useEffect, useId, useRef, useState } from 'react';
import { GoogleMap, MarkerF } from '@react-google-maps/api';
import type { Coordinates } from '../types/trip';
import { useGoogleMaps, useMapOptions } from '../hooks/useGoogleMaps';

export interface LocationValue { address: string; lat: string; lng: string }
export const locationValue = (address = '', location?: Coordinates): LocationValue => ({ address, lat: location ? String(location.lat) : '', lng: location ? String(location.lng) : '' });
function validLocation(value: LocationValue): Coordinates | undefined {
  if (!value.lat.trim() || !value.lng.trim()) return;
  const lat = Number(value.lat); const lng = Number(value.lng);
  return Number.isFinite(lat) && Number.isFinite(lng) && Math.abs(lat) <= 90 && Math.abs(lng) <= 180 ? { lat, lng } : undefined;
}
type Props = { value: LocationValue; onChange: (value: LocationValue) => void; onPendingChange: (pending: boolean) => void; disabled: boolean };
function LoadedPicker({ apiKey, value, onChange, onPendingChange, disabled }: Props & { apiKey: string }) {
  const { isLoaded, loadError } = useGoogleMaps(apiKey);
  const options = useMapOptions();
  const [map, setMap] = useState<google.maps.Map | null>(null);
  const [query, setQuery] = useState('');
  const [suggestions, setSuggestions] = useState<google.maps.places.PlacePrediction[]>([]);
  const [active, setActive] = useState(-1);
  const [error, setError] = useState('');
  const [searching, setSearching] = useState(false);
  const [resolving, setResolving] = useState(false);
  const token = useRef<google.maps.places.AutocompleteSessionToken | undefined>(undefined);
  const searchRequest = useRef(0);
  const selectionRequest = useRef(0);
  const listId = useId();
  const location = validLocation(value);
  useEffect(() => () => { searchRequest.current++; selectionRequest.current++; onPendingChange(false); }, [onPendingChange]);
  useEffect(() => {
    if (!map) return;
    map.setCenter(location ?? { lat: 39, lng: 35 });
    map.setZoom(location ? 15 : 5);
  }, [map, location?.lat, location?.lng]);
  useEffect(() => {
    const request = ++searchRequest.current;
    if (!isLoaded || query.trim().length < 2 || disabled) { setSuggestions([]); setSearching(false); return; }
    const timer = window.setTimeout(async () => {
      setSearching(true); setError('');
      try {
        token.current ??= new google.maps.places.AutocompleteSessionToken();
        const result = await google.maps.places.AutocompleteSuggestion.fetchAutocompleteSuggestions({ input: query.trim(), sessionToken: token.current, language: 'tr' });
        if (request === searchRequest.current) { setSuggestions(result.suggestions.flatMap(item => item.placePrediction ? [item.placePrediction] : [])); setActive(-1); }
      } catch {
        if (request === searchRequest.current) { setSuggestions([]); setError('Arama kullanılamıyor. Haritaya tıklayabilir veya adresi elle girebilirsin.'); }
      } finally { if (request === searchRequest.current) setSearching(false); }
    }, 300);
    return () => { window.clearTimeout(timer); searchRequest.current++; };
  }, [isLoaded, query, disabled]);
  function startSelection() {
    searchRequest.current++; setSuggestions([]); setQuery(''); setSearching(false); setError(''); setResolving(true); onPendingChange(true);
    return ++selectionRequest.current;
  }
  async function selectPrediction(prediction: google.maps.places.PlacePrediction) {
    if (disabled) return;
    const request = startSelection();
    try {
      const place = prediction.toPlace();
      await place.fetchFields({ fields: ['location', 'formattedAddress'] });
      if (request !== selectionRequest.current) return;
      if (!place.location) throw new Error('missing-location');
      onChange(locationValue(place.formattedAddress ?? '', place.location.toJSON()));
      if (!place.formattedAddress) setError('Açık adres bulunamadı. Lütfen adresi elle gir.');
    } catch { if (request === selectionRequest.current) setError('Seçilen yerin konumu alınamadı. Haritadan seçmeyi deneyebilirsin.'); }
    finally { token.current = undefined; if (request === selectionRequest.current) { setResolving(false); onPendingChange(false); } }
  }
  async function selectCoordinates(position: Coordinates) {
    if (disabled) return;
    const request = startSelection();
    // Never pair a newly selected position with the previous address.
    onChange(locationValue('', position));
    try {
      const result = await new google.maps.Geocoder().geocode({ location: position });
      if (request !== selectionRequest.current) return;
      const address = result.results[0]?.formatted_address ?? '';
      onChange(locationValue(address, position));
      if (!address) setError('Bu konum için açık adres bulunamadı. Adresi elle girebilirsin.');
    } catch { if (request === selectionRequest.current) setError('Konum seçildi, ancak adres alınamadı. Adresi elle girebilirsin.'); }
    finally { if (request === selectionRequest.current) { setResolving(false); onPendingChange(false); } }
  }
  if (loadError) return <p className="field-hint" role="alert">Harita yüklenemedi. Adres ve koordinatları elle girebilirsin.</p>;
  if (!isLoaded) return <p className="field-hint" role="status">Konum seçici yükleniyor…</p>;
  return <div className="location-picker"><label>Haritada yer ara<input role="combobox" aria-autocomplete="list" aria-expanded={suggestions.length > 0} aria-controls={listId} aria-activedescendant={active >= 0 && active < suggestions.length ? `${listId}-${active}` : undefined} autoComplete="off" placeholder="Otel, mekan veya adres ara…" value={query} disabled={disabled || resolving} onChange={event => { searchRequest.current++; setSuggestions([]); setQuery(event.target.value); setActive(-1); }} onKeyDown={event => {
    if (event.key === 'Escape') { event.preventDefault(); event.stopPropagation(); searchRequest.current++; setSuggestions([]); setActive(-1); setQuery(''); }
    if (event.key === 'ArrowDown' && suggestions.length) { event.preventDefault(); setActive(index => Math.min(index + 1, suggestions.length - 1)); }
    if (event.key === 'ArrowUp' && suggestions.length) { event.preventDefault(); setActive(index => Math.max(index - 1, 0)); }
    if (event.key === 'Enter') { event.preventDefault(); if (suggestions[active >= 0 ? active : 0]) void selectPrediction(suggestions[active >= 0 ? active : 0]); }
  }}/></label>{suggestions.length > 0 && <ul id={listId} className="location-suggestions" role="listbox" aria-label="Yer önerileri">{suggestions.map((prediction, index) => <li role="option" aria-selected={active === index} id={`${listId}-${index}`} key={prediction.placeId}><button type="button" tabIndex={-1} onClick={() => void selectPrediction(prediction)}>{prediction.text.toString()}</button></li>)}</ul>}
  <GoogleMap mapContainerClassName="location-picker-map" options={options} onLoad={setMap} onUnmount={() => setMap(null)} onClick={event => { if (event.latLng && !resolving) void selectCoordinates(event.latLng.toJSON()); }}>
    {location && <MarkerF position={location} title="Seçilen konum"/>}
  </GoogleMap><p className="field-hint" role="status">{resolving ? 'Konum ve açık adres alınıyor…' : searching ? 'Yerler aranıyor…' : 'Bir yer ara veya haritaya tıkla; adres ve koordinatlar otomatik doldurulur.'}</p>{error && <p className="field-hint" role="alert">{error}</p>}</div>;
}
export default function LocationFields({ value, onChange, onPendingChange, disabled, prefix = '' }: Props & { prefix?: string }) {
  const apiKey = import.meta.env.VITE_GOOGLE_MAPS_API_KEY;
  return <><label>Adres<input name={prefix ? `${prefix}Address` : 'address'} value={value.address} onChange={event => onChange({ ...value, address: event.target.value })}/></label>
    {apiKey ? <LoadedPicker apiKey={apiKey} value={value} onChange={onChange} onPendingChange={onPendingChange} disabled={disabled}/> : <p className="field-hint">Haritadan seçim için Google Maps bağlantısını yapılandırın. Adres ve koordinatları elle de girebilirsiniz.</p>}
    <div className="field-row"><label>Enlem<input name={`${prefix}lat`} type="number" step="any" min="-90" max="90" value={value.lat} onChange={event => onChange({ ...value, lat: event.target.value })}/></label><label>Boylam<input name={`${prefix}lng`} type="number" step="any" min="-180" max="180" value={value.lng} onChange={event => onChange({ ...value, lng: event.target.value })}/></label></div></>;
}
