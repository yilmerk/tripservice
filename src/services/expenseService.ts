import { collection, doc, getDocs, limit, onSnapshot, orderBy, query, runTransaction, serverTimestamp, writeBatch } from 'firebase/firestore';
import { auth, db } from '../firebase';
import type { Currency, Expense, ExpenseInput, ExpenseLedger } from '../types/expense';
import { isCurrency, toMinor, validateExpense } from '../utils/money';
export type { Currency, Expense, ExpenseInput, ExpenseLedger } from '../types/expense';

function refs(userId: string, tripId: string) {
  if (!db || !auth) throw new Error('Firebase bağlantısı yapılandırılmadı.');
  if (auth.currentUser?.uid !== userId) throw new Error('Bu seyahate erişim izniniz yok.');
  if (!userId || !tripId || userId.includes('/') || tripId.includes('/')) throw new Error('Geçersiz belge kimliği.');
  return { database: db, trip: doc(db, 'users', userId, 'trips', tripId), ledger: doc(db, 'trips', tripId), expenses: collection(db, 'trips', tripId, 'expenses') };
}
function assertOwner(ledger: ExpenseLedger, userId: string) {
  if (ledger.ownerId !== userId || ledger.status !== 'active') throw new Error('Seyahatin harcama kaydı kullanılamıyor.');
}
export async function ensureExpenseLedger(userId: string, tripId: string): Promise<ExpenseLedger> {
  const r = refs(userId, tripId);
  return runTransaction(r.database, async tx => {
    const trip = await tx.get(r.trip); const ledger = await tx.get(r.ledger);
    if (!trip.exists()) throw new Error('Seyahat bulunamadı.');
    if (ledger.exists()) { const data = ledger.data() as ExpenseLedger; assertOwner(data, userId); return data; }
    const currency = trip.data().currency ?? 'EUR';
    if (!isCurrency(currency)) throw new Error('Seyahatin para birimi geçersiz.');
    const data: ExpenseLedger = { ownerId: userId, currency, hasExpenses: false, status: 'active' };
    tx.set(r.ledger, { ...data, createdAt: serverTimestamp() });
    return data;
  });
}
export async function setTripBudget(userId: string, tripId: string, totalBudget: number, currency: Currency): Promise<void> {
  toMinor(totalBudget, currency, true);
  const r = refs(userId, tripId);
  await runTransaction(r.database, async tx => {
    const trip = await tx.get(r.trip); const ledger = await tx.get(r.ledger);
    if (!trip.exists()) throw new Error('Seyahat bulunamadı.');
    if (ledger.exists()) {
      const data = ledger.data() as ExpenseLedger; assertOwner(data, userId);
      if (data.hasExpenses && data.currency !== currency) throw new Error('İlk harcamadan sonra ana para birimi değiştirilemez.');
      tx.update(r.ledger, { currency });
    } else tx.set(r.ledger, { ownerId: userId, currency, hasExpenses: false, status: 'active', createdAt: serverTimestamp() });
    tx.update(r.trip, { totalBudget, currency, updatedAt: serverTimestamp() });
  });
}
async function writeExpense(userId: string, tripId: string, input: ExpenseInput, expenseId?: string): Promise<string> {
  const r = refs(userId, tripId);
  if (expenseId !== undefined && (!expenseId || expenseId.includes('/'))) throw new Error('Geçersiz harcama kimliği.');
  const ref = expenseId ? doc(r.expenses, expenseId) : doc(r.expenses);
  await runTransaction(r.database, async tx => {
    const trip = await tx.get(r.trip); const ledger = await tx.get(r.ledger);
    const existing = expenseId ? await tx.get(ref) : null;
    if (!trip.exists()) throw new Error('Seyahat bulunamadı.');
    if (!ledger.exists()) throw new Error('Önce bütçe panelini yükleyin.');
    const data = ledger.data() as ExpenseLedger; assertOwner(data, userId);
    if (expenseId && !existing?.exists()) throw new Error('Harcama bulunamadı.');
    const currency = trip.data().currency ?? 'EUR';
    if (!isCurrency(currency) || data.currency !== currency) throw new Error('Seyahat para birimi değişti. Sayfayı yenileyin.');
    const expense = validateExpense(input, currency);
    tx.set(ref, { ...expense, createdAt: existing?.data()?.createdAt ?? serverTimestamp(), updatedAt: serverTimestamp() });
    tx.update(r.ledger, { hasExpenses: true });
    tx.update(r.trip, { budgetCurrencyLocked: true, updatedAt: serverTimestamp() });
  });
  return ref.id;
}
export async function addExpense(userId: string, tripId: string, input: ExpenseInput): Promise<string> {
  await ensureExpenseLedger(userId, tripId);
  return writeExpense(userId, tripId, input);
}
export async function getExpenses(userId: string, tripId: string): Promise<Expense[]> {
  await ensureExpenseLedger(userId, tripId);
  const r = refs(userId, tripId);
  const snapshot = await getDocs(query(r.expenses, orderBy('date', 'desc')));
  return snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as Expense);
}
export async function updateExpense(userId: string, tripId: string, expenseId: string, input: ExpenseInput): Promise<void> { await writeExpense(userId, tripId, input, expenseId); }
export async function deleteExpense(userId: string, tripId: string, expenseId: string): Promise<void> {
  const r = refs(userId, tripId);
  if (!expenseId || expenseId.includes('/')) throw new Error('Geçersiz harcama kimliği.');
  await runTransaction(r.database, async tx => {
    const ledger = await tx.get(r.ledger);
    if (!ledger.exists()) throw new Error('Harcama kaydı bulunamadı.');
    assertOwner(ledger.data() as ExpenseLedger, userId);
    tx.delete(doc(r.expenses, expenseId));
  });
}
export function subscribeExpenses(userId: string, tripId: string, onChange: (expenses: Expense[]) => void, onError: (error: Error) => void) {
  const r = refs(userId, tripId);
  return onSnapshot(query(r.expenses, orderBy('date', 'desc')), snapshot => {
    onChange(snapshot.docs.map(item => ({ ...item.data(), id: item.id }) as Expense));
  }, onError);
}
// Firestore does not cascade document deletions. A permanent ownership tombstone
// prevents an unrelated account from claiming leftover records after deletion.
export async function deleteTripWithExpenses(userId: string, tripId: string): Promise<void> {
  const r = refs(userId, tripId);
  const hasLedger = await runTransaction(r.database, async tx => {
    const ledger = await tx.get(r.ledger);
    if (!ledger.exists()) { tx.delete(r.trip); return false; }
    if (ledger.data().ownerId !== userId) throw new Error('Erişim izniniz yok.');
    if (ledger.data().status === 'deleted') return false;
    tx.update(r.ledger, { status: 'deleting' }); return true;
  });
  if (!hasLedger) return;
  for (;;) {
    const snapshot = await getDocs(query(r.expenses, limit(400)));
    if (snapshot.empty) break;
    const batch = writeBatch(r.database); snapshot.docs.forEach(item => batch.delete(item.ref)); await batch.commit();
  }
  await runTransaction(r.database, async tx => { tx.update(r.ledger, { status: 'deleted' }); tx.delete(r.trip); });
}
