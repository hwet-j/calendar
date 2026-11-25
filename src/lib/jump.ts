import { expand, startOfDay } from './dates';
import type { CalEvent } from './types';

export interface DateTarget { year: number; month: number; day?: number }

const valid = (y: number, m: number, d?: number) =>
  y >= 1900 && y <= 2100 && m >= 1 && m <= 12 && (d === undefined || (d >= 1 && d <= new Date(y, m, 0).getDate()));

/**
 * 검색창에 입력한 날짜 표현을 해석. 지원 형식:
 *  2027 / 2027년 · 2027.3 / 2027-3 / 2027/3 / 2027 3 / 2027년 3월 · 2027.3.15 / 2027-03-15 / 2027년 3월 15일
 *  3월 · 3월 15일  (연도는 `ref`의 연도로 간주)
 */
export function parseDateQuery(q: string, ref: Date): DateTarget | null {
  const s = q.trim();
  if (!s) return null;
  let m: RegExpExecArray | null;
  if ((m = /^(\d{4})\s*년?$/.exec(s))) { const y = +m[1]; return valid(y, 1) ? { year: y, month: ref.getMonth() + 1 } : null; }
  if ((m = /^(\d{4})\s*(?:년|[-./\s])\s*(\d{1,2})\s*월?(?:\s*(?:[-./\s])?\s*(\d{1,2})\s*일?)?$/.exec(s))) {
    const y = +m[1], mo = +m[2], d = m[3] ? +m[3] : undefined;
    return valid(y, mo, d) ? { year: y, month: mo, day: d } : null;
  }
  if ((m = /^(\d{1,2})\s*월(?:\s*(\d{1,2})\s*일?)?$/.exec(s))) {
    const y = ref.getFullYear(), mo = +m[1], d = m[2] ? +m[2] : undefined;
    return valid(y, mo, d) ? { year: y, month: mo, day: d } : null;
  }
  return null;
}

export interface SearchHit { event: CalEvent; date: Date }

/**
 * 제목·장소·메모에서 검색. 각 결과의 이동 날짜는
 * 반복 일정이면 오늘 이후 가장 가까운 발생일(없으면 첫 일정일), 단발 일정이면 시작일.
 */
export function searchEvents(events: CalEvent[], q: string, today = new Date(), limit = 30): SearchHit[] {
  const needle = q.trim().toLowerCase();
  if (!needle) return [];
  const hits: SearchHit[] = [];
  const t0 = startOfDay(today);
  for (const e of events) {
    const hay = `${e.title}\n${e.location ?? ''}\n${e.notes ?? ''}`.toLowerCase();
    if (!hay.includes(needle)) continue;
    let date = startOfDay(new Date(e.start));
    if (e.repeat !== 'none') {
      const next = expand([e], t0, new Date(t0.getFullYear() + 3, t0.getMonth(), t0.getDate()))[0];
      if (next) date = startOfDay(next.start);
    }
    hits.push({ event: e, date });
  }
  // 가까운 날짜 순 (오늘과의 거리)
  hits.sort((a, b) => Math.abs(a.date.getTime() - t0.getTime()) - Math.abs(b.date.getTime() - t0.getTime()));
  return hits.slice(0, limit);
}
