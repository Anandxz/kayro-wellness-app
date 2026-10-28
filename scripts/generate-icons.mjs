import sharp from "sharp";
import { mkdir } from "node:fs/promises";
// Local vector source makes icons reproducible without remote assets.
const svg = Buffer.from(
  `<svg xmlns="http://www.w3.org/2000/svg" width="512" height="512" viewBox="0 0 512 512"><rect width="512" height="512" fill="#365644"/><path d="M350 137C198 111 132 191 165 288c36 103 211 78 185-151Z" fill="#dce5d8"/><path d="m166 365 140-175m-86 105-15-69m47 31 62 8" fill="none" stroke="#365644" stroke-width="12" stroke-linecap="round" stroke-linejoin="round"/></svg>`,
);
await mkdir("public/icons", { recursive: true });
for (const [name, size] of [
  ["icon-192", 192],
  ["icon-512", 512],
  ["icon-maskable-512", 512],
  ["apple-touch-icon", 180],
]) {
  await sharp(svg).resize(size, size).png().toFile(`public/icons/${name}.png`);
}
