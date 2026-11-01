import { currencies, expenseCategories, type Currency, type Expense, type ExpenseCategory, type ExpenseInput } from '../types/expense';
export function isCurrency(value: unknown): value is Currency {
  return currencies.includes(value as Currency);
}
export function digits(currency: Currency) { return currency === 'JPY' ? 0 : 2; }
export function toMinor(amount: number, currency: Currency, allowZero = false) {
  if (!isCurrency(currency)) throw new Error('Desteklenen bir para birimi seçin.');
  const scaled = amount * 10 ** digits(currency);
  const minor = Math.round(scaled);
  if (!Number.isFinite(amount) || amount < 0 || (!allowZero && minor <= 0) || !Number.isSafeInteger(minor) || minor > 1e12 || Math.abs(amount - minor / 10 ** digits(currency)) > Number.EPSILON * Math.max(1, Math.abs(amount)) * 8) {
    throw new Error(`Geçerli bir tutar girin (en fazla ${digits(currency)} ondalık basamak).`);
  }
  return minor;
}
export function formatMoney(minor: number, currency: Currency) {
  return new Intl.NumberFormat('tr-TR', { style: 'currency', currency }).format(minor / 10 ** digits(currency));
}
export function validateExpense(input: ExpenseInput, baseCurrency: Currency) {
  if (!input.name.trim() || input.name.length > 150) throw new Error('Harcama adı 1–150 karakter olmalı.');
  if (!Object.hasOwn(expenseCategories, input.category)) throw new Error('Geçersiz harcama kategorisi.');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(input.date) || Number.isNaN(Date.parse(input.date)) || new Date(`${input.date}T00:00:00Z`).toISOString().slice(0, 10) !== input.date) throw new Error('Geçerli bir tarih girin.');
  const amountMinor = toMinor(input.amount, input.currency);
  const exchangeRate = input.currency === baseCurrency ? 1 : input.exchangeRate;
  if (exchangeRate === undefined || !Number.isFinite(exchangeRate) || exchangeRate <= 0 || exchangeRate > 1e9) throw new Error('Farklı para birimi için geçerli bir dönüşüm kuru girin.');
  const baseAmountMinor = Math.round(input.amount * exchangeRate * 10 ** digits(baseCurrency));
  if (!Number.isSafeInteger(baseAmountMinor) || baseAmountMinor < 0 || baseAmountMinor > 1e12) throw new Error('Dönüştürülen tutar çok büyük.');
  return { name: input.name.trim(), date: input.date, category: input.category, currency: input.currency, amountMinor, exchangeRate, baseCurrency, baseAmountMinor };
}
export function expenseSummary(expenses: Expense[], budget: number | undefined, currency: Currency) {
  const categories = Object.fromEntries(Object.keys(expenseCategories).map(key => [key, 0])) as Record<ExpenseCategory, number>;
  let spent = 0;
  for (const expense of expenses) {
    if (expense.baseCurrency !== currency) throw new Error('Harcama ve bütçe para birimleri eşleşmiyor.');
    spent += expense.baseAmountMinor;
    categories[expense.category] += expense.baseAmountMinor;
  }
  const budgetMinor = budget === undefined ? undefined : toMinor(budget, currency, true);
  const remaining = budgetMinor === undefined ? undefined : budgetMinor - spent;
  const percent = budgetMinor === undefined ? 0 : budgetMinor === 0 ? (spent > 0 ? 100 : 0) : spent / budgetMinor * 100;
  return { spent, budgetMinor, remaining, percent, categories, overBudget: remaining !== undefined && remaining < 0 };
}
