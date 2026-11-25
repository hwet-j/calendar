export type Repeat = 'none' | 'daily' | 'weekly' | 'monthly' | 'yearly';

/** 음력 날짜 (월/일/윤달 여부) */
export interface LunarDate { month: number; day: number; leap: boolean }

export interface Profile {
  id: string;
  name: string;
  color: string;
  /** 위젯/뷰에 표시할지 여부 (모든 프로필 보기 토글용) */
  visible: boolean;
}

export interface CalEvent {
  id: string;
  profileId: string;
  title: string;
  /** ISO 문자열 */
  start: string;
  end: string;
  allDay: boolean;
  location?: string;
  notes?: string;
  repeat: Repeat;
  /** 시작 몇 분 전에 알림 (undefined = 알림 없음) */
  reminderMinutes?: number;
  /** 공유 대상 이메일 (구글 캘린더 초대 / 공유 시 사용) */
  attendees: string[];
  /** 설정되면 음력 기준 일정. repeat='yearly'면 매년 같은 음력 날짜에 반복 (예: 음력 생일) */
  lunar?: LunarDate;
  googleId?: string;
  updatedAt: string;
}

export interface AppState {
  profiles: Profile[];
  events: CalEvent[];
  /** null = 모든 프로필 */
  activeProfileId: string | null;
  /** 달력 칸에 음력 날짜 표시 */
  showLunar?: boolean;
  google: { connected: boolean; email?: string; lastSync?: string };
}

export interface Occurrence {
  event: CalEvent;
  start: Date;
  end: Date;
}
