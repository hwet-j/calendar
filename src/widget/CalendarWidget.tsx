import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { chunkWeeks, expand, monthGrid, sameDay } from '../lib/dates';
import { eventColor, visibleEvents } from '../lib/filter';
import { hiddenPerDay, layoutWeek, textColorOn, type Seg } from '../lib/layout';
import { solarToLunar, lunarCell } from '../lib/lunar';
import type { AppState } from '../lib/types';
import { PALETTE, type Hex, type Pal } from './palette';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const PAD = 8;
const HEADER_H = 30;
const DOW_H = 14;
const NUM_H = 15;
const LANE_H = 11;
const MORE_H = 9;

export interface CalendarLayout { colW: number; rowH: number; lanes: number; /** "+N" 줄을 둘 공간이 있는지 */ more: boolean }

/** 위젯 크기(dp)에 맞는 열 폭, 주 높이, 표시할 막대 줄 수 */
export function calendarLayout(widthDp = 320, heightDp = 260): CalendarLayout {
  const colW = Math.max(20, Math.floor((widthDp - PAD * 2) / 7));
  const rowH = Math.floor((heightDp - PAD * 2 - HEADER_H - DOW_H) / 6);
  let lanes = Math.floor((rowH - NUM_H - MORE_H) / LANE_H);
  let more = true;
  if (lanes < 1 && rowH - NUM_H >= LANE_H) { lanes = 1; more = false; } // 빠듯하면 "+N" 줄을 포기하고 막대 1줄은 보이게
  return { colW, rowH, lanes: Math.max(0, Math.min(3, lanes)), more };
}

interface Props {
  state: AppState;
  /** 이번 달 기준 몇 달 앞/뒤 */
  monthOffset?: number;
  now?: Date;
  widthDp?: number;
  heightDp?: number;
  mode?: 'light' | 'dark';
}

/** 앱 홈과 같은 표현(날짜 + 색 막대, 여러 날 일정은 이어진 막대)의 월간 달력 위젯 */
export function CalendarWidget({ state, monthOffset = 0, now = new Date(), widthDp, heightDp, mode = 'light' }: Props) {
  const c = PALETTE[mode];
  const { colW, rowH, lanes, more } = calendarLayout(widthDp, heightDp);
  const cur = new Date(now.getFullYear(), now.getMonth() + monthOffset, 1);
  const grid = monthGrid(cur.getFullYear(), cur.getMonth());
  const weeks = chunkWeeks(grid);
  const occ = expand(visibleEvents(state), grid[0], new Date(grid[41].getFullYear(), grid[41].getMonth(), grid[41].getDate() + 1));
  const rowW = colW * 7;
  const scope = state.activeProfileId ? state.profiles.find((p) => p.id === state.activeProfileId)?.name : undefined;

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: c.bg, borderRadius: 24, padding: PAD, flexDirection: 'column' }}
    >
      {/* 헤더: ‹ 2026년 11월 › · 오늘 일정으로 전환 · 일정 추가 */}
      <FlexWidget style={{ width: rowW, height: HEADER_H, flexDirection: 'row', alignItems: 'center' }}>
        <Btn action="PREV_MONTH" label="이전 달" text="‹" c={c} />
        <FlexWidget clickAction="GO_TODAY" accessibilityLabel="이번 달로 이동" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
          <TextWidget text={`${cur.getFullYear()}년 ${cur.getMonth() + 1}월`} style={{ fontSize: 15, fontWeight: 'bold', color: c.text }} />
          {scope ? <TextWidget text={` · ${scope}`} style={{ fontSize: 11, color: c.sub }} maxLines={1} truncate="END" /> : null}
        </FlexWidget>
        <Btn action="NEXT_MONTH" label="다음 달" text="›" c={c} />
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget
          clickAction="TOGGLE_MODE" accessibilityLabel="오늘 일정 보기로 전환"
          style={{ height: 22, paddingHorizontal: 9, borderRadius: 11, backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}
        >
          <TextWidget text="오늘" style={{ fontSize: 11, fontWeight: 'bold', color: c.primary }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI" clickActionData={{ uri: 'calendarapp://event/new' }} accessibilityLabel="일정 추가"
          style={{ width: 24, height: 24, borderRadius: 12, backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text="+" style={{ fontSize: 16, fontWeight: 'bold', color: '#FFFFFF' }} />
        </FlexWidget>
      </FlexWidget>

      {/* 요일 */}
      <FlexWidget style={{ width: rowW, height: DOW_H, flexDirection: 'row' }}>
        {DOW.map((d, i) => (
          <FlexWidget key={d} style={{ width: colW, height: DOW_H, alignItems: 'center', justifyContent: 'center' }}>
            <TextWidget text={d} style={{ fontSize: 9, fontWeight: 'bold', color: i === 0 ? c.sun : i === 6 ? c.sat : c.sub }} />
          </FlexWidget>
        ))}
      </FlexWidget>

      {/* 주 단위 행: 날짜 숫자 줄 + 일정 막대 줄들 */}
      {weeks.map((week, wi) => {
        const segs = layoutWeek(occ, week[0]);
        return <Week key={wi} week={week} segs={segs} month={cur.getMonth()} now={now} colW={colW} rowH={rowH} lanes={lanes} more={more}
          showLunar={!!state.showLunar} state={state} c={c} />;
      })}
    </FlexWidget>
  );
}

function Btn({ action, label, text, c }: { action: string; label: string; text: string; c: Pal }) {
  return (
    <FlexWidget clickAction={action} accessibilityLabel={label} style={{ width: 24, height: HEADER_H, alignItems: 'center', justifyContent: 'center' }}>
      <TextWidget text={text} style={{ fontSize: 20, fontWeight: 'bold', color: c.text }} />
    </FlexWidget>
  );
}

function Week({ week, segs, month, now, colW, rowH, lanes, more, showLunar, state, c }: {
  week: Date[]; segs: Seg[]; month: number; now: Date; colW: number; rowH: number; lanes: number; more: boolean; showLunar: boolean; state: AppState; c: Pal;
}) {
  const rowW = colW * 7;
  const hidden = hiddenPerDay(segs, lanes);
  const laneSegs: Seg[][] = Array.from({ length: lanes }, () => []);
  for (const s of segs) if (s.lane < lanes) laneSegs[s.lane].push(s);

  return (
    <FlexWidget style={{ width: rowW, height: rowH, flexDirection: 'column' }}>
      {/* 날짜 숫자 */}
      <FlexWidget style={{ width: rowW, height: NUM_H, flexDirection: 'row' }}>
        {week.map((d, i) => {
          const out = d.getMonth() !== month;
          const today = sameDay(d, now);
          const base = out ? c.sub : i === 0 ? c.sun : i === 6 ? c.sat : c.text;
          const l = showLunar ? solarToLunar(d) : null;
          const dots = lanes === 0 ? segs.filter((s) => s.startCol <= i && s.endCol >= i).slice(0, 1) : [];
          return (
            <FlexWidget key={i} clickAction="OPEN_APP" style={{ width: colW, height: NUM_H, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <FlexWidget style={{ width: 16, height: 14, borderRadius: 7, backgroundColor: today ? c.primary : '#00000000', alignItems: 'center', justifyContent: 'center' }}>
                <TextWidget text={String(d.getDate())} style={{ fontSize: 9.5, fontWeight: today ? 'bold' : 'normal', color: today ? '#FFFFFF' : base }} />
              </FlexWidget>
              {/* +N 줄을 둘 공간이 없을 땐 날짜 옆에 가려진 일정 수를 표시 (없으면 음력) */}
              {lanes > 0 && !more && hidden[i] > 0
                ? <TextWidget text={`+${hidden[i]}`} style={{ fontSize: 7, fontWeight: 'bold', color: c.sub }} />
                : l && colW >= 36 ? <TextWidget text={lunarCell(l)} style={{ fontSize: 7, color: c.sub }} /> : null}
              {dots.map((s) => <FlexWidget key="d" style={{ width: 4, height: 4, borderRadius: 2, marginLeft: 1, backgroundColor: eventColor(s.occ.event, state.profiles) as Hex }} />)}
            </FlexWidget>
          );
        })}
      </FlexWidget>

      {/* 일정 막대 줄 */}
      {laneSegs.map((lane, li) => {
        const items: React.ReactNode[] = [];
        let cursor = 0;
        lane.sort((a, b) => a.startCol - b.startCol).forEach((sg, k) => {
          const gap = (sg.startCol - cursor) * colW;
          if (gap > 0) items.push(<FlexWidget key={`g${k}`} style={{ width: gap, height: LANE_H }} />);
          const mL = sg.fromPrev ? 0 : 1, mR = sg.toNext ? 0 : 1;
          const bg = eventColor(sg.occ.event, state.profiles) as Hex;
          items.push(
            <FlexWidget
              key={`b${k}`} clickAction="OPEN_URI" clickActionData={{ uri: `calendarapp://event/${sg.occ.event.id}` }}
              accessibilityLabel={sg.occ.event.title}
              style={{
                width: (sg.endCol - sg.startCol + 1) * colW - mL - mR, height: LANE_H - 1, marginLeft: mL, marginRight: mR, marginBottom: 1,
                backgroundColor: bg, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 3,
                borderTopLeftRadius: sg.fromPrev ? 0 : 3, borderBottomLeftRadius: sg.fromPrev ? 0 : 3,
                borderTopRightRadius: sg.toNext ? 0 : 3, borderBottomRightRadius: sg.toNext ? 0 : 3,
              }}
            >
              <TextWidget text={sg.occ.event.title} maxLines={1} truncate="END" style={{ fontSize: 8, fontWeight: 'bold', color: textColorOn(bg) as Hex }} />
            </FlexWidget>,
          );
          cursor = sg.endCol + 1;
        });
        if (cursor < 7) items.push(<FlexWidget key="t" style={{ width: (7 - cursor) * colW, height: LANE_H }} />);
        return <FlexWidget key={li} style={{ width: rowW, height: LANE_H, flexDirection: 'row' }}>{items}</FlexWidget>;
      })}

      {/* 가려진 일정 +N */}
      {lanes > 0 && more && hidden.some((n) => n > 0) ? (
        <FlexWidget style={{ width: rowW, height: MORE_H, flexDirection: 'row' }}>
          {hidden.map((n, i) => (
            <FlexWidget key={i} style={{ width: colW, height: MORE_H, alignItems: 'center', justifyContent: 'center' }}>
              <TextWidget text={n > 0 ? `+${n}` : ' '} style={{ fontSize: 7, fontWeight: 'bold', color: c.sub }} />
            </FlexWidget>
          ))}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
