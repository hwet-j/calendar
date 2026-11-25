import KoreanLunarCalendar from 'korean-lunar-calendar';
import type { LunarDate } from './types';

/** 라이브러리 지원 범위 (양력 1000~2050년) */
export const LUNAR_MIN_YEAR = 1000;
export const LUNAR_MAX_YEAR = 2050;

const cal = new KoreanLunarCalendar();

export interface LunarFull extends LunarDate { year: number }

/** 양력 → 음력. 지원 범위를 벗어나면 null */
export function solarToLunar(d: Date): LunarFull | null {
  if (d.getFullYear() < LUNAR_MIN_YEAR || d.getFullYear() > LUNAR_MAX_YEAR) return null;
  if (!cal.setSolarDate(d.getFullYear(), d.getMonth() + 1, d.getDate())) return null;
  const l = cal.getLunarCalendar();
  return { year: l.year, month: l.month, day: l.day, leap: !!l.intercalation };
}

function lunarToSolarExact(year: number, month: number, day: number, leap: boolean): Date | null {
  if (year < LUNAR_MIN_YEAR || year > LUNAR_MAX_YEAR) return null;
  if (!cal.setLunarDate(year, month, day, leap)) return null;
  const s = cal.getSolarCalendar();
  return new Date(s.year, s.month - 1, s.day);
}

/**
 * 음력 연도 `year`에서 (월/일/윤달)에 해당하는 양력 날짜.
 * - 윤달인데 그 해에 해당 윤달이 없으면 같은 숫자의 평달로 대체
 * - 30일인데 그 달이 29일까지면 29일로 대체 (말일)
 */
export function lunarToSolar(year: number, l: LunarDate): Date | null {
  for (const leap of l.leap ? [true, false] : [false]) {
    for (const day of [l.day, l.day - 1]) {
      const d = lunarToSolarExact(year, l.month, day, leap);
      if (d) return d;
    }
  }
  return null;
}

export const fmtLunar = (l: LunarDate) => `음력 ${l.leap ? '윤' : ''}${l.month}월 ${l.day}일`;
/** 달력 칸용 짧은 표기: 1일이면 "M월"(윤달은 "윤M"), 아니면 일 */
export const lunarCell = (l: LunarDate) => (l.day === 1 ? `${l.leap ? '윤' : ''}${l.month}월` : String(l.day));
