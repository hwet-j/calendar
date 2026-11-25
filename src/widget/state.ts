import AsyncStorage from '@react-native-async-storage/async-storage';

/** 위젯 하나(widgetId)마다 따로 기억하는 보기 상태 */
export interface WidgetViewState {
  /** calendar: 월간 달력(앱과 같은 막대 표시) / agenda: 오늘·내일 일정 목록 */
  mode: 'calendar' | 'agenda';
  /** 이번 달 기준으로 몇 달 앞/뒤를 보고 있는지 (달력 모드) */
  monthOffset: number;
}

export const DEFAULT_VIEW: WidgetViewState = { mode: 'calendar', monthOffset: 0 };
const key = (id: number) => `calendar-app/widget/${id}`;

export async function loadView(widgetId: number): Promise<WidgetViewState> {
  try {
    const raw = await AsyncStorage.getItem(key(widgetId));
    return raw ? { ...DEFAULT_VIEW, ...JSON.parse(raw) } : DEFAULT_VIEW;
  } catch {
    return DEFAULT_VIEW;
  }
}
export const saveView = (widgetId: number, v: WidgetViewState) => AsyncStorage.setItem(key(widgetId), JSON.stringify(v)).catch(() => {});
export const clearView = (widgetId: number) => AsyncStorage.removeItem(key(widgetId)).catch(() => {});

/** 위젯 안의 버튼 동작을 보기 상태에 반영 (순수 함수) */
export function applyAction(v: WidgetViewState, action?: string): WidgetViewState {
  switch (action) {
    case 'TOGGLE_MODE': return { ...v, mode: v.mode === 'calendar' ? 'agenda' : 'calendar' };
    case 'PREV_MONTH': return { ...v, monthOffset: v.monthOffset - 1 };
    case 'NEXT_MONTH': return { ...v, monthOffset: v.monthOffset + 1 };
    case 'GO_TODAY': return { ...v, monthOffset: 0 };
    default: return v;
  }
}
