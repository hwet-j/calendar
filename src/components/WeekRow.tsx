import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { eventColor } from '../lib/filter';
import { hiddenPerDay, textColorOn, type Seg } from '../lib/layout';
import { lunarCell, type LunarFull } from '../lib/lunar';
import { dayKey, sameDay } from '../lib/dates';
import type { Profile } from '../lib/types';
import { Theme, useTheme } from './theme';

export const LANE_H = 15;
export const NUM_H = 24;
export const MORE_H = 11;

interface Props {
  week: Date[];
  segs: Seg[];
  maxLanes: number;
  height: number;
  month: number; // 보고 있는 달 (다른 달 날짜는 흐리게)
  sel: Date;
  now: Date;
  showLunar: boolean;
  lunarOf: Map<string, LunarFull | null>;
  profiles: Profile[];
  onSelect: (d: Date) => void;
}

/**
 * 한 주(7칸)를 그린다. 날짜 칸 위에 일정 막대를 겹쳐 놓는 구글 캘린더 월간 보기 방식.
 * 막대는 flex 비율로 폭을 나눠 (퍼센트 폭 대신) 안드로이드에서도 7칸이 정확히 맞는다.
 */
export function WeekRow({ week, segs, maxLanes, height, month, sel, now, showLunar, lunarOf, profiles, onSelect }: Props) {
  const t = useTheme();
  const s = useMemo(() => styles(t), [t]);
  const hidden = useMemo(() => hiddenPerDay(segs, maxLanes), [segs, maxLanes]);

  const lanes = useMemo(() => {
    const out: Seg[][] = Array.from({ length: maxLanes }, () => []);
    for (const sg of segs) if (sg.lane < maxLanes) out[sg.lane].push(sg);
    return out.map((l) => l.sort((a, b) => a.startCol - b.startCol));
  }, [segs, maxLanes]);

  return (
    <View style={{ height }}>
      {/* 날짜 칸 (탭하면 선택) */}
      <View style={[StyleSheet.absoluteFill, s.row]}>
        {week.map((d, i) => {
          const out = d.getMonth() !== month;
          const isSel = sameDay(d, sel);
          const isToday = sameDay(d, now);
          const l = lunarOf.get(dayKey(d));
          const count = segs.filter((x) => x.startCol <= i && x.endCol >= i).length;
          return (
            <Pressable key={i} style={[s.cell, isSel && s.cellSel]} onPress={() => onSelect(d)}
              accessibilityLabel={`${d.getMonth() + 1}월 ${d.getDate()}일, 일정 ${count}개`}>
              <View style={s.numRow}>
                <View style={[s.num, isToday && { backgroundColor: t.primary }]}>
                  <Text style={[
                    s.numT,
                    d.getDay() === 0 && { color: t.sun }, d.getDay() === 6 && { color: t.sat },
                    out && { color: t.faint },
                    isSel && { fontWeight: '800' },
                    isToday && { color: '#fff', fontWeight: '800' },
                  ]}>{d.getDate()}</Text>
                </View>
                {showLunar && l && <Text style={[s.lunarT, out && { opacity: 0.5 }]} numberOfLines={1}>{lunarCell(l)}</Text>}
              </View>
            </Pressable>
          );
        })}
      </View>

      {/* 일정 막대 (터치는 아래 날짜 칸으로 통과) */}
      <View style={[s.lanes, { top: NUM_H }]} pointerEvents="none">
        {lanes.map((lane, li) => {
          const items: React.ReactNode[] = [];
          let cursor = 0;
          lane.forEach((sg, k) => {
            if (sg.startCol > cursor) items.push(<View key={`g${k}`} style={{ flex: sg.startCol - cursor }} />);
            const c = eventColor(sg.occ.event, profiles);
            items.push(
              <View key={`b${k}`} style={[s.bar, {
                flex: sg.endCol - sg.startCol + 1, backgroundColor: c,
                borderTopLeftRadius: sg.fromPrev ? 0 : 4, borderBottomLeftRadius: sg.fromPrev ? 0 : 4,
                borderTopRightRadius: sg.toNext ? 0 : 4, borderBottomRightRadius: sg.toNext ? 0 : 4,
                marginLeft: sg.fromPrev ? 0 : 1.5, marginRight: sg.toNext ? 0 : 1.5,
              }]}>
                <Text style={[s.barT, { color: textColorOn(c) }]} numberOfLines={1}>{sg.occ.event.title}</Text>
              </View>,
            );
            cursor = sg.endCol + 1;
          });
          if (cursor < 7) items.push(<View key="tail" style={{ flex: 7 - cursor }} />);
          return <View key={li} style={s.lane}>{items}</View>;
        })}
      </View>

      {/* 줄 수를 넘어 가려진 일정 개수 */}
      <View style={s.more} pointerEvents="none">
        {hidden.map((n, i) => <Text key={i} style={s.moreT}>{n > 0 ? `+${n}` : ''}</Text>)}
      </View>
    </View>
  );
}

const styles = (t: Theme) => StyleSheet.create({
  row: { flexDirection: 'row' },
  cell: { flex: 1, alignItems: 'center', borderRadius: 8 },
  cellSel: { backgroundColor: t.primarySoft },
  numRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 2, height: NUM_H, paddingTop: 2 },
  num: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center' },
  numT: { fontSize: 13, color: t.text, fontWeight: '500' },
  lunarT: { fontSize: 8.5, color: t.sub },
  lanes: { position: 'absolute', left: 0, right: 0 },
  lane: { flexDirection: 'row', height: LANE_H, marginBottom: 0 },
  bar: { height: LANE_H - 1.5, justifyContent: 'center', paddingHorizontal: 3, overflow: 'hidden' },
  barT: { fontSize: 9.5, fontWeight: '700' },
  more: { position: 'absolute', left: 0, right: 0, bottom: 1, flexDirection: 'row', height: MORE_H },
  moreT: { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '700', color: t.sub },
});
