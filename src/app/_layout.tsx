import * as Notifications from 'expo-notifications';
import { Stack, router } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { useTheme } from '../components/theme';
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
  const t = useTheme();
  return (
    <SafeAreaProvider>
      <StoreProvider>
        <Sync />
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
          <Stack.Screen name="profiles" options={{ title: '프로필' }} />
          <Stack.Screen name="settings" options={{ title: '설정' }} />
        </Stack>
      </StoreProvider>
    </SafeAreaProvider>
  );
}
