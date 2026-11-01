import type { Timestamp } from 'firebase/firestore';

export const currencies = ['EUR', 'USD', 'TRY', 'GBP', 'CHF', 'CAD', 'AUD', 'JPY', 'PLN', 'CZK', 'SEK', 'NOK', 'DKK', 'AED'] as const;
export type Currency = typeof currencies[number];
export const expenseCategories = {
  accommodation: 'Konaklama 🏨', transport: 'Ulaşım ✈️/🚆', food: 'Yeme-İçme 🍽️',
  shopping: 'Müteferrik/Alışveriş 🛍️', activities: 'Müze & Etkinlik 🎟️', other: 'Diğer 💳',
} as const;
export type ExpenseCategory = keyof typeof expenseCategories;
export interface ExpenseInput {
  name: string;
  amount: number;
  currency: Currency;
  date: string; // local calendar date YYYY-MM-DD
  category: ExpenseCategory;
  exchangeRate?: number; // 1 original currency unit = this many trip currency units
}
export interface Expense extends Omit<ExpenseInput, 'amount' | 'exchangeRate'> {
  id: string;
  amountMinor: number;
  baseAmountMinor: number;
  baseCurrency: Currency;
  exchangeRate: number;
  createdAt: Timestamp | null;
  updatedAt: Timestamp | null;
}
export interface ExpenseLedger {
  ownerId: string;
  currency: Currency;
  hasExpenses: boolean;
  status: 'active' | 'deleting' | 'deleted';
}
