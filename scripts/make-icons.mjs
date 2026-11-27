// 앱 아이콘 PNG 생성: node scripts/make-icons.mjs  (필요: playwright — npm i --no-save playwright)
// 디자인을 바꾸려면 아래 SVG 만 고치고 다시 실행한 뒤, 생성된 assets/*.png 를 커밋한다.
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const { chromium } = createRequire(import.meta.url)('playwright');
const OUT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../assets');

const GRAD = ['#5B8CFF', '#3B5BDB']; // 앱 기본색(#4F7CFF) 계열 블루
const HEADER = '#3B5BDB';
// 앱의 일정 막대 색(PALETTE)과 같은 색
const BARS = [
  { x: 290, y: 450, w: 250, c: '#FF6B6B' },
  { x: 290, y: 534, w: 444, c: '#2EC4B6' },
  { x: 370, y: 618, w: 364, c: '#FFB347' },
  { x: 290, y: 702, w: 190, c: '#9B5DE5' },
];
const CARD = { x: 222, y: 262, w: 580, h: 540, r: 96 };
const HEAD_H = 150;
const RINGS = [352, 626];

const defs = `<defs>
  <linearGradient id="bg" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="${GRAD[0]}"/><stop offset="1" stop-color="${GRAD[1]}"/></linearGradient>
  <clipPath id="card"><rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="${CARD.r}"/></clipPath>
</defs>`;

const bar = (b) => `<rect x="${b.x}" y="${b.y}" width="${b.w}" height="52" rx="26"`;
const rings = (fill) => RINGS.map((x) => `<rect x="${x}" y="214" width="46" height="124" rx="23" fill="${fill}"/>`).join('');

/** 흰 달력 카드 + 파란 머리띠 + 고리 + 색 막대 */
const glyph = ({ header = HEADER } = {}) => `<g transform="translate(0 4)">
  <rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="${CARD.r}" fill="#fff"/>
  <g clip-path="url(#card)"><rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${HEAD_H}" fill="${header}"/></g>
  ${rings('#fff')}
  ${BARS.map((b) => `${bar(b)} fill="${b.c}"/>`).join('')}
</g>`;

/** 단색(Android 테마 아이콘·알림): 카드는 채우고 막대와 머리띠 경계선을 뚫는다 */
const glyphMono = (color) => `<g transform="translate(0 4)"><mask id="m"><rect width="1024" height="1024" fill="#fff"/>
  ${BARS.map((b) => `${bar(b)} fill="#000"/>`).join('')}
  <rect x="${CARD.x}" y="${CARD.y + HEAD_H}" width="${CARD.w}" height="14" fill="#000"/></mask>
  <g mask="url(#m)"><rect x="${CARD.x}" y="${CARD.y}" width="${CARD.w}" height="${CARD.h}" rx="${CARD.r}" fill="${color}"/>${rings(color)}</g></g>`;

const svg = (size, inner) => `<svg xmlns="http://www.w3.org/2000/svg" width="${size}" height="${size}" viewBox="0 0 1024 1024">${defs}${inner}</svg>`;
const bgRect = '<rect width="1024" height="1024" fill="url(#bg)"/>';

const files = {
  'icon.png': { size: 1024, svg: svg(1024, bgRect + glyph()), opaque: true },
  'android-icon-background.png': { size: 1024, svg: svg(1024, bgRect), opaque: true },
  'android-icon-foreground.png': { size: 1024, svg: svg(1024, glyph()) },
  'android-icon-monochrome.png': { size: 1024, svg: svg(1024, glyphMono('#000')) },
  'splash-icon.png': { size: 512, svg: svg(512, glyph()) },
  'favicon.png': { size: 48, svg: svg(48, bgRect + glyph()), opaque: true },
  'notification-icon.png': { size: 96, svg: svg(96, glyphMono('#fff')) },
};

const browser = await chromium.launch();
const page = await browser.newPage();
for (const [name, f] of Object.entries(files)) {
  await page.setViewportSize({ width: f.size, height: f.size });
  await page.setContent(`<html><body style="margin:0;background:transparent">${f.svg}</body></html>`);
  const buf = await page.screenshot({ omitBackground: !f.opaque, clip: { x: 0, y: 0, width: f.size, height: f.size } });
  fs.writeFileSync(path.join(OUT, name), buf);
  console.log('wrote', name, f.size);
}
await browser.close();
