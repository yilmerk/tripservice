import { lazy, Suspense, useEffect, useState } from 'react';
import { ArrowRight, BedDouble, Check, ChevronRight, Coffee, Compass, LogOut, MapPin, Navigation, Pencil, Plane, Plus, Route, Star, TrainFront, Utensils } from 'lucide-react';
import { useAuth } from '../context/AuthContext';
import { addDestination, addPlace, createTrip, markPlaceVisited, subscribeTrips, updateDestination } from '../services/tripService';
import type { Destination, Trip } from '../types/trip';
import { categoryLabels, directionsUrl, filterPlaces, formatFee, type PlaceFilter } from '../utils/places';
import { DestinationForm, Modal, PlaceForm, TripForm } from './TripForms';
import './dashboard.css';
import ThemeToggle from './ThemeToggle';
const CityMap = lazy(() => import('./CityMap'));
type Editor = { kind: 'trip' } | { kind: 'city'; tripId: string; destination?: Destination } | { kind: 'place'; tripId: string; destinationId: string };
function message(error: unknown) {
  if (error && typeof error === 'object' && 'code' in error) {
    if (error.code === 'permission-denied') return 'Verilere erişilemiyor. Firestore erişim kurallarını kontrol edin.';
    if (error.code === 'unavailable') return 'Bağlantı kurulamadı. İnternet bağlantınızı kontrol edip tekrar deneyin.';
  }
  return error instanceof Error ? error.message : 'İşlem tamamlanamadı. Lütfen tekrar deneyin.';
}
const filters: { id: PlaceFilter; label: string }[] = [{ id: 'all', label: 'Tümü' }, { id: 'must', label: 'Mutlaka Gidilmeli' }, { id: 'food', label: 'Yeme-İçme' }];
export default function Dashboard() {
  const { user, logout } = useAuth();
  const [trips, setTrips] = useState<Trip[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [retry, setRetry] = useState(0);
  const [error, setError] = useState('');
  const [selectedTrip, setSelectedTrip] = useState('');
  const [selectedCity, setSelectedCity] = useState('');
  const [filter, setFilter] = useState<PlaceFilter>('all');
  const [editor, setEditor] = useState<Editor | null>(null);
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (!user) return;
    setLoading(true); setLoadError('');
    let active = true;
    let unsubscribe: (() => void) | undefined;
    try {
      unsubscribe = subscribeTrips(user.uid, data => { if (active) { setTrips(data); setLoading(false); } }, err => { if (active) { setLoadError(message(err)); setLoading(false); } });
    } catch (err) { setLoadError(message(err)); setLoading(false); }
    return () => { active = false; unsubscribe?.(); };
  }, [user?.uid, retry]);
  const trip = trips.find(item => item.id === selectedTrip) ?? trips[0];
  const city = trip?.destinations.find(item => item.id === selectedCity) ?? trip?.destinations[0];
  const places = city ? filterPlaces(city.places, filter) : [];
  function select(tripId: string, cityId = '') { setSelectedTrip(tripId); setSelectedCity(cityId); setFilter('all'); setError(''); }
  async function save(action: () => Promise<void>) {
    setBusy(true);
    try { await action(); setEditor(null); } catch (err) { throw new Error(message(err)); } finally { setBusy(false); }
  }
  async function toggleVisited(placeId: string, visited: boolean) {
    if (!user || !trip || !city || busy) return;
    setBusy(true); setError('');
    try { await markPlaceVisited(user.uid, trip.id, city.id, placeId, visited); } catch (err) { setError(message(err)); } finally { setBusy(false); }
  }
  return <div className="planner-shell dark:bg-slate-950 dark:text-slate-100">
    <aside className="planner-sidebar dark:bg-slate-900 dark:border-slate-800" aria-label="Seyahatler ve şehir rotaları"><a className="brand" href="/"><span className="brand-icon"><Compass size={28}/></span>rota<span className="brand-dot">.</span></a><div className="sidebar-caption"><span>SEYAHATLERİM</span><span>{trips.length.toString().padStart(2, '0')}</span></div>
      <button className="new-trip" disabled={busy} onClick={() => setEditor({ kind: 'trip' })}><Plus size={16}/>Yeni seyahat</button>
      <nav className="trip-nav">{trips.map(item => <div className="trip-group" key={item.id}><button disabled={busy} aria-expanded={item.id === trip?.id} className={`trip-choice ${item.id === trip?.id ? 'selected' : ''}`} onClick={() => select(item.id)}><Route size={17}/><span>{item.title}</span><ChevronRight size={15}/></button>{item.id === trip?.id && <ol className="city-nav">{item.destinations.map((destination, index) => <li key={destination.id}><button disabled={busy} aria-current={city?.id === destination.id ? 'page' : undefined} onClick={() => select(item.id, destination.id)}><span className="city-number">{String(index + 1).padStart(2, '0')}</span>{' '}<span>{destination.city}</span>{city?.id === destination.id && <span className="selected-dot"/>}</button></li>)}<li><button disabled={busy} onClick={() => setEditor({ kind: 'city', tripId: item.id })}><Plus size={14}/>Şehir ekle</button></li></ol>}</div>)}</nav>
      {!loading && !trips.length && <p className="sidebar-empty">Bir yolculuk, bir başlangıç.<br/>İlk seyahatini ekle.</p>}
      <div className="sidebar-note"><Compass size={23}/><p>Planın hazır olsun,<br/><strong>gerisi yolda güzelleşir.</strong></p></div><div className="sidebar-user"><span className="avatar">{(user?.displayName || user?.email || 'G').slice(0, 1).toLocaleUpperCase('tr-TR')}</span><div><strong>{user?.displayName || 'Gezgin'}</strong><span>{user?.email}</span></div><button className="icon-button" disabled={busy} aria-label="Çıkış yap" onClick={async () => { setBusy(true); try { await logout(); } catch (err) { setError(message(err)); setBusy(false); } }}><LogOut size={17}/></button></div>
    </aside>
    <main className="planner-main"><header className="planner-topbar"><span>SEYAHAT DEFTERİN <ChevronRight size={13}/><span>{trip?.title || 'Yeni başlangıçlar'}</span></span><div className="header-actions"><span className="topbar-greeting">Merhaba, {user?.displayName?.split(' ')[0] || 'gezgin'} <span className="online-dot"/></span><ThemeToggle/></div></header>
      <div className="planner-content">{error && <p className="error-message" role="alert">{error}</p>}{loading ? <div className="planner-empty" role="status"><Compass className="animate-spin"/><h1>Rotaların hazırlanıyor…</h1></div> : loadError ? <div className="planner-empty" role="alert"><h1>Rotana ulaşamadık.</h1><p>{loadError}</p><button className="outline-button" onClick={() => setRetry(value => value + 1)}>Tekrar dene</button></div> : !trip ? <div className="planner-empty"><span className="empty-compass"><Compass size={40}/></span><span className="form-kicker">BİR SONRAKİ HİKÂYEN</span><h1>Nereye gidiyoruz?</h1><p>Yeni bir seyahat oluştur, şehirlerini ekle.<br/>Tüm planın tek bir yerde, hep yanında.</p><button className="solid-button" onClick={() => setEditor({ kind: 'trip' })}><Plus size={17}/>İlk seyahatimi oluştur</button></div> : !city ? <div className="planner-empty"><MapPin size={35}/><h1>{trip.title}</h1><p>Bu yolculuğun ilk durağını ekleyelim.</p><button className="solid-button" onClick={() => setEditor({ kind: 'city', tripId: trip.id })}><Plus size={17}/>Şehir ekle</button></div> : <>
      <div className="city-heading"><div><span className="form-kicker">{city.country.toLocaleUpperCase('tr-TR')} <span className="small-dot">·</span> {trip.destinations.findIndex(item => item.id === city.id) + 1}. DURAK</span><h1>{city.city}<span>.</span></h1><p><MapPin size={14}/>{city.country}<span>·</span>{city.places.length} keşfedilecek yer{trip.startDate && <><span>·</span>{trip.startDate}{trip.endDate && ` → ${trip.endDate}`}</>}</p></div><button className="outline-button" disabled={busy} onClick={() => setEditor({ kind: 'city', tripId: trip.id, destination: city })}><Pencil size={14}/>Şehir bilgilerini düzenle</button></div>
      <div className="city-info-grid"><section className="info-card dark:bg-slate-900 dark:border-slate-700 hotel-card"><div className="card-title"><span className="card-icon"><BedDouble size={18}/></span><h2>Konaklama</h2><span className="card-eyebrow">EVİNDEN UZAKTAKİ EVİN</span></div>{city.hotels?.length ? city.hotels.map((hotel, index) => <div className="hotel-entry" key={index}><h3>{hotel.name}</h3><p>{hotel.address || 'Adres henüz eklenmedi.'}</p>{hotel.checkIn && <div className="hotel-dates"><span>GİRİŞ<strong>{hotel.checkIn}</strong></span><ArrowRight size={16}/><span>ÇIKIŞ<strong>{hotel.checkOut || 'Belirtilmedi'}</strong></span></div>}{hotel.reservationCode && <p>Rezervasyon: {hotel.reservationCode}</p>}{hotel.notes && <p className="preserve-lines">{hotel.notes}</p>}{hotel.location && <a className="text-link" href={directionsUrl(hotel.location)} target="_blank" rel="noopener noreferrer"><Navigation size={13}/>Yol tarifi al</a>}</div>) : <p className="card-empty">Yolun sonunda güzel bir dinlenme.<br/>Otel bilgilerini şehir düzenleme alanından ekle.</p>}</section>
      <section className="info-card dark:bg-slate-900 dark:border-slate-700"><div className="card-title"><span className="card-icon sand"><Plane size={18}/></span><h2>Havalimanı → Merkez</h2></div><p className="preserve-lines">{city.airportNotes || 'Transfer hattı, durak, süre ve ücret bilgilerini ekle.'}</p></section>
      <section className="info-card dark:bg-slate-900 dark:border-slate-700"><div className="card-title"><span className="card-icon blue"><TrainFront size={18}/></span><h2>Şehir içi ulaşım</h2></div><p className="preserve-lines">{city.localTransportNotes || 'Ulaşım kartı ve ödeme rehberini buraya not et.'}</p></section>
      <section className="info-card dark:bg-slate-900 dark:border-slate-700 intercity-card"><div className="card-title"><span className="card-icon rose"><Route size={18}/></span><h2>Şehirler arası geçiş</h2></div><p className="preserve-lines">{city.intercityNotes || 'Bir sonraki durağa nasıl geçeceksin? Sefer ve bilet bilgilerini ekle.'}</p></section></div>
      <div className="explore-grid"><section className="places-panel"><div className="section-heading"><div><span className="form-kicker">KÜÇÜK DURAKLAR, BÜYÜK ANILAR</span><h2>Keşif listem <span>{city.places.length}</span></h2></div><button className="solid-button" disabled={busy} onClick={() => setEditor({ kind: 'place', tripId: trip.id, destinationId: city.id })}><Plus size={16}/>Mekan ekle</button></div><div className="place-filters" role="group" aria-label="Mekanları filtrele">{filters.map(item => <button key={item.id} aria-pressed={filter === item.id} className={filter === item.id ? 'active' : ''} onClick={() => setFilter(item.id)}>{item.id === 'must' && <Star size={12}/>} {item.label}</button>)}</div>
        <div className="place-list">{places.length ? places.map(place => <article className={`place-card dark:bg-slate-900 dark:border-slate-700 ${place.visited ? 'visited' : ''}`} key={place.id}><span className={`place-icon ${['food','coffee','dessert','food-and-drink'].includes(place.category) ? 'warm' : ''}`}>{place.category === 'coffee' ? <Coffee size={19}/> : ['food','dessert','food-and-drink'].includes(place.category) ? <Utensils size={19}/> : <MapPin size={19}/>}</span><div className="place-body"><div className="place-name"><h3>{place.name}</h3>{place.mustVisit && <Star size={13} fill="currentColor" aria-label="Mutlaka gidilmeli"/>}</div><span className="place-meta">{categoryLabels[place.category]}<span>·</span>{formatFee(place.fee)}</span>{place.address && <p>{place.address}</p>}{place.notes && <p className="preserve-lines">{place.notes}</p>}{place.location && <a className="text-link" href={directionsUrl(place.location)} target="_blank" rel="noopener noreferrer">Yol tarifi al <ArrowRight size={12}/></a>}</div><button className={`visit-button ${place.visited ? 'checked' : ''}`} disabled={busy} aria-pressed={place.visited} aria-label={`${place.name}: ${place.visited ? 'ziyareti geri al' : 'ziyaret edildi olarak işaretle'}`} onClick={() => void toggleVisited(place.id, !place.visited)}><Check size={15}/><span>{place.visited ? 'Ziyaret edildi' : 'Gidilecek'}</span></button></article>) : <div className="places-empty"><Compass size={30}/><h3>{filter === 'all' ? 'İlk keşfini ekle.' : 'Bu filtrede mekan yok.'}</h3><p>{filter === 'all' ? 'Bir müze, güzel bir kahve, aklında kalan bir sokak…' : 'Farklı bir filtre seç veya yeni bir mekan ekle.'}</p></div>}</div><div className="list-summary"><Check size={13}/>{city.places.filter(place => place.visited).length} / {city.places.length} mekan ziyaret edildi<span>Her durak yeni bir hikâye.</span></div></section>
      <section className="map-panel"><div className="section-heading"><div><span className="form-kicker">ŞEHRİ BİR ARADA GÖR</span><h2>Rota haritam</h2></div><MapPin size={20}/></div><Suspense fallback={<div className="map-placeholder" role="status">Harita hazırlanıyor…</div>}><CityMap key={`${trip.id}-${city.id}`} destination={city}/></Suspense></section></div>
      <footer className="planner-footer"><Compass size={14}/><span>Planını yap. Anın tadını çıkar.</span><span>rota.</span></footer>
      </>}</div>
    </main>
    {editor && user && <Modal busy={busy} onClose={() => setEditor(null)} title={editor.kind === 'trip' ? 'Yeni bir yolculuk' : editor.kind === 'place' ? 'Yeni bir keşif' : editor.destination ? 'Şehir rehberini düzenle' : 'Rotana bir şehir ekle'}>{editor.kind === 'trip' ? <TripForm busy={busy} onSave={input => save(async () => { const id = await createTrip(user.uid, input); select(id); })}/> : editor.kind === 'city' ? <DestinationForm destination={editor.destination} busy={busy} onSave={input => save(async () => { if (editor.destination) { await updateDestination(user.uid, editor.tripId, editor.destination.id, input); } else { const id = await addDestination(user.uid, editor.tripId, input); select(editor.tripId, id); } })}/> : <PlaceForm busy={busy} onSave={input => save(async () => { await addPlace(user.uid, editor.tripId, editor.destinationId, input); setFilter('all'); })}/>}</Modal>}
  </div>;
}
