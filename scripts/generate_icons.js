import fs from 'fs';
import path from 'path';
import zlib from 'zlib';

function createCRC32Table() {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i++) {
    let c = i;
    for (let k = 0; k < 8; k++) {
      c = (c & 1) ? (0xedb88320 ^ (c >>> 1)) : (c >>> 1);
    }
    table[i] = c >>> 0;
  }
  return table;
}

const crcTable = createCRC32Table();

function crc32(buf) {
  let crc = 0xffffffff;
  for (let i = 0; i < buf.length; i++) {
    crc = crcTable[(crc ^ buf[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function createChunk(type, data) {
  const len = data.length;
  const chunk = Buffer.alloc(12 + len);
  chunk.writeUInt32BE(len, 0);
  chunk.write(type, 4, 4, 'ascii');
  data.copy(chunk, 8);
  const typeAndData = chunk.subarray(4, 8 + len);
  chunk.writeUInt32BE(crc32(typeAndData), 8 + len);
  return chunk;
}

function generatePng(width, height, isMaskable = false) {
  const signature = Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]);

  // IHDR: width, height, bit depth 8, color type 6 (RGBA), compression 0, filter 0, interlace 0
  const ihdrData = Buffer.alloc(13);
  ihdrData.writeUInt32BE(width, 0);
  ihdrData.writeUInt32BE(height, 4);
  ihdrData[8] = 8;
  ihdrData[9] = 6; // RGBA
  ihdrData[10] = 0;
  ihdrData[11] = 0;
  ihdrData[12] = 0;
  const ihdrChunk = createChunk('IHDR', ihdrData);

  // Generate image scanlines (RGBA)
  const rowBytes = width * 4;
  const rawData = Buffer.alloc((1 + rowBytes) * height);
  const cx = width / 2;
  const cy = height / 2;
  const radius = width * (isMaskable ? 0.38 : 0.44);

  let offset = 0;
  for (let y = 0; y < height; y++) {
    rawData[offset++] = 0; // Filter type 0 (None)
    for (let x = 0; x < width; x++) {
      const dx = x - cx;
      const dy = y - cy;
      const dist = Math.sqrt(dx * dx + dy * dy);

      // Distance inside water droplet / circle
      const isInside = dist <= radius;
      const gradY = y / height;

      if (isInside) {
        // Cyan-to-blue gradient
        const r = Math.round(2 + gradY * 30);
        const g = Math.round(132 + (1 - gradY) * 50);
        const b = Math.round(199 + (1 - gradY) * 40);
        const a = 255;

        // Droplet center highlight
        const dropDist = Math.sqrt(dx * dx + (dy + radius * 0.15) * (dy + radius * 0.15));
        if (dropDist < radius * 0.35) {
          rawData[offset++] = Math.min(255, r + 40);
          rawData[offset++] = Math.min(255, g + 60);
          rawData[offset++] = Math.min(255, b + 30);
          rawData[offset++] = a;
        } else {
          rawData[offset++] = r;
          rawData[offset++] = g;
          rawData[offset++] = b;
          rawData[offset++] = a;
        }
      } else {
        if (isMaskable) {
          // Fill background for maskable
          rawData[offset++] = 15;
          rawData[offset++] = 23;
          rawData[offset++] = 42;
          rawData[offset++] = 255;
        } else {
          // Transparent
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 0;
          rawData[offset++] = 0;
        }
      }
    }
  }

  const deflated = zlib.deflateSync(rawData);
  const idatChunk = createChunk('IDAT', deflated);
  const iendChunk = createChunk('IEND', Buffer.alloc(0));

  return Buffer.concat([signature, ihdrChunk, idatChunk, iendChunk]);
}

const outDir = path.resolve('public');
if (!fs.existsSync(outDir)) {
  fs.mkdirSync(outDir, { recursive: true });
}

fs.writeFileSync(path.join(outDir, 'pwa-192x192.png'), generatePng(192, 192, false));
fs.writeFileSync(path.join(outDir, 'pwa-512x512.png'), generatePng(512, 512, false));
fs.writeFileSync(path.join(outDir, 'pwa-maskable-512x512.png'), generatePng(512, 512, true));
fs.writeFileSync(path.join(outDir, 'apple-touch-icon.png'), generatePng(180, 180, true));

console.log('Successfully generated PWA icons in /public: 192x192, 512x512, maskable, apple-touch-icon');
