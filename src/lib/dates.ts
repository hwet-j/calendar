import type { CalEvent, Occurrence } from './types';

export const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
export const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n, d.getHours(), d.getMinutes());
export const sameDay = (a: Date, b: Date) =>
  a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

/** 월 달력 그리드(일요일 시작, 항상 6주) */
export function monthGrid(year: number, month: number): Date[] {
  const first = new Date(year, month, 1);
  const start = new Date(year, month, 1 - first.getDay());
  return Array.from({ length: 42 }, (_, i) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + i));
}

function shift(d: Date, repeat: CalEvent['repeat'], n: number): Date {
  const r = new Date(d);
  if (repeat === 'daily') r.setDate(r.getDate() + n);
  else if (repeat === 'weekly') r.setDate(r.getDate() + 7 * n);
  else if (repeat === 'monthly') {
    const day = d.getDate();
    r.setDate(1);
    r.setMonth(r.getMonth() + n);
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(day, last));
  } else if (repeat === 'yearly') {
    const day = d.getDate();
    r.setDate(1);
    r.setFullYear(r.getFullYear() + n);
    const last = new Date(r.getFullYear(), r.getMonth() + 1, 0).getDate();
    r.setDate(Math.min(day, last));
  }
  return r;
}

/** [from, to) 범위의 반복 일정을 개별 발생(occurrence)으로 펼침 */
export function expand(events: CalEvent[], from: Date, to: Date): Occurrence[] {
  const out: Occurrence[] = [];
  for (const ev of events) {
    const s = new Date(ev.start);
    const e = new Date(ev.end);
    const dur = e.getTime() - s.getTime();
    if (ev.repeat === 'none') {
      if (s < to && e >= from) out.push({ event: ev, start: s, end: e });
      continue;
    }
    for (let n = 0; n < 5000; n++) {
      const os = shift(s, ev.repeat, n);
      if (os >= to) break;
      const oe = new Date(os.getTime() + dur);
      if (oe >= from) out.push({ event: ev, start: os, end: oe });
    }
  }
  return out.sort((a, b) => a.start.getTime() - b.start.getTime());
}

/** 특정 날짜에 걸치는 일정 */
export function onDay(occ: Occurrence[], day: Date): Occurrence[] {
  const s = startOfDay(day);
  const e = addDays(s, 1);
  return occ.filter((o) => o.start < e && o.end >= s && (o.end > s || o.start >= s));
}

export const fmtTime = (d: Date) =>
  `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
