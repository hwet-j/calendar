import { Alert } from 'react-native';
import * as G from './google';
import { makeCopy, moveEvent } from './copy';
import { uid, useStore } from './store';
import type { CalEvent } from './types';

/**
 * 일정 복사·이동. 기기에 저장한 뒤, 구글이 연결돼 있으면 구글에도 올린다.
 * 구글 반영이 실패해도 기기에는 저장하고 pendingSync 로 표시 → 설정의 "지금 동기화"에서 다시 올림.
 */
export function useEventActions() {
  const { state, saveEvent } = useStore();

  const persist = async (list: CalEvent[]): Promise<number> => {
    let failed = 0;
    const token = state.google.connected ? await G.freshAccessToken() : null;
    for (const e of list) {
      let out = e;
      if (state.google.connected) {
        out = { ...out, pendingSync: true };
        if (token) {
          try {
            const r = await G.pushEvent(token, out);
            out = { ...out, googleId: r.id, pendingSync: r.problems.length > 0 };
            if (r.problems.length) failed++;
          } catch { failed++; }
        } else failed++;
      }
      saveEvent(out);
    }
    return failed;
  };

  const warn = (failed: number) => {
    if (failed > 0) Alert.alert('구글에 일부만 반영됐어요', `${failed}건은 기기에만 저장됐어요. 설정에서 "지금 동기화"를 누르면 다시 올려요.`);
  };

  return {
    /** base 를 days[] 각각만큼 옮긴 사본을 만든다. 만든 개수를 돌려준다 */
    copyOn: async (base: CalEvent, days: number[]): Promise<number> => {
      const now = new Date();
      const copies = days.map((d) => makeCopy(base, d, uid(), now));
      warn(await persist(copies));
      return copies.length;
    },
    move: async (e: CalEvent, days: number): Promise<void> => {
      warn(await persist([moveEvent(e, days)]));
    },
  };
}
