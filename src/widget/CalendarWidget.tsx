import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { chunkWeeks, expand, monthGrid, sameDay } from '../lib/dates';
import { eventColor, visibleEvents } from '../lib/filter';
import { hiddenPerDay, layoutWeek, textColorOn, type Seg } from '../lib/layout';
import { solarToLunar, lunarCell } from '../lib/lunar';
import type { AppState } from '../lib/types';
import { PALETTE, widgetScale, type Hex, type Pal, type WidgetTheme } from './palette';

const DOW = ['일', '월', '화', '수', '목', '금', '토'];
const PAD = 8;

/**
 * 위젯 폭에 비례한 치수. 헤더(년월 제목, ‹ › 버튼, 오늘/+ 버튼)는 배율을 그대로,
 * 요일·날짜·막대는 배율의 절반만 반영해 넓은 위젯에서도 칸 안에 알맞게 들어가게 한다.
 */
export function metrics(widthDp = 330) {
  const sc = widgetScale(widthDp);
  const bs = 1 + (sc - 1) * 0.5;
  const r = (n: number, k: number) => Math.round(n * k);
  return {
    sc, bs,
    headerH: r(30, sc), arrowW: r(24, sc), arrowFs: r(20, sc), titleFs: r(15, sc), subFs: r(11, sc),
    pillH: r(22, sc), pillFs: r(11, sc), pillPad: r(9, sc), plus: r(24, sc), plusFs: r(16, sc),
    dowH: r(14, bs), dowFs: 9 * bs, numH: r(15, bs), numFs: 9.5 * bs, circW: r(16, bs), circH: r(14, bs), lunarFs: 7 * bs,
    laneH: r(11, bs), barFs: 8 * bs, moreH: r(9, bs), moreFs: 7 * bs,
  };
}

export interface CalendarLayout { colW: number; rowH: number; lanes: number; /** "+N" 줄을 둘 공간이 있는지 */ more: boolean }

/** 위젯 크기(dp)에 맞는 열 폭, 주 높이, 표시할 막대 줄 수 */
export function calendarLayout(widthDp = 320, heightDp = 260): CalendarLayout {
  const m = metrics(widthDp);
  const colW = Math.max(20, Math.floor((widthDp - PAD * 2) / 7));
  const rowH = Math.floor((heightDp - PAD * 2 - m.headerH - m.dowH) / 6);
  let lanes = Math.floor((rowH - m.numH - m.moreH) / m.laneH);
  let more = true;
  if (lanes < 1 && rowH - m.numH >= m.laneH) { lanes = 1; more = false; } // 빠듯하면 "+N" 줄을 포기하고 막대 1줄은 보이게
  return { colW, rowH, lanes: Math.max(0, Math.min(3, lanes)), more };
}

interface Props {
  state: AppState;
  /** 이번 달 기준 몇 달 앞/뒤 */
  monthOffset?: number;
  now?: Date;
  widthDp?: number;
  heightDp?: number;
  mode?: WidgetTheme;
}

/** 앱 홈과 같은 표현(날짜 + 색 막대, 여러 날 일정은 이어진 막대)의 월간 달력 위젯 */
export function CalendarWidget({ state, monthOffset = 0, now = new Date(), widthDp, heightDp, mode = 'light' }: Props) {
  const c = PALETTE[mode];
  const m = metrics(widthDp);
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
      {/* 헤더: ‹ 2026년 11월 › · 오늘 일정으로 전환 · 일정 추가 (위젯이 커지면 함께 커짐) */}
      <FlexWidget style={{ width: rowW, height: m.headerH, flexDirection: 'row', alignItems: 'center' }}>
        <Btn action="PREV_MONTH" label="이전 달" text="‹" c={c} m={m} />
        <FlexWidget clickAction="GO_TODAY" accessibilityLabel="이번 달로 이동" style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 2 }}>
          <TextWidget text={`${cur.getFullYear()}년 ${cur.getMonth() + 1}월`} style={{ fontSize: m.titleFs, fontWeight: 'bold', color: c.text }} />
          {scope ? <TextWidget text={` · ${scope}`} style={{ fontSize: m.subFs, color: c.sub }} maxLines={1} truncate="END" /> : null}
        </FlexWidget>
        <Btn action="NEXT_MONTH" label="다음 달" text="›" c={c} m={m} />
        <FlexWidget style={{ flex: 1 }} />
        <FlexWidget
          clickAction="TOGGLE_MODE" accessibilityLabel="오늘 일정 보기로 전환"
          style={{ height: m.pillH, paddingHorizontal: m.pillPad, borderRadius: Math.round(m.pillH / 2), backgroundColor: c.soft, alignItems: 'center', justifyContent: 'center', marginRight: 6 }}
        >
          <TextWidget text="오늘" style={{ fontSize: m.pillFs, fontWeight: 'bold', color: c.primary }} />
        </FlexWidget>
        <FlexWidget
          clickAction="OPEN_URI" clickActionData={{ uri: 'calendarapp://event/new' }} accessibilityLabel="일정 추가"
          style={{ width: m.plus, height: m.plus, borderRadius: Math.round(m.plus / 2), backgroundColor: c.primary, alignItems: 'center', justifyContent: 'center' }}
        >
          <TextWidget text="+" style={{ fontSize: m.plusFs, fontWeight: 'bold', color: mode === 'light' ? '#FFFFFF' : '#0B0C10' }} />
        </FlexWidget>
      </FlexWidget>

      {/* 요일 */}
      <FlexWidget style={{ width: rowW, height: m.dowH, flexDirection: 'row' }}>
        {DOW.map((d, i) => (
          <FlexWidget key={d} style={{ width: colW, height: m.dowH, alignItems: 'center', justifyContent: 'center' }}>
            <TextWidget text={d} style={{ fontSize: m.dowFs, fontWeight: 'bold', color: i === 0 ? c.sun : i === 6 ? c.sat : c.sub }} />
          </FlexWidget>
        ))}
      </FlexWidget>

      {/* 주 단위 행: 날짜 숫자 줄 + 일정 막대 줄들 */}
      {weeks.map((week, wi) => {
        const segs = layoutWeek(occ, week[0]);
        return <Week key={wi} week={week} segs={segs} month={cur.getMonth()} now={now} colW={colW} rowH={rowH} lanes={lanes} more={more}
          showLunar={!!state.showLunar} state={state} c={c} m={m} mode={mode} />;
      })}
    </FlexWidget>
  );
}

type M = ReturnType<typeof metrics>;

function Btn({ action, label, text, c, m }: { action: string; label: string; text: string; c: Pal; m: M }) {
  return (
    <FlexWidget clickAction={action} accessibilityLabel={label} style={{ width: m.arrowW, height: m.headerH, alignItems: 'center', justifyContent: 'center' }}>
      <TextWidget text={text} style={{ fontSize: m.arrowFs, fontWeight: 'bold', color: c.text }} />
    </FlexWidget>
  );
}

function Week({ week, segs, month, now, colW, rowH, lanes, more, showLunar, state, c, m, mode }: {
  week: Date[]; segs: Seg[]; month: number; now: Date; colW: number; rowH: number; lanes: number; more: boolean; showLunar: boolean; state: AppState; c: Pal; m: M; mode: WidgetTheme;
}) {
  const rowW = colW * 7;
  const hidden = hiddenPerDay(segs, lanes);
  const laneSegs: Seg[][] = Array.from({ length: lanes }, () => []);
  for (const s of segs) if (s.lane < lanes) laneSegs[s.lane].push(s);

  return (
    <FlexWidget style={{ width: rowW, height: rowH, flexDirection: 'column' }}>
      {/* 날짜 숫자 */}
      <FlexWidget style={{ width: rowW, height: m.numH, flexDirection: 'row' }}>
        {week.map((d, i) => {
          const out = d.getMonth() !== month;
          const today = sameDay(d, now);
          const base = out ? c.sub : i === 0 ? c.sun : i === 6 ? c.sat : c.text;
          const l = showLunar ? solarToLunar(d) : null;
          const dots = lanes === 0 ? segs.filter((s) => s.startCol <= i && s.endCol >= i).slice(0, 1) : [];
          return (
            <FlexWidget key={i} clickAction="OPEN_APP" style={{ width: colW, height: m.numH, flexDirection: 'row', alignItems: 'center', justifyContent: 'center' }}>
              <FlexWidget style={{ width: m.circW, height: m.circH, borderRadius: Math.round(m.circH / 2), backgroundColor: today ? c.primary : '#00000000', alignItems: 'center', justifyContent: 'center' }}>
                <TextWidget text={String(d.getDate())} style={{ fontSize: m.numFs, fontWeight: today ? 'bold' : 'normal', color: today ? (mode === 'light' ? '#FFFFFF' : '#0B0C10') : base }} />
              </FlexWidget>
              {/* +N 줄을 둘 공간이 없을 땐 날짜 옆에 가려진 일정 수를 표시 (없으면 음력) */}
              {lanes > 0 && !more && hidden[i] > 0
                ? <TextWidget text={`+${hidden[i]}`} style={{ fontSize: m.lunarFs, fontWeight: 'bold', color: c.sub }} />
                : l && colW >= 36 ? <TextWidget text={lunarCell(l)} style={{ fontSize: m.lunarFs, color: c.sub }} /> : null}
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
          if (gap > 0) items.push(<FlexWidget key={`g${k}`} style={{ width: gap, height: m.laneH }} />);
          const mL = sg.fromPrev ? 0 : 1, mR = sg.toNext ? 0 : 1;
          const bg = eventColor(sg.occ.event, state.profiles) as Hex;
          items.push(
            <FlexWidget
              key={`b${k}`} clickAction="OPEN_URI" clickActionData={{ uri: `calendarapp://event/${sg.occ.event.id}` }}
              accessibilityLabel={sg.occ.event.title}
              style={{
                width: (sg.endCol - sg.startCol + 1) * colW - mL - mR, height: m.laneH - 1, marginLeft: mL, marginRight: mR, marginBottom: 1,
                backgroundColor: bg, overflow: 'hidden', justifyContent: 'center', paddingHorizontal: 3,
                borderTopLeftRadius: sg.fromPrev ? 0 : 3, borderBottomLeftRadius: sg.fromPrev ? 0 : 3,
                borderTopRightRadius: sg.toNext ? 0 : 3, borderBottomRightRadius: sg.toNext ? 0 : 3,
              }}
            >
              <TextWidget text={sg.occ.event.title} maxLines={1} truncate="END" style={{ fontSize: m.barFs, fontWeight: 'bold', color: textColorOn(bg) as Hex }} />
            </FlexWidget>,
          );
          cursor = sg.endCol + 1;
        });
        if (cursor < 7) items.push(<FlexWidget key="t" style={{ width: (7 - cursor) * colW, height: m.laneH }} />);
        return <FlexWidget key={li} style={{ width: rowW, height: m.laneH, flexDirection: 'row' }}>{items}</FlexWidget>;
      })}

      {/* 가려진 일정 +N */}
      {lanes > 0 && more && hidden.some((n) => n > 0) ? (
        <FlexWidget style={{ width: rowW, height: m.moreH, flexDirection: 'row' }}>
          {hidden.map((n, i) => (
            <FlexWidget key={i} style={{ width: colW, height: m.moreH, alignItems: 'center', justifyContent: 'center' }}>
              <TextWidget text={n > 0 ? `+${n}` : ' '} style={{ fontSize: m.moreFs, fontWeight: 'bold', color: c.sub }} />
            </FlexWidget>
          ))}
        </FlexWidget>
      ) : null}
    </FlexWidget>
  );
}
