import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { addDays, expand, fmtTime, sameDay, startOfDay } from '../lib/dates';
import { visibleEvents } from '../lib/filter';
import type { AppState, Occurrence } from '../lib/types';

import { PALETTE, widgetScale, type Hex, type Pal, type WidgetTheme } from './palette';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const ROW_H = 46; // 일정 카드 1개 높이(dp, 여백 포함)
const HEADER_H = 74;

/** 위젯 높이(dp)에 맞춰 보여줄 일정 개수 결정 (1~6) */
export const visibleRows = (heightDp?: number, widthDp?: number) =>
  Math.max(1, Math.min(6, Math.floor(((heightDp ?? 150) - Math.round(HEADER_H * widgetScale(widthDp)) - 12) / ROW_H)));

interface Props { state: AppState; now?: Date; widthDp?: number; heightDp?: number; mode?: WidgetTheme }

export function AgendaWidget({ state, now = new Date(), widthDp, heightDp, mode = 'light' }: Props) {
  const c = PALETTE[mode];
  const sc = widgetScale(widthDp); // 위젯이 커지면 헤더도 적당히 커짐
  const r = (n: number) => Math.round(n * sc);
  const onPrimary = mode === 'light' ? '#FFFFFF' : '#0B0C10';
  const today = startOfDay(now);
  const all = expand(visibleEvents(state), today, addDays(today, 3)).filter((o) => o.end >= now);
  const max = visibleRows(heightDp, widthDp);
  const shown = all.slice(0, max);
  const more = all.length - shown.length;
  const scope = state.activeProfileId ? state.profiles.find((p) => p.id === state.activeProfileId)?.name ?? '' : '모든 프로필';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 24, padding: 14, flexDirection: 'column' }}
    >
      <FlexWidget style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', marginBottom: 10 }}>
        <TextWidget text={String(now.getDate())} style={{ fontSize: r(34), fontWeight: 'bold', color: c.text, marginRight: 10 }} />
        <FlexWidget style={{ flex: 1, flexDirection: 'column', marginRight: 8 }}>
          <TextWidget text={`${DOW[now.getDay()]}요일`} style={{ fontSize: r(14), fontWeight: 'bold', color: c.text }} />
          <TextWidget text={`${now.getMonth() + 1}월 · ${scope}`} style={{ fontSize: r(12), color: c.sub }} maxLines={1} truncate="END" />
        </FlexWidget>
        <FlexWidget
          clickAction="TOGGLE_MODE" accessibilityLabel="달력 보기로 전환"
          style={{ height: r(22), paddingHorizontal: r(9), borderRadius: r(11), backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}
        >
          <TextWidget text="달력" style={{ fontSize: r(11), fontWeight: 'bold', color: c.primary }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI"
          clickActionData={{ uri: 'calendarapp://event/new' }}
          accessibilityLabel="일정 추가"
          style={{ width: r(36), height: r(36), borderRadius: r(18), backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text="+" style={{ fontSize: r(22), fontWeight: 'bold', color: onPrimary }} />
        </FlexWidget>
      </FlexWidget>

      {shown.length === 0 ? (
        <FlexWidget style={{ width: 'match_parent', flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <TextWidget text="예정된 일정이 없어요" style={{ fontSize: 14, fontWeight: 'bold', color: c.text }} />
          <TextWidget text="여유로운 하루 보내세요" style={{ fontSize: 12, color: c.sub, marginTop: 2 }} />
        </FlexWidget>
      ) : (
        shown.map((o, i) => <Item key={`${o.event.id}-${i}`} o={o} now={now} state={state} c={c} />)
      )}

      {more > 0 && (
        <TextWidget text={`+ ${more}개 더 보기`} style={{ fontSize: 12, fontWeight: 'bold', color: c.primary, marginTop: 2, marginLeft: 4 }} />
      )}
    </FlexWidget>
  );
}

function Item({ o, now, state, c }: { o: Occurrence; now: Date; state: AppState; c: Pal }) {
  const p = state.profiles.find((x) => x.id === o.event.profileId);
  const color = (o.event.color ?? p?.color ?? c.primary) as Hex;
  const day = sameDay(o.start, now) ? '' : sameDay(o.start, addDays(now, 1)) ? '내일 ' : `${o.start.getMonth() + 1}/${o.start.getDate()} `;
  const when = o.event.allDay ? `${day}종일` : `${day}${fmtTime(o.start)}–${fmtTime(o.end)}`;
  return (
    <FlexWidget
      clickAction="OPEN_URI"
      clickActionData={{ uri: `calendarapp://event/${o.event.id}` }}
      accessibilityLabel={o.event.title}
      style={{ width: 'match_parent', flexDirection: 'row', alignItems: 'center', backgroundColor: c.item, borderRadius: 12, paddingVertical: 7, paddingHorizontal: 10, marginBottom: 6 }}
    >
      <FlexWidget style={{ width: 4, height: 28, borderRadius: 2, backgroundColor: color, marginRight: 10 }} />
      <FlexWidget style={{ flex: 1, flexDirection: 'column' }}>
        <TextWidget text={o.event.title} style={{ fontSize: 14, fontWeight: 'bold', color: c.text }} maxLines={1} truncate="END" />
        <TextWidget text={`${when}${p ? ` · ${p.name}` : ''}`} style={{ fontSize: 11, color: c.sub }} maxLines={1} truncate="END" />
      </FlexWidget>
    </FlexWidget>
  );
}
