import AsyncStorage from '@react-native-async-storage/async-storage';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { initialState, STORAGE_KEY } from '../lib/store';
import { buildWidget } from './render';
import { applyAction, clearView, loadView, saveView } from './state';

export async function loadState() {
  try {
    const raw = await AsyncStorage.getItem(STORAGE_KEY);
    return raw ? { ...initialState(), ...JSON.parse(raw) } : initialState();
  } catch {
    return initialState();
  }
}

export async function widgetTaskHandler(props: WidgetTaskHandlerProps) {
  if (props.widgetInfo.widgetName !== 'AgendaWidget') return;
  const { widgetId } = props.widgetInfo;
  switch (props.widgetAction) {
    case 'WIDGET_DELETED':
      await clearView(widgetId);
      break;
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
    case 'WIDGET_CLICK': {
      let view = await loadView(widgetId);
      if (props.widgetAction === 'WIDGET_CLICK') {
        view = applyAction(view, props.clickAction); // 달력 ⇄ 오늘 일정 전환, 이전/다음 달
        await saveView(widgetId, view);
      }
      props.renderWidget(buildWidget(await loadState(), view, props.widgetInfo));
      break;
    }
    default:
      break;
  }
}
