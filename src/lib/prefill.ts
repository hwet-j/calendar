import { startOfDay } from './dates';
import type { CalEvent } from './types';

/**
 * 딥링크로 새 일정 화면을 열 때 값을 미리 채운다. 예:
 *   calendarapp://event/new?title=치과&start=2026-11-27T15:00&end=2026-11-27T16:00&location=강남
 *   calendarapp://event/new?title=제사&start=2026-12-01&allDay=1
 *
 * 외부 앱이 보낸 값이므로 길이·날짜 범위를 검증하고, 자동 저장은 하지 않는다 (사용자가 저장을 눌러야 등록).
 * 날짜에 시간대(Z/+09:00)가 없으면 기기의 현지 시각으로 해석한다.
 */
export type PrefillParams = Partial<Record<'title' | 'start' | 'end' | 'allDay' | 'location' | 'notes', string | string[]>>;

const first = (v: string | string[] | undefined) => (Array.isArray(v) ? v[0] : v);
const text = (v: string | string[] | undefined, max: number) => {
  const s = first(v)?.trim();
  return s ? s.slice(0, max) : undefined;
};

function parseDate(v: string | string[] | undefined): Date | undefined {
  const s = first(v)?.trim();
  if (!s) return undefined;
  // 날짜만 있는 값(YYYY-MM-DD)은 JS가 UTC 로 해석하므로 현지 자정으로 직접 만든다.
  const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
  const d = m ? new Date(Number(m[1]), Number(m[2]) - 1, Number(m[3])) : new Date(s);
  const y = d.getFullYear();
  return Number.isNaN(d.getTime()) || y < 2000 || y > 2100 ? undefined : d;
}

export function applyPrefill(base: CalEvent, p: PrefillParams): CalEvent {
  const out: CalEvent = { ...base };
  const title = text(p.title, 200);
  if (title) out.title = title;
  const location = text(p.location, 200);
  if (location) out.location = location;
  const notes = text(p.notes, 2000);
  if (notes) out.notes = notes;

  const allDay = ['1', 'true'].includes(first(p.allDay)?.toLowerCase() ?? '');
  const s = parseDate(p.start) ?? (allDay ? new Date(base.start) : undefined);
  if (s) {
    const e = parseDate(p.end);
    const validEnd = e && e >= s ? e : undefined;
    if (allDay) {
      out.allDay = true;
      out.start = startOfDay(s).toISOString();
      out.end = startOfDay(validEnd ?? s).toISOString();
    } else {
      out.start = s.toISOString();
      out.end = (validEnd ?? new Date(s.getTime() + 3600000)).toISOString();
    }
  }
  return out;
}
