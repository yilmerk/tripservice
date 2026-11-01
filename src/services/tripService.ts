import {
  addDoc, collection, doc, getDoc, getDocs, orderBy, query,
  onSnapshot, runTransaction, serverTimestamp, type DocumentData, type DocumentSnapshot,
} from 'firebase/firestore';
import { auth, db } from '../firebase';
import { deleteTripWithExpenses } from './expenseService';
import { isCurrency, toMinor } from '../utils/money';
import type { Destination, DestinationInput, PlaceInput, Trip, TripInput, TripUpdate } from '../types/trip';

export type { Destination, DestinationInput, Hotel, Place, PlaceCategory, PlaceInput, Trip, TripInput, TripUpdate } from '../types/trip';

// Destinations and places are embedded arrays: every trip mutation/deletion is atomic.
function tripsCollection(userId: string) {
  if (!db || !auth) throw new Error('Firebase bağlantısı yapılandırılmadı.');
  if (!userId || auth.currentUser?.uid !== userId) throw new Error('Bu kullanıcının seyahatlerine erişim izniniz yok.');
  return collection(db, 'users', validId(userId), 'trips');
}
function validId(id: string) {
  if (!id.trim() || id.includes('/')) throw new Error('Geçersiz belge kimliği.');
  return id;
}
function tripRef(userId: string, tripId: string) {
  return doc(tripsCollection(userId), validId(tripId));
}
function required(value: string, label: string) {
  if (typeof value !== 'string' || !value.trim()) throw new Error(`${label} boş bırakılamaz.`);
}
function date(value: string | undefined) {
  if (value === undefined) return;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value) || new Date(`${value}T00:00:00Z`).toISOString().slice(0, 10) !== value) {
    throw new Error('Tarih YYYY-MM-DD biçiminde geçerli bir gün olmalı.');
  }
}
function validateTrip(input: TripInput) {
  required(input.title, 'Seyahat adı');
  if (input.currency !== undefined && !isCurrency(input.currency)) throw new Error('Geçersiz para birimi.');
  if (input.totalBudget !== undefined) toMinor(input.totalBudget, input.currency ?? 'EUR', true);
  date(input.startDate); date(input.endDate);
  if (input.startDate && input.endDate && input.startDate > input.endDate) throw new Error('Bitiş tarihi başlangıçtan önce olamaz.');
}
function validateDestination(input: DestinationInput) {
  required(input.city, 'Şehir'); required(input.country, 'Ülke');
  input.hotels?.forEach(hotel => {
    required(hotel.name, 'Otel adı'); date(hotel.checkIn); date(hotel.checkOut);
    if (hotel.checkIn && hotel.checkOut && hotel.checkIn > hotel.checkOut) throw new Error('Otel çıkışı girişten önce olamaz.');
  });
}
function validatePlace(input: PlaceInput) {
  required(input.name, 'Mekan adı');
  if (!['attraction', 'museum', 'food-and-drink', 'food', 'coffee', 'dessert', 'other'].includes(input.category)) throw new Error('Geçersiz mekan kategorisi.');
  if (typeof input.visited !== 'boolean' || typeof input.mustVisit !== 'boolean') throw new Error('Ziyaret durumları boolean olmalı.');
  if (input.fee && (!Number.isFinite(input.fee.amount) || input.fee.amount < 0 || !/^[A-Z]{3}$/.test(input.fee.currency))) {
    throw new Error('Ücret negatif olmayan bir sayı, para birimi üç büyük harf olmalı.');
  }
}
// Firestore rejects undefined, including nested optional fields. Persist plain data only.
function clean<T>(value: T): T {
  if (Array.isArray(value)) return value.map(item => clean(item)) as T;
  if (value && typeof value === 'object') return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined).map(([key, item]) => [key, clean(item)])) as T;
  return value;
}
function readTrip(snapshot: DocumentSnapshot<DocumentData>): Trip {
  if (!snapshot.exists()) throw new Error('Seyahat bulunamadı.');
  return { ...snapshot.data(), id: snapshot.id } as Trip;
}

export async function createTrip(userId: string, input: TripInput): Promise<string> {
  validateTrip(input);
  const { title, description, startDate, endDate, totalBudget, currency } = input;
  const ref = await addDoc(tripsCollection(userId), {
    ...clean({ title: title.trim(), description, startDate, endDate, totalBudget, currency }),
    destinations: [], createdAt: serverTimestamp(), updatedAt: serverTimestamp(),
  });
  return ref.id;
}
export async function getTrip(userId: string, tripId: string): Promise<Trip | null> {
  const snapshot = await getDoc(tripRef(userId, tripId));
  return snapshot.exists() ? readTrip(snapshot) : null;
}
export async function getTrips(userId: string): Promise<Trip[]> {
  const snapshot = await getDocs(query(tripsCollection(userId), orderBy('createdAt', 'desc')));
  return snapshot.docs.map(readTrip);
}
export async function updateTrip(userId: string, tripId: string, input: TripUpdate): Promise<void> {
  const ref = tripRef(userId, tripId);
  // Whitelist editable fields; callers cannot overwrite destinations or timestamps.
  const { title, description, startDate, endDate } = input;
  const patch: TripUpdate = clean({ title: title?.trim(), description, startDate, endDate });
  await runTransaction(ref.firestore, async transaction => {
    const trip = readTrip(await transaction.get(ref));
    validateTrip({ ...trip, ...patch });
    transaction.update(ref, { ...patch, updatedAt: serverTimestamp() });
  });
}
export async function deleteTrip(userId: string, tripId: string): Promise<void> {
  tripRef(userId, tripId);
  await deleteTripWithExpenses(userId, tripId);
}
async function mutateDestinations(userId: string, tripId: string, mutate: (destinations: Destination[]) => void): Promise<void> {
  const ref = tripRef(userId, tripId);
  await runTransaction(ref.firestore, async transaction => {
    const trip = readTrip(await transaction.get(ref));
    const destinations = trip.destinations;
    mutate(destinations);
    transaction.update(ref, { destinations: clean(destinations), updatedAt: serverTimestamp() });
  });
}
function findDestination(destinations: Destination[], destinationId: string): Destination {
  const destination = destinations.find(item => item.id === destinationId);
  if (!destination) throw new Error('Destinasyon bulunamadı.');
  return destination;
}
export async function addDestination(userId: string, tripId: string, input: DestinationInput): Promise<string> {
  validateDestination(input);
  const id = crypto.randomUUID();
  const { city, country, hotels, airportNotes, localTransportNotes, intercityNotes } = input;
  await mutateDestinations(userId, tripId, destinations => {
    destinations.push({ id, city, country, hotels, airportNotes, localTransportNotes, intercityNotes, places: [] });
  });
  return id;
}
export async function addPlace(userId: string, tripId: string, destinationId: string, input: PlaceInput): Promise<string> {
  validatePlace(input);
  const id = crypto.randomUUID();
  const { name, category, notes, fee, mustVisit, visited, famousFor } = input;
  await mutateDestinations(userId, tripId, destinations => {
    findDestination(destinations, destinationId).places.push({ id, name, category, notes, fee, mustVisit, visited, famousFor });
  });
  return id;
}
export async function markPlaceVisited(userId: string, tripId: string, destinationId: string, placeId: string, visited = true): Promise<void> {
  if (typeof visited !== 'boolean') throw new Error('Ziyaret durumu boolean olmalı.');
  await mutateDestinations(userId, tripId, destinations => {
    const place = findDestination(destinations, destinationId).places.find(item => item.id === placeId);
    if (!place) throw new Error('Mekan bulunamadı.');
    place.visited = visited;
  });
}

export function subscribeTrips(userId: string, onChange: (trips: Trip[]) => void, onError: (error: Error) => void): () => void {
  return onSnapshot(query(tripsCollection(userId), orderBy('createdAt', 'desc')), snapshot => {
    onChange(snapshot.docs.map(readTrip));
  }, onError);
}
export async function updateDestination(userId: string, tripId: string, destinationId: string, input: DestinationInput): Promise<void> {
  validateDestination(input);
  const { city, country, hotels, airportNotes, localTransportNotes, intercityNotes } = input;
  await mutateDestinations(userId, tripId, destinations => {
    Object.assign(findDestination(destinations, destinationId), clean({ city, country, hotels, airportNotes, localTransportNotes, intercityNotes }));
  });
}

export async function updatePlace(userId: string, tripId: string, destinationId: string, placeId: string, input: PlaceInput): Promise<void> {
  validatePlace(input);
  const { name, category, notes, fee, mustVisit, famousFor } = input;
  await mutateDestinations(userId, tripId, destinations => {
    const places = findDestination(destinations, destinationId).places;
    const index = places.findIndex(place => place.id === placeId);
    if (index < 0) throw new Error('Mekan bulunamadı.');
    // Preserve visit changes made in another tab while the edit form was open.
    places[index] = clean({ id: placeId, name, category, notes, fee, mustVisit, visited: places[index].visited, famousFor });
  });
}
