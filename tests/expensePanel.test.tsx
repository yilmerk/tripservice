// @vitest-environment jsdom
import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { Expense } from '../src/types/expense';
const mocks = vi.hoisted(() => ({ ensure: vi.fn(), add: vi.fn(), update: vi.fn(), budget: vi.fn(), remove: vi.fn(), unsubscribe: vi.fn(), expenses: [] as Expense[] }));
vi.mock('../src/services/expenseService', () => ({
  ensureExpenseLedger: mocks.ensure, addExpense: mocks.add, updateExpense: mocks.update, setTripBudget: mocks.budget, deleteExpense: mocks.remove,
  subscribeExpenses: (_uid: string, _tripId: string, next: (data: Expense[]) => void) => { next(mocks.expenses); return mocks.unsubscribe; },
}));
import ExpensePanel from '../src/components/ExpensePanel';
const trip = { id: 'trip-1', title: 'Roma', totalBudget: 100, currency: 'EUR' as const, destinations: [], createdAt: null, updatedAt: null };
beforeEach(() => {
  vi.clearAllMocks(); mocks.ensure.mockResolvedValue({ hasExpenses: true });
  mocks.expenses = [{ id: 'meal', name: 'Akşam yemeği', amountMinor: 8100, baseAmountMinor: 8100, currency: 'EUR', baseCurrency: 'EUR', exchangeRate: 1, date: '2026-11-01', category: 'food', createdAt: null, updatedAt: null }];
  Object.defineProperties(HTMLDialogElement.prototype, { showModal: { configurable: true, value() { this.setAttribute('open', ''); } }, close: { configurable: true, value() { this.removeAttribute('open'); } } });
});
afterEach(cleanup);
it('shows the 80 percent warning and caps an exceeded progress bar while preserving the actual total', async () => {
  const view = render(<ExpensePanel userId="alice" trip={trip}/>);
  expect(await screen.findByText('Bütçenin %80’inden fazlası kullanıldı')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('81');
  view.rerender(<ExpensePanel userId="alice" trip={{ ...trip, totalBudget: 50 }}/>);
  expect(screen.getByText('Bütçe aşıldı')).toBeTruthy();
  expect(screen.getByRole('progressbar').getAttribute('aria-valuenow')).toBe('100');
  expect(screen.getByText('%162')).toBeTruthy();
  view.unmount(); expect(mocks.unsubscribe).toHaveBeenCalled();
});
it('saves a foreign currency expense with an explicit exchange rate', async () => {
  const user = userEvent.setup(); render(<ExpensePanel userId="alice" trip={trip}/>);
  await waitFor(() => expect((screen.getByRole('button', { name: 'Harcama ekle' }) as HTMLButtonElement).disabled).toBe(false));
  await user.click(screen.getByRole('button', { name: 'Harcama ekle' }));
  await user.type(screen.getByLabelText('Harcama adı'), 'Taksi');
  await user.type(screen.getByLabelText('Tutar'), '10');
  await user.selectOptions(screen.getByLabelText('Para birimi'), 'USD');
  await user.type(screen.getByLabelText(/Dönüşüm kuru/), '0.9');
  await user.selectOptions(screen.getByLabelText('Harcama kategorisi'), 'transport');
  await user.click(screen.getByRole('button', { name: 'Harcamayı kaydet' }));
  expect(mocks.add).toHaveBeenCalledWith('alice', 'trip-1', expect.objectContaining({ name: 'Taksi', amount: 10, currency: 'USD', exchangeRate: 0.9, category: 'transport' }));
});
it('edits the target budget but locks currency after the first expense', async () => {
  const user = userEvent.setup(); render(<ExpensePanel userId="alice" trip={trip}/>);
  await waitFor(() => expect((screen.getByRole('button', { name: 'Bütçeyi düzenle' }) as HTMLButtonElement).disabled).toBe(false));
  await user.click(screen.getByRole('button', { name: 'Bütçeyi düzenle' }));
  expect((screen.getByLabelText('Varsayılan para birimi') as HTMLSelectElement).disabled).toBe(true);
  await user.clear(screen.getByLabelText('Hedef bütçe')); await user.type(screen.getByLabelText('Hedef bütçe'), '200');
  await user.click(screen.getByRole('button', { name: 'Bütçeyi kaydet' }));
  expect(mocks.budget).toHaveBeenCalledWith('alice', 'trip-1', 200, 'EUR');
});
it('confirms deletion and retains the form when saving fails', async () => {
  const user = userEvent.setup(); render(<ExpensePanel userId="alice" trip={trip}/>);
  await user.click(await screen.findByRole('button', { name: 'Akşam yemeği: harcamayı sil' }));
  expect(mocks.remove).not.toHaveBeenCalled();
  await user.click(screen.getByRole('button', { name: 'Harcamayı sil' }));
  expect(mocks.remove).toHaveBeenCalledWith('alice', 'trip-1', 'meal');
  mocks.add.mockRejectedValueOnce(new Error('Kaydedilemedi'));
  await user.click(screen.getByRole('button', { name: 'Harcama ekle' }));
  await user.type(screen.getByLabelText('Harcama adı'), 'Kafe'); await user.type(screen.getByLabelText('Tutar'), '5');
  await user.click(screen.getByRole('button', { name: 'Harcamayı kaydet' }));
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', 'Kaydedilemedi');
  expect(screen.getByRole('dialog')).toBeTruthy();
});
it('does not present a misleading zero total after a permission failure', async () => {
  mocks.ensure.mockRejectedValueOnce(Object.assign(new Error('Denied'), { code: 'permission-denied' }));
  render(<ExpensePanel userId="alice" trip={trip}/>);
  expect(await screen.findByRole('alert')).toHaveProperty('textContent', expect.stringContaining('firestore.rules'));
  expect(screen.queryByText('Harcanan Tutar')).toBeNull();
});
