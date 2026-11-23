import AsyncStorage from '@react-native-async-storage/async-storage';
import React from 'react';
import type { WidgetTaskHandlerProps } from 'react-native-android-widget';
import { initialState, STORAGE_KEY } from '../lib/store';
import { AgendaWidget } from './AgendaWidget';

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
  switch (props.widgetAction) {
    case 'WIDGET_ADDED':
    case 'WIDGET_UPDATE':
    case 'WIDGET_RESIZED':
      props.renderWidget(<AgendaWidget state={await loadState()} />);
      break;
    default:
      break;
  }
}
