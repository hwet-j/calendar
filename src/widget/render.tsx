import React from 'react';
import type { WidgetInfo } from 'react-native-android-widget';
import type { AppState } from '../lib/types';
import { AgendaWidget } from './AgendaWidget';
import { CalendarWidget } from './CalendarWidget';
import type { WidgetTheme } from './palette';
import type { WidgetViewState } from './state';

/**
 * 보기 상태(달력/오늘 일정), 위젯 크기, 앱에서 고른 테마에 맞는 위젯 트리를 만든다.
 * 테마가 '시스템'이면 라이트/다크 두 벌을 만들어 안드로이드가 시스템 설정에 맞춰 고르게 하고,
 * 라이트/다크/블랙으로 고정했으면 같은 화면을 양쪽에 넣어 시스템 설정과 무관하게 항상 그 테마로 보이게 한다.
 */
export function buildWidget(state: AppState, view: WidgetViewState, info: Pick<WidgetInfo, 'width' | 'height'>, now = new Date()) {
  const make = (mode: WidgetTheme) =>
    view.mode === 'calendar'
      ? <CalendarWidget state={state} monthOffset={view.monthOffset} now={now} widthDp={info.width} heightDp={info.height} mode={mode} />
      : <AgendaWidget state={state} now={now} widthDp={info.width} heightDp={info.height} mode={mode} />;
  const choice = state.theme ?? 'system';
  if (choice === 'system') return { light: make('light'), dark: make('dark') };
  const fixed = make(choice);
  return { light: fixed, dark: fixed };
}
