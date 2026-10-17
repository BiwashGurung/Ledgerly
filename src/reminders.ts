import type { Currency, Reminder } from './types';
import { toMinor } from './finance';

export type ReminderDraft = Pick<Reminder, 'title' | 'dueDate' | 'time' | 'recurrence'> & Partial<Pick<Reminder, 'category' | 'amountMinor' | 'description'>>;
const pad = (value: number) => String(value).padStart(2, '0');
const formatDate = (date: Date) => `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
const localDate = (date: Date) => new Date(date.getFullYear(), date.getMonth(), date.getDate(), 12);
const MONTHS: Record<string, number> = { jan: 0, january: 0, feb: 1, february: 1, mar: 2, march: 2, apr: 3, april: 3, may: 4, jun: 5, june: 5, jul: 6, july: 6, aug: 7, august: 7, sep: 8, sept: 8, september: 8, oct: 9, october: 9, nov: 10, november: 10, dec: 11, december: 11 };
const MONTH_PATTERN = 'january|february|march|april|may|june|july|august|september|october|november|december|jan|feb|mar|apr|jun|jul|aug|sep|sept|oct|nov|dec';

export function parseReminderText(text: string, defaultTime: string, currency: Currency, now = new Date()): ReminderDraft {
  const lower = text.toLowerCase();
  const dateText = lower.replace(/(?:npr|rs\.?|\$|usd)\s*[\d,.]+/gi, ' ');
  const dateNumbers = dateText.replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(?:am|pm)?\b/gi, ' ');
  const current = localDate(now); let due = new Date(current); let uncertain = false; let explicitDate = false;
  const iso = dateNumbers.match(/\b\d{4}-\d{2}-\d{2}\b/)?.[0];
  if (dateText.includes('tomorrow')) { due.setDate(due.getDate() + 1); explicitDate = true; }
  else if (/\btoday\b/.test(dateText)) explicitDate = true;
  else if (/in\s+two\s+weeks/.test(dateText)) { due.setDate(due.getDate() + 14); explicitDate = true; }
  else {
    const days = dateText.match(/in\s+(\d+)\s+days?/);
    const weeks = dateText.match(/in\s+(\d+)\s+weeks?/);
    if (days) { due.setDate(due.getDate() + Number(days[1])); explicitDate = true; }
    else if (weeks) { due.setDate(due.getDate() + Number(weeks[1]) * 7); explicitDate = true; }
    else if (iso) { const [y, m, d] = iso.split('-').map(Number); const parsed = new Date(y, m - 1, d, 12); if (parsed.getFullYear() === y && parsed.getMonth() === m - 1 && parsed.getDate() === d) { due = parsed; explicitDate = true; } else uncertain = true; }
    else {
      const monthFirst = dateNumbers.match(new RegExp(`\\b(${MONTH_PATTERN})\\s+(\\d{1,2})(?:st|nd|rd|th)?(?:,?\\s+(\\d{4}))?\\b`));
      const dayFirst = dateNumbers.match(new RegExp(`\\b(\\d{1,2})(?:st|nd|rd|th)?\\s+(${MONTH_PATTERN})(?:\\s+(\\d{4}))?\\b`));
      if (monthFirst || dayFirst) {
        const monthText = monthFirst ? monthFirst[1] : dayFirst![2]; const day = Number(monthFirst ? monthFirst[2] : dayFirst![1]); const yearText = monthFirst ? monthFirst[3] : dayFirst![3]; const monthIndex = MONTHS[monthText.slice(0, 3)];
        const year = yearText ? Number(yearText) : current.getFullYear(); const candidate = new Date(year, monthIndex, day, 12);
        if (candidate.getMonth() === monthIndex && candidate.getDate() === day) { due = candidate; if (!yearText && due < current) due.setFullYear(due.getFullYear() + 1); explicitDate = true; } else uncertain = true;
      } else if (/\b(first|1st)\b/.test(dateNumbers) || /\bon the 1\b/.test(dateNumbers)) {
        due = new Date(current); due.setDate(1); if (current.getDate() > 1) due.setMonth(due.getMonth() + 1); explicitDate = true;
      } else {
        const ordinal = dateNumbers.match(/\b(?:on|due on|by|the)\s+(?:the\s+)?(\d{1,2})(st|nd|rd|th)\b/);
        if (ordinal) { const day = Number(ordinal[1]); const currentDay = current.getDate(); due = new Date(current); due.setDate(1); if (day < currentDay) due.setMonth(due.getMonth() + 1); const monthEnd = new Date(due.getFullYear(), due.getMonth() + 1, 0).getDate(); if (day >= 1 && day <= 31) { due.setDate(Math.min(day, monthEnd)); explicitDate = true; } else uncertain = true; }
      }
    }
  }
  if (!explicitDate && !uncertain) uncertain = true;

  const timeMatch = dateText.match(/\b(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)\b/);
  const ambiguousTime = !timeMatch ? dateText.match(/\bat\s+(\d{1,2})(?::(\d{2}))?\b/) : null;
  let time = defaultTime;
  if (timeMatch) { const rawHour = Number(timeMatch[1]); const minute = Number(timeMatch[2] ?? '0'); if (rawHour >= 1 && rawHour <= 12 && minute <= 59) { let hour = rawHour % 12; if (timeMatch[3] === 'pm') hour += 12; time = `${pad(hour)}:${pad(minute)}`; } else uncertain = true; }
  else if (ambiguousTime) { const hour = Number(ambiguousTime[1]); const minute = Number(ambiguousTime[2] ?? '0'); if (hour <= 23 && minute <= 59) { time = `${pad(hour)}:${pad(minute)}`; if (hour <= 12) uncertain = true; } else uncertain = true; }

  const amountMatch = text.match(/(?:NPR|Rs\.?|\$|USD)\s*([\d,]+(?:\.\d{1,2})?)/i); let amountMinor: number | undefined;
  if (amountMatch) { try { amountMinor = toMinor(amountMatch[1].replaceAll(',', ''), currency); } catch { uncertain = true; } }
  let title = text.replace(/^(please\s+)?(remind me to|remind me about|remind me|pay|my)\s+/i, '');
  title = title.replace(/\b(?:tomorrow|today|in two weeks|in \d+ days?|in \d+ weeks?|every month|monthly|each month|every year|annually|on the first|on the \d+(?:st|nd|rd|th)?|on \d+(?:st|nd|rd|th)?|due on the \d+(?:st|nd|rd|th)?|at \d{1,2}(?::\d{2})?\s*(?:am|pm)?|\d{4}-\d{2}-\d{2})\b/gi, ' ');
  title = title.replace(/\b(?:NPR|Rs\.?|USD|\$)\s*[\d,.]+/gi, ' ').replace(/[—–:]+/g, ' ').replace(/\s+/g, ' ').replace(/[.!?]+$/, '').trim();
  title = title.replace(/^is\s+/i, '').replace(/^my\s+/i, '').trim();
  if (!title || (/birthday/i.test(title) && /mother/i.test(title))) title = "Mother's birthday";
  if (/rent/i.test(title)) title = 'Rent'; else if (/electricity/i.test(title)) title = 'Electricity bill'; else if (/subscription/i.test(title)) title = 'Subscription renewal';
  const recurrence: Reminder['recurrence'] = /every year|annually/i.test(lower) ? 'yearly' : /every month|monthly|each month/i.test(lower) ? 'monthly' : 'none';
  const category = /rent/i.test(title) ? 'Housing and Rent' : /bill/i.test(title) ? 'Bills and Utilities' : /subscription/i.test(title) ? 'Subscriptions' : 'Other';
  const notes = [uncertain ? `Review the proposed date or time: ${text}` : '', /birthday/i.test(lower) && !/every year|annually/i.test(lower) ? 'Birthday noted. Choose yearly recurrence if you want this reminder to repeat.' : ''].filter(Boolean).join(' ');
  return { title, dueDate: formatDate(due), time, recurrence, category, amountMinor, description: notes || undefined };
}
