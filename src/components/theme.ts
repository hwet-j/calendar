import { useMemo } from 'react';
import { useColorScheme } from 'react-native';

const base = { primary: '#4F6BFF', danger: '#E5484D', sat: '#3B82F6', sun: '#EF4444' };

export const light = {
  ...base, dark: false,
  bg: '#F4F5F9', card: '#FFFFFF', text: '#14161F', sub: '#6B7080', faint: '#B4B8C5',
  line: '#ECEEF4', primarySoft: '#EAEEFF', input: '#F4F5F9',
  shadow: '0 2px 12px rgba(20, 22, 31, 0.06)', fabShadow: '0 6px 16px rgba(79, 107, 255, 0.45)',
};
export const dark: typeof light = {
  ...base, dark: true, primary: '#7C92FF',
  bg: '#0E0F14', card: '#1A1C25', text: '#F2F3F7', sub: '#9A9FB1', faint: '#5A5F70',
  line: '#272A36', primarySoft: '#252B4D', input: '#232634',
  shadow: '0 2px 12px rgba(0, 0, 0, 0.4)', fabShadow: '0 6px 16px rgba(124, 146, 255, 0.35)',
};
export type Theme = typeof light;

export function useTheme(): Theme {
  const scheme = useColorScheme();
  return useMemo(() => (scheme === 'dark' ? dark : light), [scheme]);
}

export const R = { sm: 10, md: 14, lg: 20, pill: 999 };

/** 일정 색상 선택지 (흰 글자가 잘 읽히는 중간 톤 위주, 노랑은 어두운 글자로 자동 전환) */
export const EVENT_COLORS = [
  '#4F7CFF', '#2E86C1', '#00ACC1', '#16A085', '#43A047', '#F9A825',
  '#E67E22', '#E5484D', '#D81B60', '#8E44AD', '#6D4C41', '#546E7A',
] as const;
