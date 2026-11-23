import * as DocumentPicker from 'expo-document-picker';
import * as FS from 'expo-file-system/legacy';
import * as Sharing from 'expo-sharing';
import { fromICS, toICS } from './ics';
import { uid } from './store';
import type { CalEvent } from './types';

/** .ics 파일로 내보내 카카오톡/메일/AirDrop 등 공유 시트로 전달 (구글·애플 캘린더에서 바로 열림) */
export async function shareEvents(events: CalEvent[], filename = 'calendar.ics') {
  const uri = `${FS.cacheDirectory}${filename}`;
  await FS.writeAsStringAsync(uri, toICS(events));
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, { mimeType: 'text/calendar', UTI: 'public.calendar-event', dialogTitle: '일정 공유' });
  }
}

export async function pickAndImport(profileId: string): Promise<CalEvent[]> {
  const r = await DocumentPicker.getDocumentAsync({ type: ['text/calendar', 'text/plain', '*/*'], copyToCacheDirectory: true });
  if (r.canceled || !r.assets?.[0]) return [];
  return fromICS(await FS.readAsStringAsync(r.assets[0].uri), profileId, uid);
}
