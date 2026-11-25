import { Platform } from 'react-native';
import type { AppState } from '../lib/types';

/** 앱에서 데이터가 바뀔 때 홈 위젯을 즉시 갱신 (Android만). 각 위젯의 보기 상태(달력/오늘, 월)는 유지 */
export async function refreshWidgets(state: AppState) {
  if (Platform.OS !== 'android') return;
  try {
    const { requestWidgetUpdate } = await import('react-native-android-widget');
    const { buildWidget } = await import('./render');
    const { loadView } = await import('./state');
    await requestWidgetUpdate({
      widgetName: 'AgendaWidget',
      renderWidget: async (info) => buildWidget(state, await loadView(info.widgetId), info),
    });
  } catch {
    /* Expo Go 등 네이티브 모듈이 없는 환경에서는 무시 */
  }
}
