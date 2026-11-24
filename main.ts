// "The World in One Day — 24 November 2026"
// A newspaper front page drawn entirely in code.
// Node standard library only. No network, no clock, no randomness:
// the same input always produces the same PNG bytes.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import zlib from 'node:zlib';

// ---------------------------------------------------------------------------
// Page geometry
// ---------------------------------------------------------------------------
const PAGE_W = 1024;
const PAGE_H = 1024;
const MARGIN = 36;
const RIGHT = PAGE_W - MARGIN;

// ---------------------------------------------------------------------------
// Palette
// ---------------------------------------------------------------------------
const PAPER = [247, 240, 220];
const INK = [22, 19, 16];
const RED = [168, 32, 36];
const NAVY = [31, 60, 96];
const GREEN = [46, 112, 80];
const GOLD = [178, 140, 48];
const GREY = [112, 106, 94];
const WHITE = [255, 255, 255];

// ---------------------------------------------------------------------------
// Raster canvas: a plain RGB byte buffer with tiny drawing helpers.
// ---------------------------------------------------------------------------
const px = new Uint8Array(PAGE_W * PAGE_H * 3);

function fillAll(c) {
  for (let i = 0; i < PAGE_W * PAGE_H; i++) {
    px[i * 3] = c[0];
    px[i * 3 + 1] = c[1];
    px[i * 3 + 2] = c[2];
  }
}

function dot(x, y, c) {
  if (x < 0 || y < 0 || x >= PAGE_W || y >= PAGE_H) return;
  const i = (y * PAGE_W + x) * 3;
  px[i] = c[0];
  px[i + 1] = c[1];
  px[i + 2] = c[2];
}

function block(x, y, w, h, c) {
  for (let j = y; j < y + h; j++) {
    for (let i = x; i < x + w; i++) dot(i, j, c);
  }
}

function hline(x, y, w, c, thick = 1) {
  block(x, y, w, thick, c);
}

function vline(x, y, h, c, thick = 1) {
  block(x, y, thick, h, c);
}

function frame(x, y, w, h, c, thick = 2) {
  hline(x, y, w, c, thick);
  hline(x, y + h - thick, w, c, thick);
  vline(x, y, h, c, thick);
  vline(x + w - thick, y, h, c, thick);
}

// Bresenham line, for charts and clock hands.
function line(x0, y0, x1, y1, c) {
  const dx = Math.abs(x1 - x0);
  const dy = -Math.abs(y1 - y0);
  const sx = x0 < x1 ? 1 : -1;
  const sy = y0 < y1 ? 1 : -1;
  let err = dx + dy;
  let x = x0;
  let y = y0;
  for (;;) {
    dot(x, y, c);
    if (x === x1 && y === y1) break;
    const e2 = 2 * err;
    if (e2 >= dy) { err += dy; x += sx; }
    if (e2 <= dx) { err += dx; y += sy; }
  }
}

// Circle outline by stepping around the angle.
function ring(cx, cy, r, c) {
  for (let a = 0; a < 360; a += 2) {
    const t = (a * Math.PI) / 180;
    dot(Math.round(cx + r * Math.cos(t)), Math.round(cy + r * Math.sin(t)), c);
  }
}

function disc(cx, cy, r, c) {
  for (let j = -r; j <= r; j++) {
    for (let i = -r; i <= r; i++) {
      if (i * i + j * j <= r * r) dot(cx + i, cy + j, c);
    }
  }
}

// ---------------------------------------------------------------------------
// 5x7 bitmap font. Each glyph is seven rows of five bits, written as strings.
// My own table, drawn row by row.
// ---------------------------------------------------------------------------
const FONT = {
  A: ['01110', '10001', '10001', '11111', '10001', '10001', '10001'],
  B: ['11110', '10001', '10001', '11110', '10001', '10001', '11110'],
  C: ['01110', '10001', '10000', '10000', '10000', '10001', '01110'],
  D: ['11110', '10001', '10001', '10001', '10001', '10001', '11110'],
  E: ['11111', '10000', '10000', '11110', '10000', '10000', '11111'],
  F: ['11111', '10000', '10000', '11110', '10000', '10000', '10000'],
  G: ['01110', '10001', '10000', '10111', '10001', '10001', '01111'],
  H: ['10001', '10001', '10001', '11111', '10001', '10001', '10001'],
  I: ['01110', '00100', '00100', '00100', '00100', '00100', '01110'],
  J: ['00111', '00010', '00010', '00010', '00010', '10010', '01100'],
  K: ['10001', '10010', '10100', '11000', '10100', '10010', '10001'],
  L: ['10000', '10000', '10000', '10000', '10000', '10000', '11111'],
  M: ['10001', '11011', '10101', '10101', '10001', '10001', '10001'],
  N: ['10001', '11001', '10101', '10011', '10001', '10001', '10001'],
  O: ['01110', '10001', '10001', '10001', '10001', '10001', '01110'],
  P: ['11110', '10001', '10001', '11110', '10000', '10000', '10000'],
  Q: ['01110', '10001', '10001', '10001', '10101', '10010', '01101'],
  R: ['11110', '10001', '10001', '11110', '10100', '10010', '10001'],
  S: ['01111', '10000', '10000', '01110', '00001', '00001', '11110'],
  T: ['11111', '00100', '00100', '00100', '00100', '00100', '00100'],
  U: ['10001', '10001', '10001', '10001', '10001', '10001', '01110'],
  V: ['10001', '10001', '10001', '10001', '10001', '01010', '00100'],
  W: ['10001', '10001', '10001', '10101', '10101', '11011', '10001'],
  X: ['10001', '10001', '01010', '00100', '01010', '10001', '10001'],
  Y: ['10001', '10001', '01010', '00100', '00100', '00100', '00100'],
  Z: ['11111', '00001', '00010', '00100', '01000', '10000', '11111'],
  '0': ['01110', '10001', '10011', '10101', '11001', '10001', '01110'],
  '1': ['00100', '01100', '00100', '00100', '00100', '00100', '01110'],
  '2': ['01110', '10001', '00001', '00110', '01000', '10000', '11111'],
  '3': ['11111', '00010', '00100', '00010', '00001', '10001', '01110'],
  '4': ['00010', '00110', '01010', '10010', '11111', '00010', '00010'],
  '5': ['11111', '10000', '11110', '00001', '00001', '10001', '01110'],
  '6': ['00110', '01000', '10000', '11110', '10001', '10001', '01110'],
  '7': ['11111', '00001', '00010', '00100', '01000', '01000', '01000'],
  '8': ['01110', '10001', '10001', '01110', '10001', '10001', '01110'],
  '9': ['01110', '10001', '10001', '01111', '00001', '00010', '01100'],
  ' ': ['00000', '00000', '00000', '00000', '00000', '00000', '00000'],
  '.': ['00000', '00000', '00000', '00000', '00000', '01100', '01100'],
  ',': ['00000', '00000', '00000', '00000', '01100', '00100', '01000'],
  '-': ['00000', '00000', '00000', '01110', '00000', '00000', '00000'],
  ':': ['00000', '01100', '01100', '00000', '01100', '01100', '00000'],
  ';': ['00000', '01100', '01100', '00000', '01100', '00100', '01000'],
  '$': ['00100', '01111', '10100', '01110', '00101', '11110', '00100'],
  '%': ['11001', '11010', '00010', '00100', '01000', '01011', '10011'],
  '!': ['00100', '00100', '00100', '00100', '00100', '00000', '00100'],
  '?': ['01110', '10001', '00001', '00010', '00100', '00000', '00100'],
  "'": ['00100', '00100', '01000', '00000', '00000', '00000', '00000'],
  '(': ['00010', '00100', '01000', '01000', '01000', '00100', '00010'],
  ')': ['01000', '00100', '00010', '00010', '00010', '00100', '01000'],
  '/': ['00001', '00010', '00010', '00100', '01000', '01000', '10000'],
  '&': ['01100', '10010', '10100', '01000', '10101', '10010', '01101'],
  '+': ['00000', '00100', '00100', '01110', '00100', '00100', '00000'],
  '=': ['00000', '00000', '11111', '00000', '11111', '00000', '00000'],
  '#': ['01010', '01010', '11111', '01010', '11111', '01010', '01010'],
  '*': ['00000', '00100', '10101', '01110', '10101', '00100', '00000'],
};

const CHAR_W = 6; // 5 pixels of glyph + 1 pixel of spacing

function glyph(ch) {
  return FONT[ch] || FONT[' '];
}

function textWidth(text, scale) {
  return text.length * CHAR_W * scale;
}

function drawText(text, x, y, scale, color) {
  const upper = text.toUpperCase();
  let cx = x;
  for (const ch of upper) {
    const g = glyph(ch);
    for (let row = 0; row < 7; row++) {
      for (let col = 0; col < 5; col++) {
        if (g[row][col] === '1') {
          block(cx + col * scale, y + row * scale, scale, scale, color);
        }
      }
    }
    cx += CHAR_W * scale;
  }
}

function drawCentred(text, cx, y, scale, color) {
  drawText(text, cx - Math.floor(textWidth(text, scale) / 2), y, scale, color);
}

// Greedy word wrap: returns as many lines as needed to fit maxW.
function wrap(text, maxW, scale) {
  const words = text.split(' ');
  const lines = [];
  let cur = '';
  for (const w of words) {
    const trial = cur === '' ? w : cur + ' ' + w;
    if (textWidth(trial, scale) <= maxW) {
      cur = trial;
    } else {
      if (cur !== '') lines.push(cur);
      cur = w;
    }
  }
  if (cur !== '') lines.push(cur);
  return lines;
}

// ---------------------------------------------------------------------------
// Little illustrations, one per story. Each draws inside a small box.
// ---------------------------------------------------------------------------
function drawChessboard(x, y, cell) {
  const size = cell * 8;
  frame(x - 2, y - 2, size + 4, size + 4, INK, 2);
  for (let r = 0; r < 8; r++) {
    for (let c = 0; c < 8; c++) {
      if ((r + c) % 2 === 1) block(x + c * cell, y + r * cell, cell, cell, INK);
    }
  }
  // Two kings, one on each side, to give the board a game in progress.
  disc(x + 4 * cell + Math.floor(cell / 2), y + 7 * cell + Math.floor(cell / 2), 7, INK);
  disc(x + 4 * cell + Math.floor(cell / 2), y + Math.floor(cell / 2), 7, WHITE);
  ring(x + 4 * cell + Math.floor(cell / 2), y + Math.floor(cell / 2), 7, INK);
}

function drawRocket(x, y, w, h) {
  const cx = x + Math.floor(w / 2);
  // Flame
  block(cx - 4, y + h - 16, 8, 10, GOLD);
  block(cx - 2, y + h - 6, 4, 6, RED);
  // Body
  block(cx - 9, y + 14, 18, h - 34, INK);
  // Nose cone, stepped
  block(cx - 6, y + 8, 12, 6, RED);
  block(cx - 3, y + 2, 6, 6, RED);
  // Window
  block(cx - 3, y + 26, 6, 6, PAPER);
  // Fins
  block(cx - 16, y + h - 34, 7, 14, RED);
  block(cx + 9, y + h - 34, 7, 14, RED);
  // Speed dots
  dot(x + 4, y + 10, GREY);
  dot(x + w - 5, y + 22, GREY);
  dot(x + 8, y + h - 8, GREY);
}

function drawClock(x, y, w, h) {
  const cx = x + Math.floor(w / 2);
  const cy = y + Math.floor(h / 2);
  const r = Math.min(w, h) / 2 - 4;
  ring(cx, cy, r, INK);
  ring(cx, cy, r - 2, INK);
  // Tick marks at 12, 3, 6, 9
  block(cx - 1, cy - r + 3, 3, 6, INK);
  block(cx - 1, cy + r - 8, 3, 6, INK);
  block(cx - r + 3, cy - 1, 6, 3, INK);
  block(cx + r - 8, cy - 1, 6, 3, INK);
  // Hands at ten past ten
  line(cx, cy, cx - 12, cy - 10, INK);
  line(cx, cy, cx + 13, cy - 9, INK);
  disc(cx, cy, 3, RED);
}

function drawFallingChart(x, y, w, h) {
  const bx = x + 6;
  const by = y + h - 8;
  hline(bx, by, w - 12, INK, 2);
  vline(bx, y + 6, h - 14, INK, 2);
  const pts = [
    [0, 0], [14, 4], [26, 2], [38, 12], [50, 10], [62, 22], [74, 30], [86, 40],
  ];
  for (let i = 0; i < pts.length - 1; i++) {
    line(bx + 4 + pts[i][0], y + 10 + pts[i][1], bx + 4 + pts[i + 1][0], y + 10 + pts[i + 1][1], RED);
    line(bx + 4 + pts[i][0], y + 11 + pts[i][1], bx + 4 + pts[i + 1][0], y + 11 + pts[i + 1][1], RED);
  }
  // Final red arrowhead pointing down
  const ex = bx + 4 + pts[pts.length - 1][0];
  const ey = y + 10 + pts[pts.length - 1][1];
  block(ex - 5, ey - 1, 5, 2, RED);
  block(ex - 2, ey + 1, 2, 5, RED);
}

function drawBars(x, y, w, h) {
  const base = y + h - 8;
  const bw = 14;
  const gap = 8;
  const heights = [52, 40, 26, 14];
  const cols = [NAVY, RED, GREY, GOLD];
  for (let i = 0; i < 4; i++) {
    block(x + 6 + i * (bw + gap), base - heights[i], bw, heights[i], cols[i]);
  }
  hline(x + 2, base, w - 4, INK, 2);
}

function drawWaves(x, y, w, h) {
  // Three sine waves, one over the other.
  for (let row = 0; row < 3; row++) {
    const wy = y + 12 + row * 18;
    for (let i = 0; i < w - 8; i++) {
      const yy = wy + Math.round(4 * Math.sin((i / (w - 8)) * Math.PI * 2 + row));
      dot(x + 4 + i, yy, NAVY);
      dot(x + 4 + i, yy + 1, NAVY);
    }
  }
  // A small house roof peeking above the water line.
  block(x + Math.floor(w / 2) - 12, y + 2, 24, 4, GOLD);
  block(x + Math.floor(w / 2) - 8, y + 6, 16, 4, GOLD);
}

function drawLamp(x, y, w, h) {
  const cx = x + Math.floor(w / 2);
  // Flame
  block(cx - 3, y + 6, 6, 12, GOLD);
  block(cx - 1, y + 2, 3, 6, RED);
  // Wick
  block(cx - 1, y + 18, 2, 4, INK);
  // Bowl, widening rows
  block(cx - 8, y + 22, 16, 5, INK);
  block(cx - 16, y + 27, 32, 5, INK);
  block(cx - 22, y + 32, 44, 5, INK);
  block(cx - 26, y + 37, 52, 5, GOLD);
  // Base
  block(cx - 10, y + 42, 20, 4, INK);
  block(cx - 16, y + 46, 32, 4, INK);
  // Sparks
  dot(x + 8, y + 10, GOLD);
  dot(x + w - 9, y + 16, GOLD);
  dot(x + 14, y + 40, GOLD);
}

// ---------------------------------------------------------------------------
// Stories
// ---------------------------------------------------------------------------
const LEAD = {
  kicker: 'CHESS - GENEVA',
  kickerColor: RED,
  headline: 'GUKESH V SINDAROV: YOUNGEST TITLE MATCH BEGINS',
  standfirst:
    'DEFENDING CHAMPION GUKESH DOMMARAJU, 20, MEETS CHALLENGER JAVOKHIR SINDAROV, 20, ' +
    'IN GAME 1 IN GENEVA. FOURTEEN CLASSICAL GAMES, A $2.5M PRIZE FUND, AND THE YOUNGEST ' +
    'WORLD TITLE MATCH EVER PLAYED.',
};

const STORIES = [
  {
    num: '2',
    kicker: 'SPACE',
    color: NAVY,
    headline: 'ARIANE 6 TO FLY 36 AMAZON SATELLITES',
    standfirst:
      'ARIANE 6 LIFTS OFF FROM KOUROU WITH 36 AMAZON LEO SATELLITES, ' +
      'A DAY LATE AFTER A GROUND FAULT.',
    art: drawRocket,
  },
  {
    num: '3',
    kicker: 'FOOTBALL',
    color: GREEN,
    headline: 'CAS TO RULE ON SENEGAL AFCON APPEAL',
    standfirst:
      "SPORT'S TOP COURT RULES TODAY ON SENEGAL'S AFCON APPEAL, " +
      'AFTER MOROCCO TOOK THE TITLE DESPITE A 1-0 SENEGAL WIN.',
    art: drawClock,
  },
  {
    num: '4',
    kicker: 'MARKETS',
    color: RED,
    headline: 'ASX FALLS FOR AN EIGHTH STRAIGHT DAY',
    standfirst:
      'AUSTRALIAN SHARES FALL FOR AN EIGHTH STRAIGHT DAY AS THE GLOBAL ' +
      'AI SELL-OFF DEEPENS AND RECESSION FEARS GROW.',
    art: drawFallingChart,
  },
  {
    num: '5',
    kicker: 'POLITICS',
    color: NAVY,
    headline: 'ALBANESE APPROVAL HITS RECORD LOW',
    standfirst:
      "ANTHONY ALBANESE'S NET APPROVAL FALLS TO MINUS 31 IN THE LATEST " +
      'NEWSPOLL, THE WORST OF HIS TIME AS PRIME MINISTER.',
    art: drawBars,
  },
  {
    num: '6',
    kicker: 'WEATHER',
    color: NAVY,
    headline: 'CALIFORNIA BRACES FOR FLOODING',
    standfirst:
      'HIGH TIDES AND HEAVY RAIN THREATEN HISTORIC FLOODING ACROSS ' +
      'COASTAL CALIFORNIA AS MILLIONS TRAVEL FOR THANKSGIVING.',
    art: drawWaves,
  },
  {
    num: '7',
    kicker: 'FAITH',
    color: GOLD,
    headline: 'GURU NANAK JAYANTI MARKED IN INDIA',
    standfirst:
      'GURU NANAK JAYANTI IS MARKED ACROSS INDIA, CELEBRATING THE BIRTH ' +
      'OF GURU NANAK, FOUNDER OF SIKHISM.',
    art: drawLamp,
  },
];

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------
function drawPage() {
  fillAll(PAPER);

  // Top rule
  hline(MARGIN, 26, PAGE_W - 2 * MARGIN, RED, 5);

  // Masthead
  drawCentred('THE WORLD IN ONE DAY', PAGE_W / 2, 46, 6, INK);
  drawCentred('TUESDAY, 24 NOVEMBER 2026', PAGE_W / 2, 102, 3, RED);

  // Double rule under the dateline
  hline(MARGIN, 134, PAGE_W - 2 * MARGIN, INK, 3);
  hline(MARGIN, 140, PAGE_W - 2 * MARGIN, INK, 1);

  // ---- Lead story ---------------------------------------------------------
  block(MARGIN, 154, 26, 26, RED);
  drawCentred('1', MARGIN + 13, 160, 2, WHITE);
  drawText(LEAD.kicker, MARGIN + 34, 160, 2, LEAD.kickerColor);
  const leadHead = wrap(LEAD.headline, 720, 4);
  let y = 186;
  for (const ln of leadHead) {
    drawText(ln, MARGIN, y, 4, INK);
    y += 34;
  }
  y += 8;
  const leadBody = wrap(LEAD.standfirst, 720, 2);
  for (const ln of leadBody) {
    drawText(ln, MARGIN, y, 2, INK);
    y += 17;
  }

  // Chessboard on the right of the lead story
  drawChessboard(792, 168, 24);
  drawCentred('GAME 1 - 3PM CET', 792 + 96, 372, 2, GREY);

  // Divider under the lead
  hline(MARGIN, 402, PAGE_W - 2 * MARGIN, INK, 2);

  // ---- Grid of six stories -------------------------------------------------
  const colW = 464;
  const colX = [MARGIN, MARGIN + colW + 24];
  const rowY = [422, 602, 782];
  const rowH = 172;

  // Column divider and row separators
  vline(MARGIN + colW + 12, rowY[0], rowY[2] + rowH - rowY[0], GREY, 1);
  hline(MARGIN, rowY[1] - 6, PAGE_W - 2 * MARGIN, GREY, 1);
  hline(MARGIN, rowY[2] - 6, PAGE_W - 2 * MARGIN, GREY, 1);

  STORIES.forEach((s, i) => {
    const x = colX[i % 2];
    const ry = rowY[Math.floor(i / 2)];

    // Number badge + kicker
    block(x, ry, 26, 26, s.color);
    drawCentred(s.num, x + 13, ry + 6, 2, WHITE);
    drawText(s.kicker, x + 34, ry + 6, 2, s.color);

    // Headline, wrapped to the full column width
    const head = wrap(s.headline, colW, 3);
    let ty = ry + 36;
    for (const ln of head) {
      drawText(ln, x, ty, 3, INK);
      ty += 25;
    }

    // Standfirst, wrapped to leave room for the illustration
    ty += 6;
    const body = wrap(s.standfirst, colW - 118, 2);
    for (const ln of body) {
      drawText(ln, x, ty, 2, INK);
      ty += 14;
    }

    // Illustration at bottom right of the cell
    s.art(x + colW - 104, ry + 88, 104, 76);
  });

  // ---- Footer ---------------------------------------------------------------
  hline(MARGIN, 968, PAGE_W - 2 * MARGIN, INK, 2);
  drawCentred('THE WORLD IN ONE DAY - 24 NOVEMBER 2026 - 7 STORIES', PAGE_W / 2, 982, 2, GREY);
}

// ---------------------------------------------------------------------------
// PNG encoder: CRC32 table built at runtime, then IHDR / IDAT / IEND chunks.
// ---------------------------------------------------------------------------
const CRC_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let n = 0; n < 256; n++) {
    let c = n;
    for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1;
    table[n] = c >>> 0;
  }
  return table;
})();

function crc32(buf) {
  let c = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    c = CRC_TABLE[(c ^ buf[i]) & 0xff] ^ (c >>> 8);
  }
  return (c ^ 0xffffffff) >>> 0;
}

function chunk(type, data) {
  const len = Buffer.alloc(4);
  len.writeUInt32BE(data.length, 0);
  const typeBuf = Buffer.from(type, 'ascii');
  const crc = Buffer.alloc(4);
  crc.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])), 0);
  return Buffer.concat([len, typeBuf, data, crc]);
}

function encodePng() {
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(PAGE_W, 0);
  ihdr.writeUInt32BE(PAGE_H, 4);
  ihdr[8] = 8; // bit depth
  ihdr[9] = 2; // colour type: RGB
  ihdr[10] = 0; // compression
  ihdr[11] = 0; // filter
  ihdr[12] = 0; // interlace

  const stride = PAGE_W * 3;
  const raw = Buffer.alloc((stride + 1) * PAGE_H);
  for (let row = 0; row < PAGE_H; row++) {
    raw[row * (stride + 1)] = 0; // filter: none
    Buffer.from(px.buffer, row * stride, stride).copy(raw, row * (stride + 1) + 1);
  }
  const idat = zlib.deflateSync(raw, { level: 9 });

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk('IHDR', ihdr),
    chunk('IDAT', idat),
    chunk('IEND', Buffer.alloc(0)),
  ]);
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
const here = path.dirname(fileURLToPath(import.meta.url));
const outDir = process.env.MAKEFUN_OUTPUT_DIR || here;
const outPath = path.join(outDir, 'entry.png');

drawPage();
const png = encodePng();
fs.mkdirSync(outDir, { recursive: true });
fs.writeFileSync(outPath, png);
console.log('wrote ' + outPath + ' (' + png.length + ' bytes)');
