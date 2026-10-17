import { describe, expect, it } from 'vitest';
import { budgetAllowance, categorySpending, goalBalance, lifetimeBalance, monthKey, toMinor, totals } from './finance';
import type { Budget, Goal, Transaction } from './types';

const transaction = (id: string, type: 'income' | 'expense', amountMinor: number, date: string, category = 'Food and Dining'): Transaction => ({ id, type, amountMinor, date, category, description: id, createdAt: date, updatedAt: date });

describe('Ledgerly financial rules', () => {
  it('stores decimal amounts as integer minor units', () => {
    expect(toMinor('123.45', 'USD')).toBe(12345);
    expect(toMinor('123.45', 'NPR')).toBe(12345);
    expect(() => toMinor('-1', 'NPR')).toThrow();
  });
  it('calculates selected-period and lifetime totals from valid records', () => {
    const items = [transaction('salary', 'income', 250000, '2026-10-01'), transaction('lunch', 'expense', 1250, '2026-10-02'), transaction('old', 'expense', 5000, '2026-09-28'), { ...transaction('bad', 'expense', 0, '2026-10-04') }];
    expect(totals(items, '2026-10')).toEqual({ income: 250000, expenses: 1250 });
    expect(lifetimeBalance(items)).toBe(243750);
  });
  it('uses local calendar month boundaries for persisted date strings', () => {
    expect(monthKey('2026-01-31')).toBe('2026-01');
    expect(monthKey('2026-02-01')).toBe('2026-02');
  });
  it('counts category expenses and excludes income', () => {
    const items = [transaction('rent', 'expense', 10000, '2026-10-01', 'Housing and Rent'), transaction('salary', 'income', 20000, '2026-10-01', 'Housing and Rent')];
    expect(categorySpending(items, 'Housing and Rent', '2026-10')).toBe(10000);
  });
  it('rolls only the prior budget positive remainder into the next period', () => {
    const budgets: Budget[] = [
      { id: 'sep', month: '2026-09', category: 'Food and Dining', limitMinor: 20000, rollover: true },
      { id: 'oct', month: '2026-10', category: 'Food and Dining', limitMinor: 30000, rollover: true },
    ];
    const items = [transaction('september-food', 'expense', 8000, '2026-09-12')];
    const result = budgetAllowance(budgets[1], budgets, items);
    expect(result.carryMinor).toBe(12000);
    expect(result.allowanceMinor).toBe(42000);
    expect(result.remainingMinor).toBe(42000);
  });
  it('tracks goal withdrawals without going below the derived allocation', () => {
    const goal: Goal = { id: 'goal', title: 'Rainy day', targetMinor: 50000, contributions: [
      { id: 'one', date: '2026-10-01', amountMinor: 20000, type: 'deposit' },
      { id: 'two', date: '2026-10-02', amountMinor: 4000, type: 'withdrawal' },
    ] };
    expect(goalBalance(goal)).toBe(16000);
  });
});
