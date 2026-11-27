import { asOccurrence, canMove, cellAt, daysBetween, makeCopy, moveEvent, shiftEventDays } from '../src/lib/copy';
import { chunkWeeks, monthGrid } from '../src/lib/dates';
import type { CalEvent } from '../src/lib/types';

const ev = (p: Partial<CalEvent> = {}): CalEvent => ({
  id: 'a', profileId: 'p', title: '병원', allDay: false, repeat: 'none', attendees: ['x@y.com'], reminderMinutes: 10,
  start: new Date(2026, 10, 26, 10, 30).toISOString(), end: new Date(2026, 10, 26, 11, 30).toISOString(),
  googleId: 'g1', pendingSync: true, location: '강남', color: '#FF6B6B', updatedAt: new Date(2026, 10, 1).toISOString(), ...p,
});

test('날짜 이동: 시각과 길이 유지', () => {
  const r = shiftEventDays(ev(), 5);
  expect(new Date(r.start)).toEqual(new Date(2026, 10, 31, 10, 30));
  expect(new Date(r.end)).toEqual(new Date(2026, 10, 31, 11, 30));
});

test('DST 전환일을 지나도 벽시계 시각 유지', () => {
  // 미국 서머타임 2026-03-08. 어떤 TZ 에서도 같은 벽시계 시각이어야 한다
  const e = ev({ start: new Date(2026, 2, 7, 9).toISOString(), end: new Date(2026, 2, 7, 10).toISOString() });
  const r = shiftEventDays(e, 2);
  expect(new Date(r.start)).toEqual(new Date(2026, 2, 9, 9));
  expect(new Date(r.end)).toEqual(new Date(2026, 2, 9, 10));
});

test('월·연 경계 이동', () => {
  const r = shiftEventDays(ev(), 40);
  expect(new Date(r.start)).toEqual(new Date(2027, 0, 5, 10, 30));
  expect(new Date(shiftEventDays(ev(), -30).start)).toEqual(new Date(2026, 9, 27, 10, 30));
});

test('여러 날 일정은 양 끝이 같이 이동', () => {
  const e = ev({ start: new Date(2026, 10, 26, 9).toISOString(), end: new Date(2026, 10, 28, 18).toISOString() });
  const r = shiftEventDays(e, 7);
  expect(new Date(r.start)).toEqual(new Date(2026, 11, 3, 9));
  expect(new Date(r.end)).toEqual(new Date(2026, 11, 5, 18));
});

test('종일 일정은 자정 기준 유지', () => {
  const e = ev({ allDay: true, start: new Date(2026, 10, 26).toISOString(), end: new Date(2026, 10, 27).toISOString() });
  const r = shiftEventDays(e, 3);
  expect(new Date(r.start)).toEqual(new Date(2026, 10, 29));
  expect(new Date(r.end)).toEqual(new Date(2026, 10, 30));
});

test('복사본: 새 id, 구글 연결·참석자·반복 제거, 나머지 값 유지', () => {
  const c = makeCopy(ev({ repeat: 'weekly', lunar: { month: 1, day: 1, leap: false } }), 3, 'new', new Date(2026, 10, 27));
  expect(c.id).toBe('new');
  expect(c.googleId).toBeUndefined();
  expect(c.pendingSync).toBeUndefined();
  expect(c.lunar).toBeUndefined();
  expect(c.repeat).toBe('none');
  expect(c.attendees).toEqual([]);
  expect(c.title).toBe('병원');
  expect(c.location).toBe('강남');
  expect(c.color).toBe('#FF6B6B');
  expect(c.reminderMinutes).toBe(10);
  expect(new Date(c.start)).toEqual(new Date(2026, 10, 29, 10, 30));
  expect(new Date(c.updatedAt)).toEqual(new Date(2026, 10, 27));
});

test('복사는 원본을 바꾸지 않는다', () => {
  const e = ev();
  const before = JSON.stringify(e);
  makeCopy(e, 3, 'n');
  moveEvent(e, 3);
  expect(JSON.stringify(e)).toBe(before);
});

test('이동: id·구글 연결은 유지, 날짜만 변경', () => {
  const m = moveEvent(ev(), -2, new Date(2026, 10, 27));
  expect(m.id).toBe('a');
  expect(m.googleId).toBe('g1');
  expect(m.attendees).toEqual(['x@y.com']);
  expect(new Date(m.start)).toEqual(new Date(2026, 10, 24, 10, 30));
});

test('이동은 반복 없는 일정만', () => {
  expect(canMove(ev())).toBe(true);
  expect(canMove(ev({ repeat: 'weekly' }))).toBe(false);
  expect(canMove(ev({ repeat: 'yearly', lunar: { month: 1, day: 1, leap: false } }))).toBe(false);
});

test('음력 일정(반복 없음) 이동 시 음력 날짜도 새 날짜로 갱신', () => {
  const e = ev({ lunar: { month: 1, day: 1, leap: false }, start: new Date(2026, 1, 17, 9).toISOString(), end: new Date(2026, 1, 17, 10).toISOString() });
  const m = moveEvent(e, 1);
  expect(m.lunar).toEqual({ month: 1, day: 2, leap: false });
});

test('반복 일정의 특정 회차를 기준으로 한 값', () => {
  const e = ev({ repeat: 'weekly' }); // 11/26 10:30
  const o = asOccurrence(e, new Date(2026, 11, 10, 10, 30));
  expect(new Date(o.start)).toEqual(new Date(2026, 11, 10, 10, 30));
  expect(new Date(o.end)).toEqual(new Date(2026, 11, 10, 11, 30));
  expect(o.repeat).toBe('weekly');
});

test('daysBetween: 달력 날짜 기준', () => {
  expect(daysBetween(new Date(2026, 2, 7, 23), new Date(2026, 2, 9, 1))).toBe(2);
  expect(daysBetween(new Date(2026, 10, 27), new Date(2026, 10, 27, 23))).toBe(0);
  expect(daysBetween(new Date(2026, 10, 27), new Date(2026, 10, 20))).toBe(-7);
});

describe('cellAt', () => {
  const weeks = chunkWeeks(monthGrid(2026, 10)); // 2026-11: 6주
  const box = { left: 10, top: 100, width: 700, height: 600 }; // 칸 100 x 100

  test('좌표 → 날짜', () => {
    expect(cellAt(15, 105, box, weeks)).toEqual(weeks[0][0]);
    expect(cellAt(709, 699, box, weeks)).toEqual(weeks[5][6]);
    expect(cellAt(10 + 250, 100 + 350, box, weeks)).toEqual(weeks[3][2]);
  });

  test('그리드 밖은 null', () => {
    expect(cellAt(5, 150, box, weeks)).toBeNull();
    expect(cellAt(300, 99, box, weeks)).toBeNull();
    expect(cellAt(711, 150, box, weeks)).toBeNull();
    expect(cellAt(300, 700, box, weeks)).toBeNull();
  });

  test('크기 0 이면 null', () => {
    expect(cellAt(10, 100, { left: 0, top: 0, width: 0, height: 0 }, weeks)).toBeNull();
  });
});
