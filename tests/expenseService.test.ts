import { beforeEach, expect, it, vi } from 'vitest';
const fake = vi.hoisted(() => ({ uid: 'alice', data: new Map<string, Record<string, unknown>>(), next: 0, unsubscribe: vi.fn() }));
vi.mock('../src/firebase', () => ({ db: {}, auth: { get currentUser() { return { uid: fake.uid }; } } }));
vi.mock('firebase/firestore', () => {
  const snapshot = (path: string) => ({ id: path.split('/').at(-1), ref: { path }, exists: () => fake.data.has(path), data: () => structuredClone(fake.data.get(path)) });
  return {
    doc: (base: { path?: string }, ...parts: string[]) => { const path = [base.path, ...(parts.length ? parts : [`expense-${++fake.next}`])].filter(Boolean).join('/'); return { path, id: path.split('/').at(-1) }; },
    collection: (_db: unknown, ...parts: string[]) => ({ path: parts.join('/') }),
    serverTimestamp: () => 'SERVER_TIME',
    query: (ref: { path: string }, ...constraints: unknown[]) => ({ ...ref, constraints }), orderBy: vi.fn((field, direction) => ({ field, direction })), limit: (count: number) => ({ count }),
    getDocs: async (ref: { path: string; constraints: { count?: number }[] }) => {
      const docs = [...fake.data.keys()].filter(path => path.startsWith(`${ref.path}/`)).slice(0, ref.constraints.find(item => item.count)?.count ?? Infinity).map(snapshot);
      return { docs, empty: !docs.length };
    },
    writeBatch: () => { const paths: string[] = []; return { delete: (ref: { path: string }) => paths.push(ref.path), commit: async () => { paths.forEach(path => fake.data.delete(path)); } }; },
    runTransaction: async (_db: unknown, callback: (tx: unknown) => Promise<unknown>) => {
      const pending: (() => void)[] = [];
      const value = await callback({
        get: async (ref: { path: string }) => snapshot(ref.path),
        set: (ref: { path: string }, data: Record<string, unknown>) => pending.push(() => { fake.data.set(ref.path, data); }),
        update: (ref: { path: string }, data: Record<string, unknown>) => pending.push(() => { fake.data.set(ref.path, { ...fake.data.get(ref.path), ...data }); }),
        delete: (ref: { path: string }) => pending.push(() => { fake.data.delete(ref.path); }),
      });
      pending.forEach(action => action()); return value;
    },
    onSnapshot: (_ref: unknown, next: (snapshot: unknown) => void) => { next({ docs: [] }); return fake.unsubscribe; },
  };
});
import { addExpense, deleteExpense, deleteTripWithExpenses, ensureExpenseLedger, setTripBudget, subscribeExpenses, updateExpense } from '../src/services/expenseService';
const input = { name: 'Yemek', amount: 10, currency: 'EUR' as const, date: '2026-11-01', category: 'food' as const };
beforeEach(() => { fake.uid = 'alice'; fake.next = 0; fake.data.clear(); fake.data.set('users/alice/trips/trip-1', { title: 'Roma' }); });
it('initializes legacy trips without moving their original documents', async () => {
  expect(await ensureExpenseLedger('alice', 'trip-1')).toMatchObject({ ownerId: 'alice', currency: 'EUR', hasExpenses: false });
  expect(fake.data.has('users/alice/trips/trip-1')).toBe(true);
  expect(fake.data.get('trips/trip-1')?.ownerId).toBe('alice');
});
it('writes expenses under trips/{tripId}/expenses and locks the currency', async () => {
  await ensureExpenseLedger('alice', 'trip-1');
  const id = await addExpense('alice', 'trip-1', { ...input, currency: 'USD', exchangeRate: 0.9 });
  expect(fake.data.get(`trips/trip-1/expenses/${id}`)).toMatchObject({ amountMinor: 1000, baseAmountMinor: 900, baseCurrency: 'EUR', createdAt: 'SERVER_TIME' });
  expect(fake.data.get('users/alice/trips/trip-1')?.budgetCurrencyLocked).toBe(true);
  await deleteExpense('alice', 'trip-1', id);
  await expect(setTripBudget('alice', 'trip-1', 100, 'USD')).rejects.toThrow('değiştirilemez');
  await setTripBudget('alice', 'trip-1', 200, 'EUR');
  expect(fake.data.get('users/alice/trips/trip-1')?.totalBudget).toBe(200);
});
it('updates an expense while preserving its original creation timestamp', async () => {
  await ensureExpenseLedger('alice', 'trip-1'); const id = await addExpense('alice', 'trip-1', input);
  fake.data.get(`trips/trip-1/expenses/${id}`)!.createdAt = 'ORIGINAL_TIME';
  await updateExpense('alice', 'trip-1', id, { ...input, name: 'Yeni yemek', amount: 20 });
  expect(fake.data.get(`trips/trip-1/expenses/${id}`)).toMatchObject({ name: 'Yeni yemek', baseAmountMinor: 2000, createdAt: 'ORIGINAL_TIME' });
  await expect(updateExpense('alice', 'trip-1', 'missing', input)).rejects.toThrow('bulunamadı');
});
it('rejects account mismatch, foreign ownership, missing trips and invalid amounts', async () => {
  await expect(ensureExpenseLedger('bob', 'trip-1')).rejects.toThrow('izniniz');
  await expect(ensureExpenseLedger('alice', 'missing')).rejects.toThrow('bulunamadı');
  fake.data.set('trips/trip-1', { ownerId: 'bob', status: 'active' });
  await expect(ensureExpenseLedger('alice', 'trip-1')).rejects.toThrow('kullanılamıyor');
  fake.data.delete('trips/trip-1'); await ensureExpenseLedger('alice', 'trip-1');
  await expect(addExpense('alice', 'trip-1', { ...input, amount: -1 })).rejects.toThrow('tutar');
  expect(fake.data.get('trips/trip-1')?.hasExpenses).toBe(false);
});
it('deletes paginated expenses and retains a permanent ownership tombstone', async () => {
  await ensureExpenseLedger('alice', 'trip-1');
  for (let index = 0; index < 405; index++) fake.data.set(`trips/trip-1/expenses/${index}`, {});
  await deleteTripWithExpenses('alice', 'trip-1');
  expect(fake.data.has('users/alice/trips/trip-1')).toBe(false);
  expect([...fake.data.keys()].filter(key => key.includes('/expenses/'))).toHaveLength(0);
  expect(fake.data.get('trips/trip-1')).toMatchObject({ ownerId: 'alice', status: 'deleted' });
});
it('provides a cleanup function for realtime subscriptions', () => {
  const change = vi.fn(); const unsubscribe = subscribeExpenses('alice', 'trip-1', change, vi.fn());
  expect(change).toHaveBeenCalledWith([]); unsubscribe(); expect(fake.unsubscribe).toHaveBeenCalled();
});
