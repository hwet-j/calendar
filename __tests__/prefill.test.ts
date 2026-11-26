import { applyPrefill } from '../src/lib/prefill';
import type { CalEvent } from '../src/lib/types';

const base: CalEvent = {
  id: 'n', profileId: 'a', title: '', allDay: false, repeat: 'none', attendees: [], reminderMinutes: 10,
  start: new Date(2026, 10, 26, 10).toISOString(), end: new Date(2026, 10, 26, 11).toISOString(),
  updatedAt: new Date(2026, 10, 26).toISOString(),
};

test('제목·시간·장소를 채우고 종료가 없으면 1시간 뒤', () => {
  const r = applyPrefill(base, { title: ' 치과 ', start: '2026-11-27T15:00', location: '강남' });
  expect(r.title).toBe('치과');
  expect(r.location).toBe('강남');
  expect(new Date(r.start)).toEqual(new Date(2026, 10, 27, 15));
  expect(new Date(r.end)).toEqual(new Date(2026, 10, 27, 16));
});

test('종료가 시작보다 앞서면 무시', () => {
  const r = applyPrefill(base, { start: '2026-11-27T15:00', end: '2026-11-27T14:00' });
  expect(new Date(r.end)).toEqual(new Date(2026, 10, 27, 16));
});

test('종일 일정: 날짜만 있는 값도 현지 날짜 그대로', () => {
  const r = applyPrefill(base, { start: '2026-12-01', allDay: '1' });
  expect(r.allDay).toBe(true);
  expect(new Date(r.start)).toEqual(new Date(2026, 11, 1));
  expect(new Date(r.end)).toEqual(new Date(2026, 11, 1));
});

test('잘못된 날짜·범위 밖 연도·빈 값은 기본값 유지', () => {
  for (const start of ['abc', '1999-01-01', '2101-01-01', '']) {
    const r = applyPrefill(base, { start });
    expect(r.start).toBe(base.start);
    expect(r.end).toBe(base.end);
  }
});

test('길이 제한과 배열 파라미터 처리', () => {
  const r = applyPrefill(base, { title: 'x'.repeat(500), notes: ['첫째', '둘째'] });
  expect(r.title).toHaveLength(200);
  expect(r.notes).toBe('첫째');
});
