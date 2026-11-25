import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { expand, fmtTime } from './dates';
import type { CalEvent } from './types';

const HORIZON_DAYS = 45;
const MAX_SCHEDULED = 60; // iOS는 앱당 예약 64개 제한

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true, shouldShowList: true, shouldPlaySound: true, shouldSetBadge: false,
  }),
});

export async function ensurePermission(): Promise<boolean> {
  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('reminders', {
      name: '일정 알림', importance: Notifications.AndroidImportance.HIGH,
    });
  }
  const cur = await Notifications.getPermissionsAsync();
  if (cur.granted) return true;
  return (await Notifications.requestPermissionsAsync()).granted;
}

/** 모든 예약을 지우고 앞으로 올 알림을 다시 예약 (반복 일정은 개별 발생으로 펼침) */
export async function rescheduleAll(events: CalEvent[], now = new Date()): Promise<number> {
  if (!(await ensurePermission())) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const to = new Date(now.getTime() + HORIZON_DAYS * 86400000);
  const upcoming = expand(events.filter((e) => e.reminderMinutes !== undefined), now, to)
    .map((o) => ({ o, at: new Date(o.start.getTime() - (o.event.reminderMinutes ?? 0) * 60000) }))
    .filter((x) => x.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
  for (const { o, at } of upcoming) {
    await Notifications.scheduleNotificationAsync({
      content: {
        title: o.event.title,
        body: o.event.allDay ? '종일 일정' : `${fmtTime(o.start)}${o.event.location ? ' · ' + o.event.location : ''}`,
        data: { eventId: o.event.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
    });
  }
  return upcoming.length;
}
