// Gera os ícones PNG do PWA a partir de public/icons/icon.svg.
//
// Este script é de uso exclusivo em tempo de desenvolvimento (npm run icons):
// usa o `sharp` (declarado em devDependencies) para rasterizar o SVG. Nenhum
// código de runtime (src/**) depende deste pacote nem deste script — os PNGs
// são commitados como assets estáticos.
//
// Uso: npm run icons

import { readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";
import sharp from "sharp";

const rootDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const iconsDir = path.join(rootDir, "public", "icons");
const sourcePath = path.join(iconsDir, "icon.svg");

const THEME_COLOR = { r: 22, g: 163, b: 74, alpha: 1 };
const SAFE_ZONE_RATIO = 0.1;

const svg = await readFile(sourcePath);

async function renderIcon(size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .png()
    .toBuffer();
}

async function renderMaskable(size) {
  const inset = Math.round(size * SAFE_ZONE_RATIO);
  const inner = size - inset * 2;
  const logo = await sharp(svg, { density: 384 })
    .resize(inner, inner, { fit: "contain" })
    .png()
    .toBuffer();

  return sharp({
    create: {
      width: size,
      height: size,
      channels: 4,
      background: THEME_COLOR,
    },
  })
    .composite([{ input: logo, top: inset, left: inset }])
    .png()
    .toBuffer();
}

async function renderAppleTouchIcon(size) {
  return sharp(svg, { density: 384 })
    .resize(size, size, { fit: "contain" })
    .flatten({ background: THEME_COLOR })
    .png()
    .toBuffer();
}

const outputs = [
  ["icon-192.png", await renderIcon(192)],
  ["icon-512.png", await renderIcon(512)],
  ["icon-192-maskable.png", await renderMaskable(192)],
  ["icon-512-maskable.png", await renderMaskable(512)],
  ["apple-touch-icon.png", await renderAppleTouchIcon(180)],
];

for (const [fileName, buffer] of outputs) {
  await writeFile(path.join(iconsDir, fileName), buffer);
  console.log(`gerado public/icons/${fileName} (${buffer.length} bytes)`);
}
