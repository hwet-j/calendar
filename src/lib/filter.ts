import type { AppState, CalEvent, Profile } from './types';

/** 현재 선택에 따라 보여줄 일정. activeProfileId=null → 보이도록 설정된 모든 프로필 */
export function visibleEvents(s: Pick<AppState, 'events' | 'profiles' | 'activeProfileId'>): CalEvent[] {
  if (s.activeProfileId) return s.events.filter((e) => e.profileId === s.activeProfileId);
  const ok = new Set(s.profiles.filter((p) => p.visible).map((p) => p.id));
  return s.events.filter((e) => ok.has(e.profileId));
}

export const profileOf = (profiles: Profile[], id: string) =>
  profiles.find((p) => p.id === id) ?? profiles[0];
