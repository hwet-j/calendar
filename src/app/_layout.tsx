import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { AppState, Appearance } from 'react-native';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../components/theme';
import { buildSnapshot } from '../lib/assistantQuery';
import { writeAssistantSnapshot } from '../lib/assistantShare';
import { rescheduleAll } from '../lib/notifications';
import { StoreProvider, useStore } from '../lib/store';
import { refreshWidgets } from '../widget/refresh';

function Sync() {
  const { state, ready } = useStore();
  // 일정/프로필이 바뀔 때마다 알림 재예약 + 홈 위젯 갱신
  useEffect(() => {
    if (!ready) return;
    rescheduleAll(state.events).catch(() => {});
    refreshWidgets(state);
  }, [state, ready]);

  // AI 비서가 앱을 열지 않고 읽을 수 있게, 일정이 바뀔 때(1초 모아서)와 앱이 앞으로 올 때 읽기 전용 스냅샷을 다시 쓴다
  useEffect(() => {
    if (!ready) return;
    const write = () => {
      try {
        writeAssistantSnapshot(JSON.stringify(buildSnapshot(state)));
      } catch {
        /* 스냅샷 실패가 앱 동작을 막으면 안 된다 */
      }
    };
    const timer = setTimeout(write, 1000);
    const sub = AppState.addEventListener('change', (st) => { if (st === 'active') write(); });
    return () => { clearTimeout(timer); sub.remove(); };
  }, [state, ready]);

  // 앱 테마를 고정하면 네이티브 구성요소(스위치·날짜 선택창·키보드)도 같은 테마로 맞춤. 시스템이면 해제
  const theme = state.theme;
  useEffect(() => {
    try {
      // 웹 등 일부 환경에는 없을 수 있어 방어적으로 호출
      if (typeof Appearance.setColorScheme === 'function') {
        Appearance.setColorScheme(theme === 'light' ? 'light' : theme === 'dark' || theme === 'black' ? 'dark' : 'unspecified');
      }
    } catch {
      /* 테마 색 자체는 팔레트로 적용되므로 무시 */
    }
  }, [theme]);

  // 알림을 탭하면 해당 일정으로 이동
  useEffect(() => {
    const sub = Notifications.addNotificationResponseReceivedListener((r) => {
      const id = r.notification.request.content.data?.eventId;
      if (typeof id === 'string') router.push(`/event/${id}`);
    });
    return () => sub.remove();
  }, []);
  return null;
}

export default function Root() {
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Sync />
        <Shell />
      </StoreProvider>
    </SafeAreaProvider>
  );
}

/** 테마는 저장소(StoreProvider) 안에서 읽어야 하므로 화면 골격을 별도 컴포넌트로 분리 */
function Shell() {
  const t = useTheme();
  return (
    <>
      <StatusBar style={t.dark ? 'light' : 'dark'} />
      <Stack
        screenOptions={{
          headerStyle: { backgroundColor: t.bg },
          headerTintColor: t.text,
          headerShadowVisible: false,
          headerTitleStyle: { fontWeight: '700' },
          contentStyle: { backgroundColor: t.bg },
        }}
      >
        <Stack.Screen name="index" options={{ headerShown: false }} />
        <Stack.Screen name="event/[id]" options={{ title: '일정', presentation: 'modal' }} />
        <Stack.Screen name="assistant" options={{ headerShown: false, animation: 'none' }} />
        <Stack.Screen name="copy/[id]" options={{ title: '일정 복사' }} />
        <Stack.Screen name="profiles" options={{ title: '프로필' }} />
        <Stack.Screen name="settings" options={{ title: '설정' }} />
      </Stack>
    </>
  );
}
