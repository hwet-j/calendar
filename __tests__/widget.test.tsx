jest.mock('@react-native-async-storage/async-storage', () => require('@react-native-async-storage/async-storage/jest/async-storage-mock'));
import fs from 'fs';
import React from 'react';
import { AgendaWidget, visibleRows } from '../src/widget/AgendaWidget';
import type { AppState, CalEvent } from '../src/lib/types';

const now = new Date(2026, 10, 24, 12, 0);
const at = (d: number, h: number) => new Date(2026, 10, d, h).toISOString();
const ev = (id: string, profileId: string, title: string, d: number, h: number, o: Partial<CalEvent> = {}): CalEvent => ({
  id, profileId, title, start: at(d, h), end: at(d, h + 1), allDay: false, repeat: 'none', attendees: [], updatedAt: at(1, 0), ...o,
});
const state: AppState = {
  profiles: [{ id: 'a', name: '나', color: '#4F7CFF', visible: true }, { id: 'b', name: '가족', color: '#FF6B6B', visible: false }],
  events: [ev('1', 'a', '지난 일정', 24, 7), ev('2', 'a', '점심 약속', 24, 13), ev('3', 'a', '저녁 운동', 24, 19), ev('4', 'a', '내일 회의', 25, 10), ev('5', 'b', '가족 행사', 24, 15)],
  activeProfileId: null, google: { connected: false },
};

// 위젯 트리를 문자열로 평탄화 (자식 함수 컴포넌트는 호출하지 않고 props.children만 순회)
type N = { type?: { name?: string }; props?: { text?: string; children?: unknown; clickActionData?: { uri?: string } } };
function walk(n: unknown, out: { texts: string[]; uris: string[]; tree: unknown }): unknown {
  if (Array.isArray(n)) return n.map((x) => walk(x, out));
  if (!n || typeof n !== 'object') return n;
  const el = n as N;
  const p = el.props ?? {};
  if (p.text) out.texts.push(p.text);
  if (p.clickActionData?.uri) out.uris.push(p.clickActionData.uri);
  const t = (el.type as { name?: string; })?.name;
  let children = p.children;
  if (typeof el.type === 'function' && t && !['FlexWidget', 'TextWidget'].includes(t)) {
    children = (el.type as (p: unknown) => unknown)(p); // Item 같은 커스텀 컴포넌트는 펼침
  }
  return { t, props: { ...p, children: undefined }, children: walk(children, out) };
}
const render = (el: React.JSX.Element) => { const out = { texts: [] as string[], uris: [] as string[], tree: null as unknown }; out.tree = walk(el, out); return out; };

test('visibleRows는 높이에 비례하고 1~6으로 제한', () => {
  expect(visibleRows(80)).toBe(1);
  expect(visibleRows(150)).toBe(1);
  expect(visibleRows(250)).toBe(3);
  expect(visibleRows(2000)).toBe(6);
});

test('전체 보기: visible 프로필만, 지난 일정 제외, 내일 표기', () => {
  const { texts } = render(<AgendaWidget state={state} now={now} heightDp={400} />);
  expect(texts).toContain('24');
  expect(texts).toContain('화요일');
  expect(texts).toContain('점심 약속');
  expect(texts).toContain('내일 회의');
  expect(texts).not.toContain('지난 일정');
  expect(texts).not.toContain('가족 행사'); // visible=false 프로필
  expect(texts.some((t) => t.startsWith('내일 10:00'))).toBe(true);
});

test('프로필 선택 시 해당 프로필만 (숨김 프로필이어도 표시)', () => {
  const { texts } = render(<AgendaWidget state={{ ...state, activeProfileId: 'b' }} now={now} heightDp={400} />);
  expect(texts).toContain('가족 행사');
  expect(texts).not.toContain('점심 약속');
});

test('높이가 작으면 "+N개 더 보기", 일정 탭 시 상세로 딥링크', () => {
  const { texts, uris } = render(<AgendaWidget state={state} now={now} heightDp={150} />);
  expect(texts).toContain('+ 2개 더 보기');
  expect(uris).toContain('calendarapp://event/new');
  expect(uris).toContain('calendarapp://event/2');
});

test('일정이 없으면 빈 상태 문구', () => {
  const { texts } = render(<AgendaWidget state={{ ...state, events: [] }} now={now} />);
  expect(texts).toContain('예정된 일정이 없어요');
});

if (process.env.WIDGET_DUMP) {
  test('dump', () => {
    for (const mode of ['light', 'dark'] as const)
      for (const h of [150, 260])
        fs.writeFileSync(`${process.env.WIDGET_DUMP}/${mode}-${h}.json`, JSON.stringify(render(<AgendaWidget state={state} now={now} heightDp={h} mode={mode} />).tree));
  });
}

import { CalendarWidget, calendarLayout } from '../src/widget/CalendarWidget';
import { applyAction, clearView, DEFAULT_VIEW, loadView, saveView } from '../src/widget/state';
import { buildWidget } from '../src/widget/render';

interface TNode { t?: string; props?: { text?: string; style?: Record<string, number | string>; clickAction?: string; clickActionData?: { uri?: string } }; children?: unknown }
const nodes = (n: unknown, out: TNode[] = []): TNode[] => {
  if (Array.isArray(n)) n.forEach((x) => nodes(x, out));
  else if (n && typeof n === 'object') { out.push(n as TNode); nodes((n as TNode).children, out); }
  return out;
};
const kids = (n: TNode) => (Array.isArray(n.children) ? n.children : [n.children]).filter((x): x is TNode => !!x && typeof x === 'object');

const nov = (d: number, h = 0) => new Date(2026, 10, d, h).toISOString();
const calState: AppState = {
  profiles: [{ id: 'a', name: '나', color: '#4F7CFF', visible: true }],
  events: [
    ev('t', 'a', '가족 여행', 25, 0, { allDay: true, start: nov(25), end: nov(30), color: '#E67E22' }),
    ev('p', 'a', '프로젝트', 23, 0, { allDay: true, start: nov(23), end: nov(27) }),
    ev('h', 'a', '헬스', 25, 7, { start: nov(25, 7), end: nov(25, 8) }),
    ev('d', 'a', '치과', 25, 15, { start: nov(25, 15), end: nov(25, 16) }),
    ev('m', 'a', '회의', 25, 10, { start: nov(25, 10), end: nov(25, 11) }),
  ],
  activeProfileId: null, google: { connected: false },
};

test('위젯 크기에 따라 열 폭·막대 줄 수 결정', () => {
  expect(calendarLayout(320, 260)).toMatchObject({ colW: 43 });
  expect(calendarLayout(320, 260)).toMatchObject({ lanes: 1, more: false }); // 빠듯하면 막대 1줄, +N 생략
  expect(calendarLayout(320, 420)).toMatchObject({ lanes: 3, more: true });  // 큰 위젯은 3줄 + 가려진 개수
  expect(calendarLayout(320, 180).lanes).toBe(0);   // 작은 위젯은 막대 대신 점
  expect(calendarLayout(undefined, undefined).colW).toBeGreaterThan(0);
});

test('달력 위젯: 제목·요일·42칸 날짜·막대 제목·딥링크', () => {
  const { texts, uris } = render(<CalendarWidget state={calState} now={now} widthDp={330} heightDp={420} />);
  expect(texts).toContain('2026년 11월');
  for (const d of ['일', '월', '화', '수', '목', '금', '토']) expect(texts).toContain(d);
  expect(texts.filter((t) => /^\d+$/.test(t))).toHaveLength(42);
  expect(texts).toContain('프로젝트');
  expect(texts.filter((t) => t === '가족 여행')).toHaveLength(2); // 주 경계를 넘어 두 주에 걸쳐 그려짐
  expect(uris).toEqual(expect.arrayContaining(['calendarapp://event/new', 'calendarapp://event/t', 'calendarapp://event/p']));
});

test('달력 위젯: 각 막대 줄의 폭 합계가 정확히 7칸 (어긋남 없음) + 이어짐 모서리', () => {
  const w = 330, layout = calendarLayout(w, 420);
  const { tree } = render(<CalendarWidget state={calState} now={now} widthDp={w} heightDp={420} />);
  const laneRows = nodes(tree).filter((n) => n.t === 'FlexWidget' && n.props?.style?.height === 11 && n.props?.style?.flexDirection === 'row');
  expect(laneRows.length).toBeGreaterThan(0);
  for (const row of laneRows) {
    const sum = kids(row).reduce((a, k) => a + Number(k.props?.style?.width ?? 0) + Number(k.props?.style?.marginLeft ?? 0) + Number(k.props?.style?.marginRight ?? 0), 0);
    expect(sum).toBe(layout.colW * 7);
  }
  // 여행(25~30)은 첫 주에서 다음 주로 이어짐: 오른쪽 모서리 직각, 둘째 주에서 왼쪽 모서리 직각
  const trips = nodes(tree).filter((n) => n.props?.clickActionData?.uri === 'calendarapp://event/t');
  expect(trips).toHaveLength(2);
  expect(trips[0].props!.style).toMatchObject({ borderTopRightRadius: 0, borderTopLeftRadius: 3 });
  expect(trips[1].props!.style).toMatchObject({ borderTopLeftRadius: 0, borderTopRightRadius: 3 });
});

test('달력 위젯: 줄 수를 넘는 일정은 +N, 월 이동, 프로필 필터', () => {
  const { texts } = render(<CalendarWidget state={calState} now={now} widthDp={330} heightDp={420} />);
  expect(texts.some((t) => /^\+\d+$/.test(t))).toBe(true); // 25일에 5개(3줄 초과)
  expect(render(<CalendarWidget state={calState} now={now} monthOffset={1} widthDp={330} heightDp={420} />).texts).toContain('2026년 12월');
  expect(render(<CalendarWidget state={calState} now={now} monthOffset={-1} widthDp={330} heightDp={420} />).texts).toContain('2026년 10월');
  const hidden = { ...calState, profiles: [{ ...calState.profiles[0], visible: false }] };
  expect(render(<CalendarWidget state={hidden} now={now} widthDp={330} heightDp={420} />).texts).not.toContain('프로젝트');
});

test('위젯 버튼 동작: 달력 ⇄ 오늘 일정 전환, 이전/다음 달, 이번 달로', () => {
  let v = DEFAULT_VIEW;
  expect(v).toEqual({ mode: 'calendar', monthOffset: 0 });
  v = applyAction(v, 'NEXT_MONTH'); v = applyAction(v, 'NEXT_MONTH');
  expect(v.monthOffset).toBe(2);
  v = applyAction(v, 'PREV_MONTH');
  expect(v.monthOffset).toBe(1);
  v = applyAction(v, 'TOGGLE_MODE');
  expect(v.mode).toBe('agenda');
  expect(applyAction(v, 'GO_TODAY').monthOffset).toBe(0);
  expect(applyAction(v, 'TOGGLE_MODE').mode).toBe('calendar');
  expect(applyAction(v, 'UNKNOWN')).toBe(v);
});

test('buildWidget: 모드에 따라 달력/오늘 일정을 만들고 서로 전환 버튼을 가짐', () => {
  const cal = buildWidget(calState, { mode: 'calendar', monthOffset: 0 }, { width: 330, height: 420 }, now);
  const agenda = buildWidget(calState, { mode: 'agenda', monthOffset: 0 }, { width: 330, height: 420 }, now);
  const calTexts = render(cal.light).texts, agTexts = render(agenda.light).texts;
  expect(calTexts).toContain('오늘');   // 달력 모드의 전환 버튼 = 오늘 일정으로
  expect(agTexts).toContain('달력');    // 오늘 일정 모드의 전환 버튼 = 달력으로
  expect(calTexts).toContain('2026년 11월');
  expect(agTexts).toContain('화요일');
  expect(cal.dark).toBeDefined();
});

test('위젯마다 보기 상태를 따로 저장·복원, 삭제하면 기본값', async () => {
  expect(await loadView(11)).toEqual(DEFAULT_VIEW);
  await saveView(11, { mode: 'agenda', monthOffset: 3 });
  await saveView(12, { mode: 'calendar', monthOffset: -1 });
  expect(await loadView(11)).toEqual({ mode: 'agenda', monthOffset: 3 });
  expect(await loadView(12)).toEqual({ mode: 'calendar', monthOffset: -1 });
  await clearView(11);
  expect(await loadView(11)).toEqual(DEFAULT_VIEW);
});

if (process.env.WIDGET_DUMP) {
  test('dump calendar', () => {
    const lunarState = { ...calState, showLunar: true };
    const variants: [string, AppState, number, number, 'light' | 'dark'][] = [
      ['cal-light-420', calState, 330, 420, 'light'], ['cal-dark-420', calState, 330, 420, 'dark'],
      ['cal-light-260', calState, 330, 260, 'light'], ['cal-lunar-420', lunarState, 330, 420, 'light'],
    ];
    for (const [name, st, w, h, mode] of variants)
      fs.writeFileSync(`${process.env.WIDGET_DUMP}/${name}.json`, JSON.stringify({ w, h, tree: render(<CalendarWidget state={st} now={now} widthDp={w} heightDp={h} mode={mode} />).tree }));
    fs.writeFileSync(`${process.env.WIDGET_DUMP}/agenda-toggle.json`, JSON.stringify({ w: 330, h: 260, tree: render(buildWidget(calState, { mode: 'agenda', monthOffset: 0 }, { width: 330, height: 260 }, now).light).tree }));
  });
}

test('달력 위젯: 작은 크기에서도 가려진 일정은 날짜 옆 +N으로 알려줌', () => {
  const { texts } = render(<CalendarWidget state={calState} now={now} widthDp={330} heightDp={260} />);
  expect(texts.some((t) => /^\+\d+$/.test(t))).toBe(true);
});
