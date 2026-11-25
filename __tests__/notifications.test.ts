/* eslint-disable @typescript-eslint/no-explicit-any */
jest.mock('expo-notifications', () => {
  const scheduled: any[] = [];
  return {
    __scheduled: scheduled,
    setNotificationHandler: jest.fn(),
    setNotificationChannelAsync: jest.fn(async () => {}),
    AndroidImportance: { HIGH: 4 },
    getPermissionsAsync: jest.fn(async () => ({ granted: true })),
    requestPermissionsAsync: jest.fn(async () => ({ granted: true })),
    cancelAllScheduledNotificationsAsync: jest.fn(async () => { scheduled.length = 0; }),
    scheduleNotificationAsync: jest.fn(async (req: any) => { await new Promise((r) => setTimeout(r, 5)); scheduled.push(req); return 'id'; }),
    SchedulableTriggerInputTypes: { DATE: 'date' },
  };
});

import * as N from 'expo-notifications';
import { rescheduleAll } from '../src/lib/notifications';
import type { CalEvent } from '../src/lib/types';

const scheduled = (N as any).__scheduled as any[];
const now = new Date(2026, 10, 25, 8, 0);
const ev = (id: string, title: string, o: Partial<CalEvent> = {}): CalEvent => ({
  id, profileId: 'a', title, start: new Date(2026, 10, 26, 12).toISOString(), end: new Date(2026, 10, 26, 13).toISOString(),
  allDay: false, repeat: 'none', attendees: [], updatedAt: now.toISOString(), reminderMinutes: 10, ...o,
});

beforeEach(() => { scheduled.length = 0; });

test('알림 없음으로 바꾼 일정은 예약되지 않음', async () => {
  await rescheduleAll([ev('1', '알림 있음'), ev('2', '알림 없음', { reminderMinutes: undefined })], now);
  expect(scheduled.map((s) => s.content.title)).toEqual(['알림 있음']);
});

test('연달아 호출돼도 마지막 상태만 남음 (지운 알림이 되살아나지 않음)', async () => {
  const before = [ev('1', '옛 알림 A'), ev('2', '옛 알림 B'), ev('3', '옛 알림 C')];
  const after = before.map((e) => ({ ...e, reminderMinutes: undefined })); // 사용자가 알림을 모두 없앰
  const p1 = rescheduleAll(before, now); // 이전 상태 예약이 진행되는 도중에
  const p2 = rescheduleAll(after, now);  // 새 상태가 들어옴
  await Promise.all([p1, p2]);
  expect(scheduled).toEqual([]);
});

test('종일 일정 알림은 해당 날 오전 9시 기준 (자정이 아님)', async () => {
  await rescheduleAll([ev('1', '종일', { allDay: true, start: new Date(2026, 10, 27).toISOString(), end: new Date(2026, 10, 27).toISOString(), reminderMinutes: 0 })], now);
  const at: Date = scheduled[0].trigger.date;
  expect([at.getMonth(), at.getDate(), at.getHours(), at.getMinutes()]).toEqual([10, 27, 9, 0]);
});
