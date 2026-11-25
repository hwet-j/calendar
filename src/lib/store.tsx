import AsyncStorage from '@react-native-async-storage/async-storage';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import type { AppState, CalEvent, Profile } from './types';
import { visibleEvents } from './filter';

export const STORAGE_KEY = 'calendar-app/state/v1';
const KEY = STORAGE_KEY;
export const PALETTE = ['#4F7CFF', '#FF6B6B', '#2EC4B6', '#FFB347', '#9B5DE5', '#43AA8B', '#F15BB5', '#8D99AE'];
export const uid = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 8);

export const initialState = (): AppState => ({
  profiles: [{ id: 'me', name: '나', color: PALETTE[0], visible: true }],
  events: [],
  activeProfileId: null,
  google: { connected: false },
});

type Ctx = {
  state: AppState;
  ready: boolean;
  shown: CalEvent[];
  setActive(id: string | null): void;
  saveEvent(e: CalEvent): void;
  deleteEvent(id: string): void;
  importEvents(list: CalEvent[]): void;
  saveProfile(p: Profile): void;
  deleteProfile(id: string): void;
  setGoogle(g: AppState['google']): void;
  setShowLunar(v: boolean): void;
  replaceEvents(list: CalEvent[]): void;
};

const C = createContext<Ctx>(null as never);
export const useStore = () => useContext(C);

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = useState<AppState>(initialState);
  const [ready, setReady] = useState(false);
  const loaded = useRef(false);

  useEffect(() => {
    AsyncStorage.getItem(KEY)
      .then((raw) => { if (raw) setState({ ...initialState(), ...JSON.parse(raw) }); })
      .catch(() => {})
      .finally(() => { loaded.current = true; setReady(true); });
  }, []);

  useEffect(() => {
    if (loaded.current) AsyncStorage.setItem(KEY, JSON.stringify(state)).catch(() => {});
  }, [state]);

  const upd = useCallback((f: (s: AppState) => AppState) => setState(f), []);

  const value = useMemo<Ctx>(() => ({
    state, ready,
    shown: visibleEvents(state),
    setActive: (id) => upd((s) => ({ ...s, activeProfileId: id })),
    saveEvent: (e) => upd((s) => ({
      ...s,
      events: s.events.some((x) => x.id === e.id) ? s.events.map((x) => (x.id === e.id ? e : x)) : [...s.events, e],
    })),
    deleteEvent: (id) => upd((s) => ({ ...s, events: s.events.filter((e) => e.id !== id) })),
    importEvents: (list) => upd((s) => ({ ...s, events: [...s.events, ...list] })),
    replaceEvents: (list) => upd((s) => ({ ...s, events: list })),
    saveProfile: (p) => upd((s) => ({
      ...s,
      profiles: s.profiles.some((x) => x.id === p.id) ? s.profiles.map((x) => (x.id === p.id ? p : x)) : [...s.profiles, p],
    })),
    deleteProfile: (id) => upd((s) => {
      if (s.profiles.length <= 1) return s;
      const profiles = s.profiles.filter((p) => p.id !== id);
      return {
        ...s, profiles,
        events: s.events.filter((e) => e.profileId !== id),
        activeProfileId: s.activeProfileId === id ? null : s.activeProfileId,
      };
    }),
    setGoogle: (google) => upd((s) => ({ ...s, google })),
    setShowLunar: (showLunar) => upd((s) => ({ ...s, showLunar })),
  }), [state, ready, upd]);

  return <C.Provider value={value}>{children}</C.Provider>;
}
