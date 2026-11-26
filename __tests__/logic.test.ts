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

import { mergePulled, pullRange } from '../src/lib/google';

import { buildUpdateBody, checkPushed } from '../src/lib/google';

// 구글에 이미 있는 이벤트(앱이 모르는 필드 포함)
const onGoogle = (e: CalEvent) => ({
  ...JSON.parse(JSON.stringify(toGoogle(e))), id: 'gid', etag: '"x"', colorId: '5',
  conferenceData: { entryPoints: [{ uri: 'https://meet.google.com/abc' }] },
});

test('시간 일정 → 종일 수정: PUT 본문에 date만 있고 dateTime은 없음, 앱이 모르는 필드는 보존', () => {
  const timed = ev({ start: new Date(2026, 10, 25, 12).toISOString(), end: new Date(2026, 10, 25, 13).toISOString() });
  const body = buildUpdateBody(onGoogle(timed), { ...timed, allDay: true });
  expect(body.start).toEqual({ date: '2026-11-25' });
  expect(body.end).toEqual({ date: '2026-11-26' });
  expect(body.colorId).toBe('5');
  expect(body.conferenceData).toBeDefined();
});

test('종일 → 시간 일정 수정도 dateTime만 남음', () => {
  const day = ev({ allDay: true, start: new Date(2026, 10, 25).toISOString(), end: new Date(2026, 10, 25).toISOString() });
  const timed = { ...day, allDay: false, start: new Date(2026, 10, 25, 9).toISOString(), end: new Date(2026, 10, 25, 10).toISOString() };
  const body = buildUpdateBody(onGoogle(day), timed);
  expect(Object.keys(body.start)).toEqual(['dateTime']);
  expect(Object.keys(body.end)).toEqual(['dateTime']);
});

test('알림 "없음"은 구글에 useDefault:false 로 전달 (기본 알림 30분이 붙지 않음) — 생성/수정 모두', () => {
  const withReminder = ev({ reminderMinutes: 10 });
  const none = { ...withReminder, reminderMinutes: undefined };
  expect(toGoogle(none).reminders).toEqual({ useDefault: false });          // 생성
  const body = buildUpdateBody(onGoogle(withReminder), none);               // 수정: 이전 overrides가 남지 않음
  expect(body.reminders).toEqual({ useDefault: false });
  expect(toGoogle(withReminder).reminders).toEqual({ useDefault: false, overrides: [{ method: 'popup', minutes: 10 }] });
});

test('구글에서 가져온 기본 알림 일정은 수정해도 기본 알림을 유지, 앱에서 직접 "없음"을 고르면 해제', () => {
  const fromG = fromGoogle({ id: 'g', summary: 't', start: { dateTime: new Date(2026, 10, 25, 9).toISOString() }, end: { dateTime: new Date(2026, 10, 25, 10).toISOString() }, reminders: { useDefault: true } }, 'a', 'x')!;
  expect(fromG).toMatchObject({ reminderMinutes: undefined, remindersDefault: true });
  expect(toGoogle(fromG).reminders).toEqual({ useDefault: true });
  expect(toGoogle({ ...fromG, remindersDefault: false }).reminders).toEqual({ useDefault: false });
});

test('동기화로 알림이 되살아나지 않음: useDefault:true + 남아 있던 overrides는 알림 없음으로 취급', () => {
  const stale = { id: 'g', summary: 't', start: { dateTime: new Date(2026, 10, 25, 9).toISOString() }, end: { dateTime: new Date(2026, 10, 25, 10).toISOString() },
    reminders: { useDefault: true, overrides: [{ method: 'popup', minutes: 30 }] } };
  expect(fromGoogle(stale, 'a', 'x')!.reminderMinutes).toBeUndefined();
  const real = { ...stale, reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] } };
  expect(fromGoogle(real, 'a', 'x')!.reminderMinutes).toBe(30);
});

test('수정 시 비운 장소·메모·반복·참석자는 구글에서도 지워지고, 기존 참석자의 응답 상태는 유지', () => {
  const full = ev({ location: '강남', notes: '메모', repeat: 'weekly', attendees: ['a@b.co', 'c@d.co'], reminderMinutes: 10 });
  const g = { ...onGoogle(full), attendees: [{ email: 'a@b.co', responseStatus: 'accepted' }, { email: 'c@d.co', responseStatus: 'declined' }] };
  const kept = buildUpdateBody(g, { ...full, attendees: ['a@b.co'] });
  expect(kept.attendees).toEqual([{ email: 'a@b.co', responseStatus: 'accepted' }]);
  const cleared = buildUpdateBody(g, { ...full, location: '', notes: '', repeat: 'none', attendees: [] });
  for (const k of ['location', 'description', 'recurrence', 'attendees']) expect(k in JSON.parse(JSON.stringify(cleared))).toBe(false);
});

test('구글 응답 점검: 종일/알림이 제대로 반영되지 않았으면 문제로 보고', () => {
  const day = ev({ allDay: true, reminderMinutes: undefined, start: new Date(2026, 10, 25).toISOString(), end: new Date(2026, 10, 25).toISOString() });
  const good = { summary: day.title, start: { date: '2026-11-25' }, end: { date: '2026-11-26' }, reminders: { useDefault: false } };
  expect(checkPushed(day, good)).toEqual([]);
  expect(checkPushed(day, { ...good, start: { date: '2026-11-25', dateTime: '2026-11-25T03:00:00Z' } })).toContain('종일 일정으로 반영되지 않았어요');
  expect(checkPushed(day, { ...good, reminders: { useDefault: true } })).toContain('알림 "없음"이 구글에 반영되지 않았어요');
  expect(checkPushed({ ...day, reminderMinutes: 10 }, { ...good, reminders: { useDefault: false, overrides: [{ method: 'popup', minutes: 30 }] } }).length).toBe(1);
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

import { hiddenPerDay, layoutWeek, textColorOn } from '../src/lib/layout';
import { eventColor } from '../src/lib/filter';

const occOf = (e: CalEvent) => ({ event: e, start: new Date(e.start), end: new Date(e.end) });
const D = (m: number, d: number, h = 0, mi = 0) => new Date(2026, m - 1, d, h, mi).toISOString();
const SUN = new Date(2026, 10, 22); // 2026-11-22 일요일 (주: 22~28)
const SUN2 = new Date(2026, 10, 29);

test('여러 날 일정은 주 경계를 넘어 이어지는 막대로 나뉨 (fromPrev/toNext)', () => {
  const trip = ev({ id: 't', allDay: true, start: D(11, 25), end: D(11, 30) }); // 수 ~ 월(다음 주)
  const w1 = layoutWeek([occOf(trip)], SUN);
  expect(w1).toHaveLength(1);
  expect(w1[0]).toMatchObject({ startCol: 3, endCol: 6, fromPrev: false, toNext: true, lane: 0 });
  const w2 = layoutWeek([occOf(trip)], SUN2);
  expect(w2[0]).toMatchObject({ startCol: 0, endCol: 1, fromPrev: true, toNext: false });
  // 일정과 무관한 주에는 나오지 않음
  expect(layoutWeek([occOf(trip)], new Date(2026, 11, 6))).toHaveLength(0);
});

test('겹치는 일정은 다른 줄로, 겹치지 않으면 같은 줄 재사용, 긴 일정이 위', () => {
  const long = ev({ id: 'a', allDay: true, start: D(11, 23), end: D(11, 26), title: '긴 일정' });
  const short = ev({ id: 'b', allDay: true, start: D(11, 24), end: D(11, 24), title: '짧은 일정' });
  const later = ev({ id: 'c', allDay: true, start: D(11, 27), end: D(11, 27), title: '뒤 일정' });
  const segs = layoutWeek([occOf(short), occOf(later), occOf(long)], SUN);
  const lane = (id: string) => segs.find((s) => s.occ.event.id === id)!.lane;
  expect(lane('a')).toBe(0);
  expect(lane('b')).toBe(1);
  expect(lane('c')).toBe(0); // 긴 일정이 끝난 뒤라 0번 줄 재사용
});

test('시간 일정: 자정 00:00 정각에 끝나면 그 전날까지, 자정을 넘기면 다음 날까지 이어짐', () => {
  const endsMidnight = ev({ id: 'm', start: D(11, 24, 20), end: D(11, 25, 0) });
  expect(layoutWeek([occOf(endsMidnight)], SUN)[0]).toMatchObject({ startCol: 2, endCol: 2 });
  const overnight = ev({ id: 'n', start: D(11, 24, 22), end: D(11, 25, 2) });
  expect(layoutWeek([occOf(overnight)], SUN)[0]).toMatchObject({ startCol: 2, endCol: 3 });
});

test('줄 수 초과 시 칸별로 가려진 개수 계산', () => {
  const list = [1, 2, 3, 4].map((i) => ev({ id: `x${i}`, allDay: true, start: D(11, 24), end: D(11, 24), title: `일정${i}` }));
  const segs = layoutWeek(list.map(occOf), SUN);
  expect(segs.map((s) => s.lane).sort()).toEqual([0, 1, 2, 3]);
  expect(hiddenPerDay(segs, 3)).toEqual([0, 0, 1, 0, 0, 0, 0]);
});

test('일정 색상은 프로필 색보다 우선, 글자색은 배경 밝기에 따라 전환', () => {
  expect(eventColor(ev({ color: '#E5484D' }), profiles)).toBe('#E5484D');
  expect(eventColor(ev({ color: undefined, profileId: 'b' }), profiles)).toBe('#222222');
  expect(textColorOn('#F9A825')).toBe('#14161F'); // 노랑 → 어두운 글자
  expect(textColorOn('#4F7CFF')).toBe('#FFFFFF');
  expect(textColorOn('#16A085')).toBe('#FFFFFF');
});

test('일정 색상은 ICS 왕복에서 유지', () => {
  const [back] = fromICS(toICS([ev({ color: '#8E44AD' })]), 'a', () => 'n');
  expect(back.color).toBe('#8E44AD');
});

import { parseDateQuery, searchEvents } from '../src/lib/jump';

test('날짜 입력 해석: 연/연월/연월일/월 형식', () => {
  const ref = new Date(2026, 10, 25);
  expect(parseDateQuery('2027', ref)).toEqual({ year: 2027, month: 11 });
  expect(parseDateQuery('2027년', ref)).toEqual({ year: 2027, month: 11 });
  for (const q of ['2027.3', '2027-3', '2027/03', '2027 3', '2027년 3월', '2027년3월'])
    expect(parseDateQuery(q, ref)).toEqual({ year: 2027, month: 3, day: undefined });
  for (const q of ['2027.3.15', '2027-03-15', '2027년 3월 15일', '2027 3 15'])
    expect(parseDateQuery(q, ref)).toEqual({ year: 2027, month: 3, day: 15 });
  expect(parseDateQuery('3월', ref)).toEqual({ year: 2026, month: 3, day: undefined });
  expect(parseDateQuery('3월 5일', ref)).toEqual({ year: 2026, month: 3, day: 5 });
});

test('날짜 입력 해석: 잘못된 값·일반 검색어는 null', () => {
  const ref = new Date(2026, 10, 25);
  for (const q of ['', '   ', '2027.13', '2027.2.30', '13월', '1899', '2101', '회의', '치과 2027', '2027.3.15.1'])
    expect(parseDateQuery(q, ref)).toBeNull();
  expect(parseDateQuery('2024.2.29', ref)).toEqual({ year: 2024, month: 2, day: 29 }); // 윤년
});

test('일정 검색: 제목/장소/메모, 대소문자 무시, 가까운 날짜 순, 반복 일정은 다음 발생일로 이동', () => {
  const today = new Date(2026, 10, 25);
  const events = [
    ev({ id: '1', title: '치과 검진', start: new Date(2027, 2, 3, 10).toISOString(), end: new Date(2027, 2, 3, 11).toISOString() }),
    ev({ id: '2', title: '점심', location: '치과 앞 식당', start: new Date(2026, 10, 27, 12).toISOString(), end: new Date(2026, 10, 27, 13).toISOString() }),
    ev({ id: '3', title: '헬스', notes: 'DENTAL 예약 메모', start: new Date(2026, 10, 1, 7).toISOString(), end: new Date(2026, 10, 1, 8).toISOString() }),
    ev({ id: '4', title: '주간 치과 상담', repeat: 'weekly', start: new Date(2026, 0, 7, 9).toISOString(), end: new Date(2026, 0, 7, 10).toISOString() }),
  ];
  expect(searchEvents(events, '치과', today).map((h) => h.event.id)).toEqual(['4', '2', '1']);
  const weekly = searchEvents(events, '치과', today).find((h) => h.event.id === '4')!;
  expect([weekly.date.getMonth(), weekly.date.getDate()]).toEqual([10, 25]); // 2026-11-25(수) = 오늘이 수요일
  expect(searchEvents(events, 'dental', today).map((h) => h.event.id)).toEqual(['3']);
  expect(searchEvents(events, '  ', today)).toEqual([]);
  expect(searchEvents(events, '없는검색어', today)).toEqual([]);
});

describe('동기화 병합: 구글에서 삭제된 일정 반영', () => {
  const NOW = new Date(2026, 10, 26, 12).getTime();
  const range = pullRange(NOW);
  const inWin = (o: Partial<CalEvent> = {}) => ev({ start: D(12, 3, 9), end: D(12, 3, 10), ...o });
  const stay = ev({ id: 'S', googleId: 'gS', title: '남아 있는 일정', start: D(12, 5, 9), end: D(12, 5, 10) });
  const pulledStay = [ev({ id: 'S', googleId: 'gS', title: '남아 있는 일정', start: D(12, 5, 9), end: D(12, 5, 10) })];

  test('기간 안에서 구글에 없어진 일정은 지운다', () => {
    const gone = inWin({ id: 'G', googleId: 'gG', title: '구글에서 지운 일정' });
    const out = mergePulled([gone, stay], pulledStay, range);
    expect(out.map((e) => e.title)).toEqual(['남아 있는 일정']);
  });

  test('range 를 안 주면 예전처럼 지우지 않는다', () => {
    const gone = inWin({ id: 'G', googleId: 'gG' });
    expect(mergePulled([gone, stay], pulledStay)).toHaveLength(2);
  });

  test('로컬 수정 대기(pendingSync)·구글 미연결 일정은 지우지 않는다', () => {
    const pending = inWin({ id: 'P', googleId: 'gP', pendingSync: true });
    const localOnly = inWin({ id: 'L' });
    const out = mergePulled([pending, localOnly, stay], pulledStay, range);
    expect(out.map((e) => e.id).sort()).toEqual(['L', 'P', 'S'].sort());
  });

  test('기간 밖(과거·먼 미래)·기간에 걸친 일정은 지우지 않는다', () => {
    const old = ev({ id: 'O', googleId: 'gO', start: D(1, 5, 9), end: D(1, 5, 10) });
    const far = ev({ id: 'F', googleId: 'gF', start: new Date(2028, 0, 5, 9).toISOString(), end: new Date(2028, 0, 5, 10).toISOString() });
    const straddle = ev({ id: 'T', googleId: 'gT', start: new Date(2027, 11, 1).toISOString(), end: new Date(2027, 11, 20).toISOString() });
    const out = mergePulled([old, far, straddle, stay], pulledStay, range);
    expect(out.map((e) => e.id).sort()).toEqual(['F', 'O', 'S', 'T'].sort());
  });

  test('반복·음력 일정은 지우지 않는다', () => {
    const weekly = inWin({ id: 'W', googleId: 'gW', repeat: 'weekly' });
    const lunar = inWin({ id: 'U', googleId: 'gU', repeat: 'yearly', lunar: { month: 10, day: 20, leap: false } });
    const out = mergePulled([weekly, lunar, stay], pulledStay, range);
    expect(out.map((e) => e.id).sort()).toEqual(['S', 'U', 'W'].sort());
  });

  test('가져온 목록이 비어 있으면(계정 전환·오류 가능성) 아무것도 지우지 않는다', () => {
    const a = inWin({ id: 'A', googleId: 'gA' });
    const b = inWin({ id: 'B', googleId: 'gB' });
    expect(mergePulled([a, b], [], range)).toHaveLength(2);
  });
});
