import React from 'react';
import type { WidgetInfo } from 'react-native-android-widget';
import type { AppState } from '../lib/types';
import { AgendaWidget } from './AgendaWidget';
import { CalendarWidget } from './CalendarWidget';
import type { WidgetViewState } from './state';

/** 보기 상태(달력/오늘 일정)와 위젯 크기에 맞는 라이트·다크 위젯 트리를 만든다 */
export function buildWidget(state: AppState, view: WidgetViewState, info: Pick<WidgetInfo, 'width' | 'height'>, now = new Date()) {
  const make = (mode: 'light' | 'dark') =>
    view.mode === 'calendar'
      ? <CalendarWidget state={state} monthOffset={view.monthOffset} now={now} widthDp={info.width} heightDp={info.height} mode={mode} />
      : <AgendaWidget state={state} now={now} heightDp={info.height} mode={mode} />;
  return { light: make('light'), dark: make('dark') };
}
