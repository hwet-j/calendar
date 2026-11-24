import 'expo-router/entry';
import { Platform } from 'react-native';

// 홈 위젯 백그라운드 핸들러는 Android 전용
if (Platform.OS === 'android') {
  const { registerWidgetTaskHandler } = require('react-native-android-widget');
  const { widgetTaskHandler } = require('./src/widget/task-handler');
  registerWidgetTaskHandler(widgetTaskHandler);
}
