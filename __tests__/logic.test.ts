import { expand, monthGrid, onDay } from '../src/lib/dates';
import { visibleEvents } from '../src/lib/filter';
import { fromGoogle, toGoogle } from '../src/lib/google';
import { fromICS, toICS } from '../src/lib/ics';
import type { CalEvent, Profile } from '../src/lib/types';

const ev = (o: Partial<CalEvent>): CalEvent => ({
  id: 'e1', profileId: 'a', title: 't', start: new Date(2026, 0, 31, 9).toISOString(), end: new Date(2026, 0, 31, 10).toISOString(),
  allDay: false, repeat: 'none', attendees: [], updatedAt: new Date(2026, 0, 1).toISOString(), ...o,
});
const profiles: Profile[] = [
  { id: 'a', name: 'A', color: '#111111', visible: true },
  { id: 'b', name: 'B', color: '#222222', visible: false },
];

test('월 그리드는 42칸이고 일요일부터 시작', () => {
  const g = monthGrid(2026, 10);
  expect(g).toHaveLength(42);
  expect(g[0].getDay()).toBe(0);
});

test('매월 반복은 말일로 보정 (1/31 → 2/28)', () => {
  const o = expand([ev({ repeat: 'monthly' })], new Date(2026, 0, 1), new Date(2026, 3, 1));
  expect(o.map((x) => [x.start.getMonth(), x.start.getDate()])).toEqual([[0, 31], [1, 28], [2, 31]]);
});

test('매주 반복 + onDay', () => {
  const o = expand([ev({ repeat: 'weekly' })], new Date(2026, 0, 1), new Date(2026, 1, 15));
  expect(onDay(o, new Date(2026, 1, 7)).length).toBe(1);
  expect(onDay(o, new Date(2026, 1, 8)).length).toBe(0);
});

test('프로필 필터: 전체는 visible만, 선택 시 해당 프로필만', () => {
  const events = [ev({ id: '1', profileId: 'a' }), ev({ id: '2', profileId: 'b' })];
  expect(visibleEvents({ events, profiles, activeProfileId: null }).map((e) => e.id)).toEqual(['1']);
  expect(visibleEvents({ events, profiles, activeProfileId: 'b' }).map((e) => e.id)).toEqual(['2']);
});

test('ICS 왕복 변환', () => {
  const src = ev({ title: '회의, 중요; 메모', location: '강남', notes: '줄1\n줄2', repeat: 'weekly', reminderMinutes: 30 });
  const [back] = fromICS(toICS([src]), 'a', () => 'new');
  expect(back).toMatchObject({ title: src.title, location: '강남', notes: '줄1\n줄2', repeat: 'weekly', reminderMinutes: 30, allDay: false });
  expect(back.start).toBe(src.start);
});

test('ICS 종일 일정 왕복', () => {
  const src = ev({ allDay: true, start: new Date(2026, 4, 5).toISOString(), end: new Date(2026, 4, 6).toISOString() });
  const [back] = fromICS(toICS([src]), 'a', () => 'n');
  expect(back.allDay).toBe(true);
  expect(new Date(back.end).getDate()).toBe(6);
});

test('구글 변환 왕복 (참석자·알림·종일)', () => {
  const src = ev({ attendees: ['a@b.co'], reminderMinutes: 10, allDay: true, start: new Date(2026, 4, 5).toISOString(), end: new Date(2026, 4, 6).toISOString() });
  const g = { ...toGoogle(src), id: 'gid' };
  const back = fromGoogle(g, 'a', 'x')!;
  expect(back).toMatchObject({ googleId: 'gid', attendees: ['a@b.co'], reminderMinutes: 10, allDay: true });
  expect(new Date(back.end).getDate()).toBe(6);
});
