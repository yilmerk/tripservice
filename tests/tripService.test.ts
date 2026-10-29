import { beforeEach, describe, expect, it, vi } from 'vitest';

const state = vi.hoisted(() => ({
  uid: 'alice',
  data: null as Record<string, unknown> | null,
  writes: [] as Record<string, unknown>[],
}));
vi.mock('../src/firebase', () => ({ db: {}, auth: { get currentUser() { return { uid: state.uid }; } } }));
vi.mock('firebase/firestore', () => {
  const snapshot = () => ({ exists: () => state.data !== null, data: () => structuredClone(state.data), id: 'trip-1' });
  return {
    collection: (_db: unknown, ...path: string[]) => ({ path: path.join('/') }),
    doc: (collection: { path: string }, id: string) => ({ path: `${collection.path}/${id}`, firestore: {} }),
    serverTimestamp: () => 'SERVER_TIMESTAMP',
    addDoc: async (ref: { path: string }, data: Record<string, unknown>) => { state.writes.push({ path: ref.path, ...data }); return { id: 'trip-1' }; },
    getDoc: async () => snapshot(),
    getDocs: vi.fn(), orderBy: vi.fn(), query: vi.fn(),
    deleteDoc: async (ref: { path: string }) => { state.writes.push({ deleted: ref.path }); },
    runTransaction: async (_db: unknown, callback: (tx: unknown) => Promise<void>) => callback({
      get: async () => snapshot(),
      update: (_ref: unknown, patch: Record<string, unknown>) => { state.writes.push(patch); state.data = { ...state.data, ...patch }; },
    }),
  };
});
import { addDestination, addPlace, createTrip, deleteTrip, getTrip, markPlaceVisited, updateTrip, updateDestination } from '../src/services/tripService';

beforeEach(() => {
  state.uid = 'alice'; state.writes = [];
  state.data = { title: 'İtalya', startDate: '2026-10-01', endDate: '2026-10-10', destinations: [], createdAt: null, updatedAt: null };
});
describe('trip service', () => {
  it('creates a trip in the owner path with server timestamps and no undefined fields', async () => {
    expect(await createTrip('alice', { title: '  Roma  ', description: undefined })).toBe('trip-1');
    expect(state.writes[0]).toEqual({ path: 'users/alice/trips', title: 'Roma', destinations: [], createdAt: 'SERVER_TIMESTAMP', updatedAt: 'SERVER_TIMESTAMP' });
  });
  it('rejects another user and invalid document IDs before writing', async () => {
    await expect(createTrip('bob', { title: 'Roma' })).rejects.toThrow('erişim');
    await expect(deleteTrip('alice', 'bad/id')).rejects.toThrow('kimliği');
    expect(state.writes).toHaveLength(0);
  });
  it('validates updates against stored dates and preserves protected fields', async () => {
    await expect(updateTrip('alice', 'trip-1', { endDate: '2026-09-01' })).rejects.toThrow('Bitiş');
    await updateTrip('alice', 'trip-1', { title: 'Yeni rota', destinations: ['bad'] } as never);
    expect(state.data?.destinations).toEqual([]);
    expect(state.data?.title).toBe('Yeni rota');
  });
  it('adds nested data and changes only the target place, including undo', async () => {
    const destinationId = await addDestination('alice', 'trip-1', { city: 'Roma', country: 'İtalya', hotels: [{ name: 'Otel', notes: undefined }], airportNotes: 'Tren' });
    const placeId = await addPlace('alice', 'trip-1', destinationId, { name: 'Müze', category: 'museum', mustVisit: true, visited: false, fee: { amount: 12, currency: 'EUR' } });
    await addPlace('alice', 'trip-1', destinationId, { name: 'Kafe', category: 'food-and-drink', mustVisit: false, visited: false });
    await markPlaceVisited('alice', 'trip-1', destinationId, placeId);
    let trip = await getTrip('alice', 'trip-1');
    expect(trip?.destinations[0].places.map(place => place.visited)).toEqual([true, false]);
    expect(trip?.destinations[0].places[0].fee).toEqual({ amount: 12, currency: 'EUR' });
    await markPlaceVisited('alice', 'trip-1', destinationId, placeId, false);
    trip = await getTrip('alice', 'trip-1');
    expect(trip?.destinations[0].places[0].visited).toBe(false);
  });
  it('rejects missing trip/place and negative fees without a write', async () => {
    await expect(markPlaceVisited('alice', 'trip-1', 'missing', 'missing')).rejects.toThrow('Destinasyon');
    await expect(addPlace('alice', 'trip-1', 'missing', { name: 'Müze', category: 'museum', mustVisit: true, visited: false, fee: { amount: -1, currency: 'EUR' } })).rejects.toThrow('Ücret');
    state.data = null;
    expect(await getTrip('alice', 'trip-1')).toBeNull();
    await expect(updateTrip('alice', 'trip-1', { title: 'Yeni' })).rejects.toThrow('Seyahat bulunamadı');
    expect(state.writes).toHaveLength(0);
  });
  it('deletes the trip document that contains all nested data', async () => {
    await deleteTrip('alice', 'trip-1');
    expect(state.writes).toEqual([{ deleted: 'users/alice/trips/trip-1' }]);
  });
});

it('preserves coordinates and existing places when editing destination guides', async () => {
  const destinationId = await addDestination('alice', 'trip-1', { city: 'Roma', country: 'İtalya', intercityNotes: 'Tren', hotels: [{ name: 'Otel', location: { lat: 41, lng: 12 } }] });
  const placeId = await addPlace('alice', 'trip-1', destinationId, { name: 'Kafe', category: 'coffee', location: { lat: 42, lng: 13 }, mustVisit: false, visited: false });
  await updateDestination('alice', 'trip-1', destinationId, { city: 'Roma', country: 'İtalya', intercityNotes: 'Yeni tren' });
  const trip = await getTrip('alice', 'trip-1');
  expect(trip?.destinations[0].hotels?.[0].location).toEqual({ lat: 41, lng: 12 });
  expect(trip?.destinations[0].places[0]).toMatchObject({ id: placeId, location: { lat: 42, lng: 13 }, category: 'coffee' });
  expect(trip?.destinations[0].intercityNotes).toBe('Yeni tren');
});
it('rejects invalid coordinates before writing', async () => {
  await expect(addDestination('alice', 'trip-1', { city: 'Roma', country: 'İtalya', hotels: [{ name: 'Otel', location: { lat: 100, lng: 12 } }] })).rejects.toThrow('enlem');
  expect(state.writes).toHaveLength(0);
});
