import React from 'react';
import { FlexWidget, TextWidget } from 'react-native-android-widget';
import { expand, fmtTime, startOfDay, addDays } from '../lib/dates';
import { visibleEvents } from '../lib/filter';
import type { AppState } from '../lib/types';

/** 홈 위젯: 선택된 프로필(또는 모든 프로필)의 오늘~내일 일정 */
export function AgendaWidget({ state, now = new Date() }: { state: AppState; now?: Date }) {
  const today = startOfDay(now);
  const occ = expand(visibleEvents(state), today, addDays(today, 2))
    .filter((o) => o.end >= now)
    .slice(0, 5);
  const scope = state.activeProfileId
    ? state.profiles.find((p) => p.id === state.activeProfileId)?.name ?? ''
    : '모든 프로필';

  return (
    <FlexWidget
      clickAction="OPEN_APP"
      style={{ height: 'match_parent', width: 'match_parent', backgroundColor: '#FFFFFF', borderRadius: 16, padding: 12, flexDirection: 'column' }}
    >
      <TextWidget
        text={`${now.getMonth() + 1}월 ${now.getDate()}일 · ${scope}`}
        style={{ fontSize: 14, fontWeight: 'bold', color: '#1F2937', marginBottom: 6 }}
      />
      {occ.length === 0 ? (
        <TextWidget text="예정된 일정이 없어요" style={{ fontSize: 13, color: '#6B7280' }} />
      ) : (
        occ.map((o, i) => {
          const color = (state.profiles.find((p) => p.id === o.event.profileId)?.color ?? '#4F7CFF') as `#${string}`;
          const isTomorrow = o.start >= addDays(today, 1);
          return (
            <FlexWidget key={i} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
              <FlexWidget style={{ width: 4, height: 16, backgroundColor: color, borderRadius: 2, marginRight: 8 }} />
              <TextWidget
                text={`${isTomorrow ? '내일 ' : ''}${o.event.allDay ? '종일' : fmtTime(o.start)}  ${o.event.title}`}
                style={{ fontSize: 13, color: '#111827' }}
                maxLines={1}
                truncate="END"
              />
            </FlexWidget>
          );
        })
      )}
    </FlexWidget>
  );
}
