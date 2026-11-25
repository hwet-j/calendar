import { chunkWeeks, expand, monthGrid, onDay } from '../src/lib/dates';
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

test('주 단위 분할: 항상 6주 x 7일, 각 주는 일요일 시작·토요일 끝', () => {
  for (const [y, m] of [[2026, 10], [2026, 1], [2027, 1], [2026, 11]]) {
    const weeks = chunkWeeks(monthGrid(y, m));
    expect(weeks).toHaveLength(6);
    for (const w of weeks) {
      expect(w).toHaveLength(7);
      expect(w[0].getDay()).toBe(0);
      expect(w[6].getDay()).toBe(6);
    }
  }
});

import { fmtLunar, lunarToSolar, solarToLunar } from '../src/lib/lunar';
import { lunarYearlyStarts } from '../src/lib/dates';

const ymd = (d: Date | null) => d && [d.getFullYear(), d.getMonth() + 1, d.getDate()].join('-');

test('음력 변환: 설날·추석', () => {
  expect(solarToLunar(new Date(2026, 1, 17))).toMatchObject({ year: 2026, month: 1, day: 1, leap: false });
  expect(solarToLunar(new Date(2026, 8, 25))).toMatchObject({ month: 8, day: 15 });
  expect(ymd(lunarToSolar(2026, { month: 8, day: 15, leap: false }))).toBe('2026-9-25');
  expect(ymd(lunarToSolar(2027, { month: 8, day: 15, leap: false }))).toBe('2027-9-15');
  // 한국 음력은 KST 기준이라 중국 음력과 하루 다를 수 있음: 2028 설날은 1/27
  expect(ymd(lunarToSolar(2028, { month: 1, day: 1, leap: false }))).toBe('2028-1-27');
  expect(fmtLunar({ month: 6, day: 3, leap: true })).toBe('음력 윤6월 3일');
});

test('윤달: 있는 해는 윤달, 없는 해는 같은 숫자의 평달로 대체', () => {
  // 2025년은 윤6월이 있음
  expect(ymd(lunarToSolar(2025, { month: 6, day: 1, leap: true }))).toBe('2025-7-25');
  // 2026년은 윤6월이 없음 → 평달 6월 1일
  expect(ymd(lunarToSolar(2026, { month: 6, day: 1, leap: true }))).toBe(ymd(lunarToSolar(2026, { month: 6, day: 1, leap: false })));
});

test('음력 생일 매년 반복: 해마다 양력 날짜가 달라짐', () => {
  const birthday = ev({
    id: 'b', title: '엄마 생신', allDay: true, repeat: 'yearly', lunar: { month: 8, day: 15, leap: false },
    start: new Date(2026, 8, 25).toISOString(), end: new Date(2026, 8, 25).toISOString(),
  });
  const occ = expand([birthday], new Date(2026, 0, 1), new Date(2029, 0, 1));
  expect(occ.map((o) => ymd(o.start))).toEqual(['2026-9-25', '2027-9-15', '2028-10-3']);
  // 2027 구간만 조회해도 그 해 것만 나옴
  expect(expand([birthday], new Date(2027, 0, 1), new Date(2028, 0, 1)).map((o) => ymd(o.start))).toEqual(['2027-9-15']);
  // 시작일 이전은 나오지 않음
  expect(expand([birthday], new Date(2020, 0, 1), new Date(2026, 0, 1))).toHaveLength(0);
});

test('음력 반복 일정은 시각을 유지', () => {
  const e = ev({ repeat: 'yearly', lunar: { month: 1, day: 1, leap: false }, start: new Date(2026, 1, 17, 9, 30).toISOString(), end: new Date(2026, 1, 17, 10, 30).toISOString() });
  const [, second] = expand([e], new Date(2026, 0, 1), new Date(2028, 0, 1));
  expect([second.start.getHours(), second.start.getMinutes(), ymd(second.start)]).toEqual([9, 30, '2027-2-7']);
});

test('ICS/구글: 음력 반복은 RDATE로 내보내고, ICS는 왕복 시 음력 설정 복원', () => {
  const e = ev({ allDay: true, repeat: 'yearly', lunar: { month: 8, day: 15, leap: false }, start: new Date(2026, 8, 25).toISOString(), end: new Date(2026, 8, 25).toISOString() });
  expect(lunarYearlyStarts(e)).toHaveLength(19);
  const ics = toICS([e]);
  expect(ics).toContain('RDATE;VALUE=DATE:20270915,20281003');
  expect(ics).not.toContain('RRULE');
  const [back] = fromICS(ics, 'a', () => 'n');
  expect(back).toMatchObject({ repeat: 'yearly', lunar: { month: 8, day: 15, leap: false } });
  const g = toGoogle(e);
  expect(g.recurrence?.[0]).toMatch(/^RDATE;VALUE=DATE:20270915,20281003/);
});

import anchors from './fixtures/lunar-anchors.json';

test('음력 회귀: 2000~2050 설날·추석·부처님오신날·윤달 시작이 천문 계산 기준값과 일치', () => {
  const iso = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  for (const [y, solar] of Object.entries(anchors.seollal)) expect(iso(lunarToSolar(+y, { month: 1, day: 1, leap: false })!)).toBe(solar);
  for (const [y, solar] of Object.entries(anchors.chuseok)) expect(iso(lunarToSolar(+y, { month: 8, day: 15, leap: false })!)).toBe(solar);
  for (const [y, solar] of Object.entries(anchors.buddha)) expect(iso(lunarToSolar(+y, { month: 4, day: 8, leap: false })!)).toBe(solar);
  for (const [solar, month] of anchors.leapStarts as [string, number][]) {
    const [y, m, d] = solar.split('-').map(Number);
    expect(solarToLunar(new Date(y, m - 1, d))).toMatchObject({ month, day: 1, leap: true });
  }
  expect(Object.keys(anchors.seollal)).toHaveLength(51);
});

import { isOAuthRedirect } from '../src/lib/oauth';

test('OAuth 리디렉션 주소만 라우터에서 제외, 일반 딥링크는 통과', () => {
  const id = 'com.googleusercontent.apps.312013010912-abc';
  for (const u of [`${id}:/oauthredirect?code=4/0A&state=x`, `${id}:/oauthredirect`, 'calendarapp:///oauthredirect?code=1', 'calendarapp:////oauthredirect?code=1', '/oauthredirect?code=1'])
    expect(isOAuthRedirect(u)).toBe(true);
  for (const u of ['calendarapp://event/new', 'calendarapp://event/abc123', '/event/3', '/settings', 'calendarapp:///profiles', 'calendarapp://event/oauthredirect-note'])
    expect(isOAuthRedirect(u)).toBe(false);
});

import { mergePulled } from '../src/lib/google';

// 구글 PATCH 의미론 흉내: 객체는 필드 단위 병합, null은 필드 삭제, 배열/원시값은 교체
// eslint-disable-next-line @typescript-eslint/no-explicit-any
function applyPatch(target: any, patch: any): any {
  const out = { ...target };
  for (const [k, v] of Object.entries(patch)) {
    if (v === undefined) continue;
    if (v === null) delete out[k];
    else if (typeof v === 'object' && !Array.isArray(v) && typeof out[k] === 'object' && out[k] && !Array.isArray(out[k])) out[k] = applyPatch(out[k], v);
    else out[k] = v;
  }
  return out;
}

test('시간 일정 → 종일 수정: start/end에 date와 dateTime이 함께 남지 않음 ("Invalid start time" 회귀)', () => {
  const timed = ev({ start: new Date(2026, 10, 25, 12).toISOString(), end: new Date(2026, 10, 25, 13).toISOString() });
  const onGoogle = JSON.parse(JSON.stringify(toGoogle(timed))); // 구글에 이미 있는 시간 일정
  const allDay = { ...timed, allDay: true };

  // 옛 방식(null 없이 date만 전송)은 병합 결과가 잘못됨 → 버그 재현
  const oldBody = { ...toGoogle(allDay, false), start: { date: '2026-11-25' }, end: { date: '2026-11-26' } };
  expect(Object.keys(applyPatch(onGoogle, JSON.parse(JSON.stringify(oldBody))).start).sort()).toEqual(['date', 'dateTime']);

  // 새 방식
  const merged = applyPatch(onGoogle, JSON.parse(JSON.stringify(toGoogle(allDay, true))));
  expect(merged.start).toEqual({ date: '2026-11-25' });
  expect(merged.end).toEqual({ date: '2026-11-26' });
});

test('종일 → 시간 일정 수정도 date가 남지 않음', () => {
  const day = ev({ allDay: true, start: new Date(2026, 10, 25).toISOString(), end: new Date(2026, 10, 25).toISOString() });
  const onGoogle = JSON.parse(JSON.stringify(toGoogle(day)));
  const timed = { ...day, allDay: false, start: new Date(2026, 10, 25, 9).toISOString(), end: new Date(2026, 10, 25, 10).toISOString() };
  const merged = applyPatch(onGoogle, JSON.parse(JSON.stringify(toGoogle(timed, true))));
  expect(Object.keys(merged.start)).toEqual(['dateTime']);
  expect(Object.keys(merged.end)).toEqual(['dateTime']);
});

test('수정 시 비운 장소·메모·반복·참석자는 구글에서도 지워짐, 신규 생성 본문에는 null이 없음', () => {
  const full = ev({ location: '강남', notes: '메모', repeat: 'weekly', attendees: ['a@b.co'], reminderMinutes: 10 });
  const onGoogle = JSON.parse(JSON.stringify(toGoogle(full)));
  const cleared = { ...full, location: '', notes: '', repeat: 'none' as const, attendees: [], reminderMinutes: undefined };
  const merged = applyPatch(onGoogle, JSON.parse(JSON.stringify(toGoogle(cleared, true))));
  expect(merged.location).toBeUndefined();
  expect(merged.description).toBeUndefined();
  expect(merged.recurrence).toBeUndefined();
  expect(merged.attendees).toBeUndefined();
  expect(merged.reminders).toEqual({ useDefault: true });
  expect(JSON.stringify(toGoogle(cleared, false))).not.toContain('null');
});

test('동기화 병합: 구글에 못 올린 로컬 수정(pendingSync)은 구글의 옛 버전으로 덮어쓰지 않음', () => {
  const mine = ev({ id: 'L1', googleId: 'g1', title: '내가 고친 제목', pendingSync: true });
  const synced = ev({ id: 'L2', googleId: 'g2', title: '옛 로컬' });
  const localOnly = ev({ id: 'L3', title: '구글에 없는 일정' });
  const pulled = [ev({ id: 'x1', googleId: 'g1', title: '구글의 옛 제목' }), ev({ id: 'x2', googleId: 'g2', title: '구글 최신' }), ev({ id: 'x4', googleId: 'g4', title: '구글에서 새로 온 일정' })];
  const out = mergePulled([mine, synced, localOnly], pulled);
  const byTitle = out.map((e) => e.title).sort();
  expect(byTitle).toEqual(['구글 최신', '구글에서 새로 온 일정', '구글에 없는 일정', '내가 고친 제목'].sort());
  expect(out.find((e) => e.googleId === 'g1')!.pendingSync).toBe(true);
});
