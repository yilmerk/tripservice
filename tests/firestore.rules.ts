import { readFileSync } from 'node:fs';
import { afterAll, beforeAll, beforeEach, expect, it } from 'vitest';
import { assertFails, assertSucceeds, initializeTestEnvironment, type RulesTestEnvironment } from '@firebase/rules-unit-testing';
import { collection, doc, getDoc, getDocs, serverTimestamp, setDoc, updateDoc, writeBatch } from 'firebase/firestore';
let env: RulesTestEnvironment;
beforeAll(async () => {
  if (!process.env.FIRESTORE_EMULATOR_HOST) throw new Error('Run this suite with the Firestore emulator.');
  env = await initializeTestEnvironment({ projectId: 'demo-rota', firestore: { rules: readFileSync('firestore.rules', 'utf8') } });
});
afterAll(async () => { await env?.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async context => { await setDoc(doc(context.firestore(), 'users/alice/trips/trip-1'), { title: 'Roma', currency: 'EUR', totalBudget: 1000 }); });
});
const alice = () => env.authenticatedContext('alice').firestore();
const ledger = () => ({ ownerId: 'alice', currency: 'EUR', hasExpenses: false, status: 'active', createdAt: serverTimestamp() });
const expense = () => ({ name: 'Yemek', amountMinor: 1000, baseAmountMinor: 1000, currency: 'EUR', baseCurrency: 'EUR', exchangeRate: 1, date: '2026-11-01', category: 'food', createdAt: serverTimestamp(), updatedAt: serverTimestamp() });
async function register() { await assertSucceeds(setDoc(doc(alice(), 'trips/trip-1'), ledger())); }
async function add() {
  const db = alice(); const batch = writeBatch(db);
  batch.update(doc(db, 'trips/trip-1'), { hasExpenses: true });
  batch.update(doc(db, 'users/alice/trips/trip-1'), { budgetCurrencyLocked: true });
  batch.set(doc(db, 'trips/trip-1/expenses/meal'), expense());
  await assertSucceeds(batch.commit());
}
it('allows the owner to initialize a legacy trip and add/list expenses', async () => {
  await register(); await add();
  expect((await assertSucceeds(getDocs(collection(alice(), 'trips/trip-1/expenses')))).size).toBe(1);
});
it('denies unauthenticated and foreign-account reads and writes', async () => {
  await register(); await add();
  for (const db of [env.unauthenticatedContext().firestore(), env.authenticatedContext('bob').firestore()]) {
    await assertFails(getDoc(doc(db, 'trips/trip-1/expenses/meal')));
    await assertFails(getDocs(collection(db, 'trips/trip-1/expenses')));
    await assertFails(setDoc(doc(db, 'trips/trip-1/expenses/other'), expense()));
  }
});
it('rejects forged ownership, including a second user with a same-ID source trip', async () => {
  await assertFails(setDoc(doc(alice(), 'trips/trip-1'), { ...ledger(), ownerId: 'bob' }));
  await register();
  const bob = env.authenticatedContext('bob').firestore();
  await assertSucceeds(setDoc(doc(bob, 'users/bob/trips/trip-1'), { title: 'Copy' }));
  await assertFails(updateDoc(doc(bob, 'trips/trip-1'), { ownerId: 'bob' }));
  await assertFails(setDoc(doc(bob, 'trips/trip-1/expenses/other'), expense()));
});
it('locks the base currency and ownership after the first expense', async () => {
  await register(); await add();
  await assertFails(updateDoc(doc(alice(), 'users/alice/trips/trip-1'), { currency: 'USD' }));
  await assertFails(updateDoc(doc(alice(), 'trips/trip-1'), { currency: 'USD' }));
  await assertFails(updateDoc(doc(alice(), 'trips/trip-1'), { hasExpenses: false }));
  await assertFails(updateDoc(doc(alice(), 'trips/trip-1'), { ownerId: 'bob' }));
  await assertSucceeds(updateDoc(doc(alice(), 'users/alice/trips/trip-1'), { totalBudget: 2000 }));
});
it('rejects malformed amounts and writes after deletion has started', async () => {
  await register(); await add();
  await assertFails(updateDoc(doc(alice(), 'trips/trip-1/expenses/meal'), { amountMinor: -1, updatedAt: serverTimestamp() }));
  await assertFails(updateDoc(doc(alice(), 'trips/trip-1/expenses/meal'), { baseCurrency: 'USD', updatedAt: serverTimestamp() }));
  await assertSucceeds(updateDoc(doc(alice(), 'trips/trip-1'), { status: 'deleting' }));
  await assertFails(setDoc(doc(alice(), 'trips/trip-1/expenses/extra'), expense()));
});
