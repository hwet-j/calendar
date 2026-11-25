export type Hex = `#${string}`;
export type Pal = Record<'bg' | 'item' | 'text' | 'sub' | 'primary' | 'soft' | 'sun' | 'sat', Hex>;
export type WidgetTheme = 'light' | 'dark' | 'black';
export const PALETTE: Record<WidgetTheme, Pal> = {
  light: { bg: '#FFFFFF', item: '#F4F5F9', text: '#14161F', sub: '#6B7080', primary: '#4F6BFF', soft: '#EAEEFF', sun: '#EF4444', sat: '#3B82F6' },
  dark: { bg: '#1A1C25', item: '#262936', text: '#F2F3F7', sub: '#9A9FB1', primary: '#7C92FF', soft: '#2B3158', sun: '#F87171', sat: '#60A5FA' },
  black: { bg: '#000000', item: '#151517', text: '#F5F5F7', sub: '#9A9FB1', primary: '#7C92FF', soft: '#1C2142', sun: '#F87171', sat: '#60A5FA' },
};

/**
 * 위젯 폭(dp)에 따른 헤더 배율. 기본 폭(330dp) 이하는 1배이고, 넓어질수록 "적당히" 커진다:
 * 폭이 늘어난 비율의 60%만 반영하고 최대 1.4배로 제한 (예: 폭 +60% → 약 1.36배, 년월 15pt → 20pt)
 */
export const widgetScale = (widthDp = 330) => Math.min(1.4, 1 + Math.max(0, widthDp / 330 - 1) * 0.6);
