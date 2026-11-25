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
