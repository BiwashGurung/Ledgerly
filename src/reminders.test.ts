import { describe, expect, it } from 'vitest';
import { parseReminderText } from './reminders';

const now = new Date(2026, 9, 17, 14, 30);

describe('local natural-language reminder drafts', () => {
  it('suggests a title and date for a birthday without silently making it yearly', () => {
    const draft = parseReminderText("Tomorrow is my mother's birthday.", '09:00', 'NPR', now);
    expect(draft.title).toBe("Mother's birthday");
    expect(draft.dueDate).toBe('2026-10-18');
    expect(draft.recurrence).toBe('none');
    expect(draft.description).toContain('Choose yearly recurrence');
  });
  it('parses monthly rent amount, due day, and time into an editable draft', () => {
    const draft = parseReminderText('Pay NPR 10,000 rent on the first of every month at 9 AM.', '08:30', 'NPR', now);
    expect(draft.title).toBe('Rent');
    expect(draft.dueDate).toBe('2026-11-01');
    expect(draft.time).toBe('09:00');
    expect(draft.recurrence).toBe('monthly');
    expect(draft.amountMinor).toBe(1_000_000);
  });
  it('parses a later day this month and a PM time', () => {
    const draft = parseReminderText('Electricity bill due on the 20th at 6 PM.', '09:00', 'NPR', now);
    expect(draft.dueDate).toBe('2026-10-20');
    expect(draft.time).toBe('18:00');
    expect(draft.category).toBe('Bills and Utilities');
  });
  it('marks an ambiguous time for review while preserving the interpreted value', () => {
    const draft = parseReminderText('Remind me about my appointment tomorrow at 10.', '09:00', 'NPR', now);
    expect(draft.title).toBe('appointment');
    expect(draft.dueDate).toBe('2026-10-18');
    expect(draft.time).toBe('10:00');
    expect(draft.description).toContain('Review the proposed date or time');
  });
  it('uses the configured default time when no time is provided', () => {
    const draft = parseReminderText('Remind me to pay insurance in two weeks.', '08:15', 'NPR', now);
    expect(draft.dueDate).toBe('2026-10-31');
    expect(draft.time).toBe('08:15');
  });
});
