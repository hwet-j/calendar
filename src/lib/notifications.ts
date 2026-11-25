import * as Notifications from 'expo-notifications';
import { Platform } from 'react-native';
import { expand, fmtTime } from './dates';
import type { CalEvent, Occurrence } from './types';

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

const ALLDAY_HOUR = 9; // 종일 일정 알림의 기준 시각 (자정에 울리지 않도록 오전 9시)

/** 알림 기준 시각: 시간 일정은 시작 시각, 종일 일정은 그 날 오전 9시 */
const baseTime = (o: Occurrence) =>
  o.event.allDay ? new Date(o.start.getFullYear(), o.start.getMonth(), o.start.getDate(), ALLDAY_HOUR) : o.start;

let latest = 0; // 가장 최근 요청 번호
let chain: Promise<unknown> = Promise.resolve();

/**
 * 모든 예약을 지우고 앞으로 올 알림을 다시 예약 (반복 일정은 개별 발생으로 펼침).
 * 호출이 겹쳐도 한 번에 하나씩만 실행하고, 더 새로운 요청이 들어오면 이전 요청은 중간에 멈춘다
 * (그렇지 않으면 이전 상태의 알림이 뒤늦게 예약돼 "지운 알림이 울리는" 문제가 생긴다).
 */
export function rescheduleAll(events: CalEvent[], now = new Date()): Promise<number> {
  const mine = ++latest;
  const run = chain.then(() => doReschedule(events, now, () => mine !== latest));
  chain = run.catch(() => 0);
  return run;
}

async function doReschedule(events: CalEvent[], now: Date, superseded: () => boolean): Promise<number> {
  if (superseded()) return 0;
  if (!(await ensurePermission())) return 0;
  if (superseded()) return 0;
  await Notifications.cancelAllScheduledNotificationsAsync();
  const to = new Date(now.getTime() + HORIZON_DAYS * 86400000);
  const upcoming = expand(events.filter((e) => e.reminderMinutes !== undefined), now, to)
    .map((o) => ({ o, at: new Date(baseTime(o).getTime() - (o.event.reminderMinutes ?? 0) * 60000) }))
    .filter((x) => x.at > now)
    .sort((a, b) => a.at.getTime() - b.at.getTime())
    .slice(0, MAX_SCHEDULED);
  let n = 0;
  for (const { o, at } of upcoming) {
    if (superseded()) break; // 더 새로운 요청이 이어서 처리함
    await Notifications.scheduleNotificationAsync({
      content: {
        title: o.event.title,
        body: o.event.allDay ? '종일 일정' : `${fmtTime(o.start)}${o.event.location ? ' · ' + o.event.location : ''}`,
        data: { eventId: o.event.id },
      },
      trigger: { type: Notifications.SchedulableTriggerInputTypes.DATE, date: at, channelId: 'reminders' },
    });
    n++;
  }
  return n;
}
