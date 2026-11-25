import type { Occurrence } from './types';

/** 날짜 차이(일). DST와 무관하게 달력 날짜 기준 */
export const dayDiff = (a: Date, b: Date) =>
  Math.round((Date.UTC(b.getFullYear(), b.getMonth(), b.getDate()) - Date.UTC(a.getFullYear(), a.getMonth(), a.getDate())) / 86400000);

export interface Seg {
  occ: Occurrence;
  /** 주 안에서의 칸 번호 (0=일 ~ 6=토), 양 끝 포함 */
  startCol: number;
  endCol: number;
  /** 줄 번호 (0부터). 겹치지 않게 위에서부터 채움 */
  lane: number;
  /** 이전 주에서 이어져 옴 / 다음 주로 이어짐 (막대 모서리 모양과 이어짐 표시에 사용) */
  fromPrev: boolean;
  toNext: boolean;
}

/** 일정이 차지하는 마지막 날. 종일은 종료일 포함, 시간 일정이 자정 00:00 정각에 끝나면 전날까지 */
export function lastDay(o: Occurrence, allDay = o.event.allDay): Date {
  const e = o.end;
  if (!allDay && e > o.start && e.getHours() === 0 && e.getMinutes() === 0) return new Date(e.getFullYear(), e.getMonth(), e.getDate() - 1);
  return new Date(e.getFullYear(), e.getMonth(), e.getDate());
}

/**
 * 한 주(일~토)에 걸치는 일정을 구글 캘린더 월간 보기처럼 "막대"로 배치.
 * - 여러 날 일정은 하나의 막대로 이어지고, 주가 바뀌면 다음 주에서 이어서 그림
 * - 긴 일정/먼저 시작하는 일정이 위쪽 줄을 차지
 */
export function layoutWeek(occs: Occurrence[], weekStart: Date): Seg[] {
  const segs: Omit<Seg, 'lane'>[] = [];
  for (const o of occs) {
    const s = dayDiff(weekStart, o.start);
    const e = dayDiff(weekStart, lastDay(o));
    if (e < 0 || s > 6) continue;
    segs.push({ occ: o, startCol: Math.max(0, s), endCol: Math.min(6, Math.max(e, s)), fromPrev: s < 0, toNext: e > 6 });
  }
  segs.sort((a, b) =>
    a.startCol - b.startCol ||
    (b.endCol - b.startCol) - (a.endCol - a.startCol) ||
    Number(b.occ.event.allDay) - Number(a.occ.event.allDay) ||
    a.occ.start.getTime() - b.occ.start.getTime());
  const laneEnd: number[] = []; // 각 줄의 마지막으로 쓰인 칸
  return segs.map((sg) => {
    let lane = laneEnd.findIndex((end) => end < sg.startCol);
    if (lane < 0) lane = laneEnd.length;
    laneEnd[lane] = sg.endCol;
    return { ...sg, lane };
  });
}

/** 보여줄 줄 수를 넘어 가려진 일정 개수를 칸(요일)별로 계산 */
export function hiddenPerDay(segs: Seg[], maxLanes: number): number[] {
  const out = [0, 0, 0, 0, 0, 0, 0];
  for (const sg of segs) if (sg.lane >= maxLanes) for (let c = sg.startCol; c <= sg.endCol; c++) out[c]++;
  return out;
}

/** 배경색 위에서 읽히는 글자색 (밝은 노랑 등엔 어두운 글자) */
export function textColorOn(hex: string): string {
  const m = /^#?([0-9a-f]{6})$/i.exec(hex);
  if (!m) return '#FFFFFF';
  const n = parseInt(m[1], 16);
  const lin = (c: number) => { const v = c / 255; return v <= 0.03928 ? v / 12.92 : Math.pow((v + 0.055) / 1.055, 2.4); };
  const L = 0.2126 * lin((n >> 16) & 255) + 0.7152 * lin((n >> 8) & 255) + 0.0722 * lin(n & 255);
  return L > 0.4 ? '#14161F' : '#FFFFFF';
}
