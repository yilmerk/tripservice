import { expect, it } from 'vitest';
import { expenseSummary, toMinor, validateExpense } from '../src/utils/money';
import type { Expense, ExpenseInput } from '../src/types/expense';
const input: ExpenseInput = { name: 'Akşam yemeği', amount: 10, currency: 'EUR', date: '2026-11-01', category: 'food' };
it('uses minor units without floating-point total errors', () => {
  expect(toMinor(0.1 + 0.2, 'EUR')).toBe(30);
  const expenses = [10, 20].map((baseAmountMinor, index) => ({ ...validateExpense(input, 'EUR'), id: String(index), baseAmountMinor, createdAt: null, updatedAt: null })) as Expense[];
  expect(expenseSummary(expenses, 1, 'EUR')).toMatchObject({ spent: 30, remaining: 70, percent: 30, categories: { food: 30 } });
});
it('converts foreign currency with an explicit historical rate', () => {
  expect(validateExpense({ ...input, amount: 100, currency: 'JPY', exchangeRate: 0.006 }, 'EUR')).toMatchObject({ amountMinor: 100, baseAmountMinor: 60, exchangeRate: 0.006 });
  expect(() => validateExpense({ ...input, currency: 'USD' }, 'EUR')).toThrow('kur');
  expect(validateExpense({ ...input, exchangeRate: 55 }, 'EUR').exchangeRate).toBe(1);
});
it('rejects invalid money, unsupported categories and impossible dates', () => {
  for (const amount of [NaN, Infinity, -1, 0, 0.001, 0.00000001]) expect(() => validateExpense({ ...input, amount }, 'EUR')).toThrow();
  expect(() => toMinor(1.5, 'JPY')).toThrow();
  expect(() => validateExpense({ ...input, date: '2026-02-30' }, 'EUR')).toThrow('tarih');
  expect(() => validateExpense({ ...input, category: '__proto__' as never }, 'EUR')).toThrow('kategori');
});
it('handles unset, zero and exceeded budgets without NaN or infinity', () => {
  const expenses = [{ ...validateExpense(input, 'EUR'), id: 'x', createdAt: null, updatedAt: null }];
  expect(expenseSummary(expenses, undefined, 'EUR')).toMatchObject({ budgetMinor: undefined, remaining: undefined, percent: 0 });
  expect(expenseSummary(expenses, 0, 'EUR')).toMatchObject({ remaining: -1000, percent: 100, overBudget: true });
  expect(expenseSummary(expenses, 5, 'EUR')).toMatchObject({ percent: 200, remaining: -500 });
  expect(() => expenseSummary(expenses, 5, 'USD')).toThrow('eşleşmiyor');
});
