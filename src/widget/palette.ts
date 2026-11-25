export type Hex = `#${string}`;
export type Pal = Record<'bg' | 'item' | 'text' | 'sub' | 'primary' | 'soft' | 'sun' | 'sat', Hex>;
export const PALETTE: Record<'light' | 'dark', Pal> = {
  light: { bg: '#FFFFFF', item: '#F4F5F9', text: '#14161F', sub: '#6B7080', primary: '#4F6BFF', soft: '#EAEEFF', sun: '#EF4444', sat: '#3B82F6' },
  dark: { bg: '#1A1C25', item: '#262936', text: '#F2F3F7', sub: '#9A9FB1', primary: '#7C92FF', soft: '#2B3158', sun: '#F87171', sat: '#60A5FA' },
};
