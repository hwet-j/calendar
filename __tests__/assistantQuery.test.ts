import { buildSnapshot, eventsResult, parseCmd, replyUrl } from '../src/lib/assistantQuery';
import type { AppState, CalEvent } from '../src/lib/types';

const NOW = new Date(2026, 10, 27, 12).getTime();
const cmd = (o: object) => JSON.stringify({ v: 1, id: 'abc-1', ts: NOW, ...o });
const ev = (p: Partial<CalEvent>): CalEvent => ({
  id: 'e', profileId: 'me', title: 't', allDay: false, repeat: 'none', attendees: ['secret@x.com'], notes: '민감한 메모',
  start: new Date(2026, 10, 27, 10).toISOString(), end: new Date(2026, 10, 27, 11).toISOString(), updatedAt: '', ...p,
});
const state = (events: CalEvent[]): AppState => ({
  profiles: [{ id: 'me', name: '나', color: '#000', visible: true }, { id: 'h', name: '숨김', color: '#111', visible: false }],
  events, activeProfileId: null, google: { connected: false },
});

describe('parseCmd', () => {
  test('기본값: 오늘부터 14일', () => {
    const c = parseCmd(cmd({ op: 'query', what: 'events' }), NOW);
    expect(c).toMatchObject({ op: 'query', what: 'events' });
    if (typeof c === 'string' || c.op !== 'query') throw new Error('x');
    expect(c.from).toEqual(new Date(2026, 10, 27));
    expect(c.to).toEqual(new Date(2026, 11, 11));
  });
  test('from/to 지정, 잘못된 날짜·역순·너무 긴 구간 거부', () => {
    expect(parseCmd(cmd({ op: 'query', what: 'events', from: '2026-12-01', to: '2026-12-31' }), NOW)).toMatchObject({ op: 'query' });
    expect(typeof parseCmd(cmd({ op: 'query', what: 'events', from: '2026-02-30' }), NOW)).toBe('string');
    expect(typeof parseCmd(cmd({ op: 'query', what: 'events', from: '2026-12-02', to: '2026-12-01' }), NOW)).toBe('string');
    expect(typeof parseCmd(cmd({ op: 'query', what: 'events', from: '2026-01-01', to: '2026-12-31' }), NOW)).toBe('string');
  });
  test('show', () => {
    expect(parseCmd(cmd({ op: 'show', date: '2026-12-25' }), NOW)).toMatchObject({ op: 'show' });
    expect(typeof parseCmd(cmd({ op: 'show' }), NOW)).toBe('string');
  });
  test('버전·id·오래된 ts·알 수 없는 op·깨진 JSON 거부', () => {
    expect(typeof parseCmd(JSON.stringify({ v: 2, id: 'a', ts: NOW, op: 'show', date: '2026-12-25' }), NOW)).toBe('string');
    expect(typeof parseCmd(cmd({ id: 'a b!', op: 'show', date: '2026-12-25' }), NOW)).toBe('string');
    expect(typeof parseCmd(JSON.stringify({ v: 1, id: 'a', ts: NOW - 11 * 60000, op: 'show', date: '2026-12-25' }), NOW)).toBe('string');
    expect(typeof parseCmd(cmd({ op: 'delete_all' }), NOW)).toBe('string');
    expect(typeof parseCmd('{oops', NOW)).toBe('string');
    expect(typeof parseCmd(undefined, NOW)).toBe('string');
    expect(typeof parseCmd('x'.repeat(5000), NOW)).toBe('string');
  });
});

describe('eventsResult', () => {
  const from = new Date(2026, 10, 27), to = new Date(2026, 10, 29);
  test('메모·참석자는 담지 않고 숨긴 프로필은 제외', () => {
    const r = eventsResult(state([ev({ id: 'a', title: '병원', location: '강남' }), ev({ id: 'b', profileId: 'h', title: '숨김' })]), from, to);
    expect(r.count).toBe(1);
    expect(r.events[0]).toMatchObject({ id: 'a', title: '병원', start: '2026-11-27T10:00', end: '2026-11-27T11:00', location: '강남', profile: '나' });
    const s = JSON.stringify(r);
    expect(s).not.toContain('secret@x.com');
    expect(s).not.toContain('민감한 메모');
  });
  test('종일 일정은 날짜만, 마지막 날 포함', () => {
    const r = eventsResult(state([ev({ allDay: true, start: new Date(2026, 10, 28).toISOString(), end: new Date(2026, 11, 1).toISOString() })]), from, to);
    expect(r.events[0]).toMatchObject({ allDay: true, start: '2026-11-28', end: '2026-11-30' });
  });
  test('반복 일정은 회차로 펼치고 범위 밖은 제외', () => {
    const r = eventsResult(state([ev({ repeat: 'daily' })]), from, to);
    expect(r.events.map((e) => e.start)).toEqual(['2026-11-27T10:00', '2026-11-28T10:00', '2026-11-29T10:00']);
    expect(r.events[0].repeat).toBe('daily');
  });
  test('범위 밖 일정은 없음 / 많으면 잘림', () => {
    expect(eventsResult(state([ev({ start: new Date(2026, 9, 1, 9).toISOString(), end: new Date(2026, 9, 1, 10).toISOString() })]), from, to).count).toBe(0);
    const many = Array.from({ length: 200 }, (_, i) => ev({ id: `m${i}` }));
    const r = eventsResult(state(many), from, to);
    expect(r.truncated).toBe(true);
    expect(r.events).toHaveLength(150);
  });
});

test('replyUrl: 비서 스킴, id 와 JSON 이 인코딩돼 들어감', () => {
  const u = replyUrl('a-1', { ok: true, what: 'events', data: { title: '가&나=다' } });
  expect(u.startsWith('hwetassistant://result?id=a-1&app=calendar&data=')).toBe(true);
  const q = new URL(u).searchParams.get('data')!;
  expect(JSON.parse(q).data.title).toBe('가&나=다');
});

describe('buildSnapshot', () => {
  const NOWD = new Date(2026, 10, 27, 12);
  const st = (events: CalEvent[]) => state(events);
  const iso = (y: number, m: number, d: number, h = 10) => new Date(y, m, d, h).toISOString();

  test('창: 오늘 31일 전 ~ 400일 후, 형식은 eventsResult 의 일정과 같다', () => {
    const e = ev({ id: 'a', title: '병원', location: '강남' });
    const snap = buildSnapshot(st([e]), NOWD);
    expect(snap).toMatchObject({ v: 1, app: 'calendar', ts: NOWD.getTime(), from: '2026-10-27', to: '2028-01-01', truncated: false });
    expect(snap.events).toEqual(eventsResult(st([e]), new Date(2026, 10, 27), new Date(2026, 10, 27)).events);
  });

  test('창 경계: 31일 전은 포함, 32일 전·401일 후는 제외', () => {
    const inP = ev({ id: 'p1', start: iso(2026, 9, 27), end: iso(2026, 9, 27, 11) });
    const outP = ev({ id: 'p2', start: iso(2026, 9, 26), end: iso(2026, 9, 26, 11) });
    const inF = ev({ id: 'f1', start: iso(2028, 0, 1), end: iso(2028, 0, 1, 11) });
    const outF = ev({ id: 'f2', start: iso(2028, 0, 2), end: iso(2028, 0, 2, 11) });
    expect(buildSnapshot(st([inP, outP, inF, outF]), NOWD).events.map((e) => e.id).sort()).toEqual(['f1', 'p1']);
  });

  test('반복 일정은 회차로 펼쳐 담고, 숨긴 프로필·메모·참석자는 빠진다', () => {
    const rep = ev({ id: 'w', repeat: 'weekly', start: iso(2026, 10, 2), end: iso(2026, 10, 2, 11) });
    const hid = ev({ id: 'h', profileId: 'h' });
    const snap = buildSnapshot(st([rep, hid]), NOWD);
    expect(snap.events.every((e) => e.id === 'w')).toBe(true);
    expect(snap.events.length).toBeGreaterThan(50);
    expect(snap.events[0]).toMatchObject({ start: '2026-11-02T10:00', repeat: 'weekly' });
    const s = JSON.stringify(snap);
    expect(s).not.toContain('secret@x.com');
    expect(s).not.toContain('민감한 메모');
  });

  test('서머타임 전환 주에도 벽시계 시각이 유지된다', () => {
    const rep = ev({ id: 'd', repeat: 'daily', start: iso(2026, 2, 1, 9), end: iso(2026, 2, 1, 10) });
    const snap = buildSnapshot(st([rep]), new Date(2026, 2, 15, 12));
    const hits = snap.events.filter((e) => e.start >= '2026-03-06T00:00' && e.start <= '2026-03-10T23:59');
    expect(hits.map((e) => e.start.slice(11))).toEqual(['09:00', '09:00', '09:00', '09:00', '09:00']);
  });

  test('1500건을 넘으면 자르고 truncated', () => {
    const many = Array.from({ length: 1600 }, (_, i) => ev({ id: `m${i}`, start: iso(2026, 11, 1, 10), end: iso(2026, 11, 1, 11) }));
    const snap = buildSnapshot(st(many), NOWD);
    expect(snap.events).toHaveLength(1500);
    expect(snap.truncated).toBe(true);
  });

  test('일정이 없으면 빈 목록', () => {
    expect(buildSnapshot(st([]), NOWD).events).toEqual([]);
  });
});

test('네이티브 모듈이 없어도 wrapper 는 조용히 false', () => {
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { writeAssistantSnapshot } = require('../src/lib/assistantShare');
  expect(writeAssistantSnapshot('{}')).toBe(false);
});

describe('parseCmd add (비서가 일정을 바로 등록)', () => {
  const NOW2 = Date.UTC(2026, 10, 28, 3, 0, 0);
  const c2 = (o: object) => JSON.stringify({ v: 1, id: 'abc-1', ts: NOW2, ...o });
  test('시간 일정: 끝이 없으면 1시간', () => {
    const r = parseCmd(c2({ op: 'add', title: ' 치과 ', start: '2026-12-01T15:00' }), NOW2) as any;
    expect(r).toMatchObject({ op: 'add', title: '치과', allDay: false });
    expect(r.end.getTime() - r.start.getTime()).toBe(3_600_000);
    expect(r.start.getHours()).toBe(15);
  });
  test('종일 일정: 날짜만 주면 종일', () => {
    const r = parseCmd(c2({ op: 'add', title: '제사', start: '2026-12-01' }), NOW2) as any;
    expect(r.allDay).toBe(true);
    expect(r.start.getHours()).toBe(0);
  });
  test('잘못된 입력은 사람이 읽을 오류 문자열', () => {
    expect(parseCmd(c2({ op: 'add', start: '2026-12-01T15:00' }), NOW2)).toMatch(/title/);
    expect(parseCmd(c2({ op: 'add', title: 'x', start: '내일 3시' }), NOW2)).toMatch(/start/);
    expect(parseCmd(c2({ op: 'add', title: 'x', start: '2026-12-01T15:00', end: '2026-12-01T14:00' }), NOW2)).toMatch(/end/);
    expect(parseCmd(c2({ op: 'add', title: 'x', start: '2026-13-01' }), NOW2)).toMatch(/start/);
    expect(parseCmd(JSON.stringify({ v: 1, id: 'abc-1', ts: NOW2 - 3_600_000, op: 'add', title: 'x', start: '2026-12-01' }), NOW2)).toMatch(/오래된/);
  });
});

describe('parseCmd update/delete', () => {
  const NOW3 = Date.UTC(2026, 10, 28, 3, 0, 0);
  const c3 = (o: object) => JSON.stringify({ v: 1, id: 'abc-2', ts: NOW3, ...o });
  test('삭제: eventId 필요', () => {
    expect(parseCmd(c3({ op: 'delete', eventId: 'ev_1' }), NOW3)).toMatchObject({ op: 'delete', eventId: 'ev_1' });
    expect(parseCmd(c3({ op: 'delete' }), NOW3)).toMatch(/eventId/);
    expect(parseCmd(c3({ op: 'delete', eventId: '../x' }), NOW3)).toMatch(/eventId/);
  });
  test('수정: 바뀐 항목만, 비우기, 검증', () => {
    const r = parseCmd(c3({ op: 'update', eventId: 'ev_1', title: '새 제목', start: '2026-12-02T10:00', location: '' }), NOW3) as any;
    expect(r.op).toBe('update');
    expect(r.patch.title).toBe('새 제목');
    expect(r.patch.start.getHours()).toBe(10);
    expect(r.patch.clearLocation).toBe(true);
    expect(parseCmd(c3({ op: 'update', eventId: 'ev_1' }), NOW3)).toMatch(/바꿀 항목/);
    expect(parseCmd(c3({ op: 'update', eventId: 'ev_1', start: 'x' }), NOW3)).toMatch(/start/);
    expect(parseCmd(c3({ op: 'update', eventId: 'ev_1', title: '  ' }), NOW3)).toMatch(/title/);
    expect(parseCmd(c3({ op: 'update', eventId: 'ev_1', start: '2026-12-02T10:00', end: '2026-12-02T09:00' }), NOW3)).toMatch(/end/);
  });
});
