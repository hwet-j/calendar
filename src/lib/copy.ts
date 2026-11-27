import { solarToLunar } from './lunar';
import type { CalEvent } from './types';

/** 달력 날짜 차이(일). DST와 무관하게 날짜만 비교 */
export const daysBetween = (a: Date, b: Date) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);

const shiftIso = (iso: string, days: number) => {
  const d = new Date(iso);
  // 시각(벽시계)은 그대로 두고 날짜만 옮긴다. ms 로 더하면 DST 전환일에 1시간 어긋난다.
  return new Date(d.getFullYear(), d.getMonth(), d.getDate() + days, d.getHours(), d.getMinutes()).toISOString();
};

/** 시작·종료를 N일 옮긴 일정. 시각과 길이는 유지 */
export function shiftEventDays(e: CalEvent, days: number): CalEvent {
  return { ...e, start: shiftIso(e.start, days), end: shiftIso(e.end, days) };
}

/** 반복 일정의 특정 회차(occurrenceStart 가 속한 날)를 기준으로 한 한 번짜리 일정 값 */
export function asOccurrence(e: CalEvent, occurrenceStart: Date): CalEvent {
  return shiftEventDays(e, daysBetween(new Date(e.start), occurrenceStart));
}

/**
 * 복사본. 새 id, 구글 연결·동기화 표시 없음, 반복·음력 해제(한 번짜리), 참석자 비움.
 * 참석자를 비우는 이유: 구글에 올릴 때 같은 사람에게 초대 메일이 또 가지 않게.
 */
export function makeCopy(e: CalEvent, days: number, newId: string, now: Date = new Date()): CalEvent {
  const s = shiftEventDays(e, days);
  const { googleId: _g, pendingSync: _p, lunar: _l, ...rest } = s;
  return { ...rest, id: newId, repeat: 'none', attendees: [], updatedAt: now.toISOString() };
}

/** 반복·음력 반복 일정은 한 회차만 옮길 수 없어서 이동 불가 (복사만 가능) */
export const canMove = (e: CalEvent) => e.repeat === 'none';

/** 이동. 음력 일정(반복 없음)은 음력 날짜도 새 날짜에 맞춘다 */
export function moveEvent(e: CalEvent, days: number, now: Date = new Date()): CalEvent {
  const s = shiftEventDays(e, days);
  const lunar = e.lunar ? solarToLunar(new Date(s.start)) : null;
  const out: CalEvent = { ...s, updatedAt: now.toISOString() };
  if (e.lunar) out.lunar = lunar ? { month: lunar.month, day: lunar.day, leap: lunar.leap } : undefined;
  return out;
}

/** 화면 좌표가 달력 그리드의 어느 날짜 칸인지. 그리드 밖이면 null */
export function cellAt(
  x: number, y: number,
  box: { left: number; top: number; width: number; height: number },
  weeks: Date[][],
): Date | null {
  if (box.width <= 0 || box.height <= 0 || weeks.length === 0) return null;
  const px = x - box.left, py = y - box.top;
  if (px < 0 || py < 0 || px >= box.width || py >= box.height) return null;
  const row = Math.min(weeks.length - 1, Math.floor(py / (box.height / weeks.length)));
  const col = Math.min(6, Math.floor(px / (box.width / 7)));
  return weeks[row]?.[col] ?? null;
}
