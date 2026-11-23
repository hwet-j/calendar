import React from 'react';
import { Platform } from 'react-native';
import type { AppState } from '../lib/types';

/** 앱에서 데이터가 바뀔 때 홈 위젯을 즉시 갱신 (Android만) */
export async function refreshWidgets(state: AppState) {
  if (Platform.OS !== 'android') return;
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    const { AgendaWidget } = await import('./AgendaWidget');
    await requestWidgetUpdate({
      widgetName: 'AgendaWidget',
      renderWidget: () => React.createElement(AgendaWidget, { state }),
    });
  } catch {
    /* Expo Go 등 네이티브 모듈이 없는 환경에서는 무시 */
  }
}
