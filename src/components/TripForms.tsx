import { useEffect, useRef, useState, type FormEvent, type ReactNode } from 'react';
import { X } from 'lucide-react';
import LocationFields, { locationValue } from './LocationPicker';
import type { Coordinates, Destination, DestinationInput, Place, PlaceInput, TripInput } from '../types/trip';

export function Modal({ title, onClose, busy, children }: { title: string; onClose: () => void; busy: boolean; children: ReactNode }) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const dialog = ref.current;
    const previous = document.activeElement as HTMLElement | null;
    dialog?.showModal();
    return () => { dialog?.close(); previous?.focus(); };
  }, []);
  return <dialog className="planner-dialog dark:bg-slate-900 dark:text-slate-100 dark:border-slate-700" ref={ref} aria-labelledby="modal-title" onCancel={event => { event.preventDefault(); if (!busy) onClose(); }}><header><h2 id="modal-title">{title}</h2><button type="button" className="icon-button" disabled={busy} aria-label="Kapat" onClick={onClose}><X size={20}/></button></header>{children}</dialog>;
}
const text = (data: FormData, name: string) => String(data.get(name) ?? '').trim();
function coordinates(data: FormData, prefix = ''): Coordinates | undefined {
  const lat = text(data, `${prefix}lat`); const lng = text(data, `${prefix}lng`);
  if (!lat && !lng) return undefined;
  if (!lat || !lng) throw new Error('Konum için enlem ve boylamı birlikte girin.');
  const location = { lat: Number(lat), lng: Number(lng) };
  if (!Number.isFinite(location.lat) || !Number.isFinite(location.lng) || Math.abs(location.lat) > 90 || Math.abs(location.lng) > 180) throw new Error('Geçerli enlem ve boylam girin.');
  return location;
}
function FormShell({ onSubmit, busy, blocked = false, children, submitLabel }: { blocked?: boolean; onSubmit: (data: FormData) => Promise<void>; busy: boolean; children: ReactNode; submitLabel: string }) {
  const [error, setError] = useState('');
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (busy || blocked) return;
    setError('');
    try { await onSubmit(new FormData(event.currentTarget)); } catch (err) { setError(err instanceof Error ? err.message : 'Kaydedilemedi. Lütfen tekrar deneyin.'); }
  }
  return <form className="planner-form" onSubmit={submit}><fieldset disabled={busy || blocked}>{children}{error && <p className="error-message" role="alert">{error}</p>}<button className="primary-button" type="submit" disabled={busy || blocked}>{blocked ? 'Konum alınıyor…' : busy ? 'Kaydediliyor…' : submitLabel}</button></fieldset></form>;
}
export function TripForm({ busy, onSave }: { busy: boolean; onSave: (input: TripInput) => Promise<void> }) {
  return <FormShell busy={busy} submitLabel="Seyahati oluştur" onSubmit={data => onSave({ title: text(data, 'title'), startDate: text(data, 'startDate') || undefined, endDate: text(data, 'endDate') || undefined })}><label>Seyahat adı<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" autoFocus name="title" required maxLength={120} placeholder="Örn. İtalya kaçamağı"/></label><div className="field-row"><label>Başlangıç<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" type="date" name="startDate"/></label><label>Bitiş<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" type="date" name="endDate"/></label></div></FormShell>;
}
export function DestinationForm({ busy, destination, onSave }: { busy: boolean; destination?: Destination; onSave: (input: DestinationInput) => Promise<void> }) {
  const hotel = destination?.hotels?.[0];
  const [position, setPosition] = useState(() => locationValue(hotel?.address, hotel?.location));
  const [pending, setPending] = useState(false);
  return <FormShell busy={busy} blocked={pending} submitLabel="Şehri kaydet" onSubmit={async data => {
    const name = text(data, 'hotelName'); const location = coordinates(data, 'hotel');
    if (!name && (location || text(data, 'hotelAddress') || text(data, 'checkIn') || text(data, 'checkOut') || text(data, 'reservationCode') || text(data, 'hotelNotes') || text(data, 'hotelFamousFor'))) throw new Error('Otel bilgileri için otel adını girin.');
    await onSave({ city: text(data, 'city'), country: text(data, 'country'), airportNotes: text(data, 'airportNotes'), localTransportNotes: text(data, 'localTransportNotes'), intercityNotes: text(data, 'intercityNotes'), hotels: [
      ...(name ? [{ name, address: text(data, 'hotelAddress'), location, checkIn: text(data, 'checkIn') || undefined, checkOut: text(data, 'checkOut') || undefined, reservationCode: text(data, 'reservationCode'), notes: text(data, 'hotelNotes'), famousFor: text(data, 'hotelFamousFor') }] : []),
      ...(destination?.hotels?.slice(1) ?? []),
    ] });
  }}><div className="field-row"><label>Şehir<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" autoFocus name="city" required defaultValue={destination?.city} maxLength={100}/></label><label>Ülke<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" name="country" required defaultValue={destination?.country} maxLength={100}/></label></div><h3 className="dark:text-slate-100">Konaklama</h3><label>Otel adı<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" name="hotelName" defaultValue={hotel?.name}/></label><LocationFields prefix="hotel" value={position} onChange={setPosition} onPendingChange={setPending} disabled={busy || pending}/><label>Neyiyle meşhur?<input name="hotelFamousFor" defaultValue={hotel?.famousFor} placeholder="Manzarası, kahvaltısı…"/></label><div className="field-row"><label>Giriş<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" type="date" name="checkIn" defaultValue={hotel?.checkIn}/></label><label>Çıkış<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" type="date" name="checkOut" defaultValue={hotel?.checkOut}/></label></div><label>Rezervasyon kodu<input className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" name="reservationCode" defaultValue={hotel?.reservationCode}/></label><label>Otel notları<textarea className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" name="hotelNotes" defaultValue={hotel?.notes}/></label><h3 className="dark:text-slate-100">Ulaşım rehberin</h3><label>Havalimanı → Merkez<textarea className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" name="airportNotes" defaultValue={destination?.airportNotes} placeholder="Hat, durak, süre ve ücret…"/></label><label>Şehir içi ulaşım ve ödeme<textarea className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" name="localTransportNotes" defaultValue={destination?.localTransportNotes} placeholder="Ulaşım kartı, ödeme yöntemleri ve ipuçları…"/></label><label>Şehirler arası geçiş<textarea className="dark:bg-slate-950 dark:text-slate-100 dark:border-slate-700" name="intercityNotes" defaultValue={destination?.intercityNotes} placeholder="Sonraki şehir, istasyon, sefer ve bilet bilgileri…"/></label></FormShell>;
}
export function PlaceForm({ busy, place, onSave }: { busy: boolean; place?: Place; onSave: (input: PlaceInput) => Promise<void> }) {
  const [position, setPosition] = useState(() => locationValue(place?.address, place?.location));
  const [pending, setPending] = useState(false);
  return <FormShell busy={busy} blocked={pending} submitLabel={place ? 'Değişiklikleri kaydet' : 'Mekanı rotama ekle'} onSubmit={async data => {
    const amount = text(data, 'amount');
    await onSave({ name: text(data, 'name'), category: text(data, 'category') as PlaceInput['category'], address: text(data, 'address'), famousFor: text(data, 'famousFor'), notes: text(data, 'notes'), location: coordinates(data), fee: amount ? { amount: Number(amount), currency: text(data, 'currency').toUpperCase() } : undefined, mustVisit: data.has('mustVisit'), visited: place?.visited ?? false });
  }}>
    <label>Mekan adı<input autoFocus name="name" required maxLength={150} defaultValue={place?.name} placeholder="Keşfetmek istediğin yer…"/></label>
    <label>Kategori<select name="category" defaultValue={place?.category ?? 'museum'}><option value="museum">Müze</option><option value="attraction">Gezilecek Yer</option><option value="food">Yemek</option><option value="coffee">Kahve</option><option value="dessert">Tatlı</option>{place?.category === 'food-and-drink' && <option value="food-and-drink">Yeme-İçme</option>}{place?.category === 'other' && <option value="other">Diğer</option>}</select></label>
    <LocationFields value={position} onChange={setPosition} onPendingChange={setPending} disabled={busy || pending}/>
    <label>Neyiyle meşhur?<input name="famousFor" defaultValue={place?.famousFor} placeholder="Örn. tiramisu, Rönesans eserleri…"/></label>
    <div className="field-row"><label>Ücret<input type="number" name="amount" min="0" step="0.01" defaultValue={place?.fee?.amount} placeholder="Bilinmiyorsa boş bırak"/></label><label>Para birimi<input name="currency" defaultValue={place?.fee?.currency ?? 'EUR'} pattern="[A-Za-z]{3}" maxLength={3} required/></label></div>
    <label>Notların<textarea name="notes" defaultValue={place?.notes} placeholder="Açılış saatleri, rezervasyon, denenecek lezzet…"/></label>
    <label className="check-field"><input type="checkbox" name="mustVisit" defaultChecked={place?.mustVisit}/>Mutlaka gidilmeli</label>
  </FormShell>;
}
