/**
 * Upscale hero slider PNGs to min width 1920px (Lanczos) so full-width heroes
 * are not as soft on desktop / retina. Re-run after replacing source art.
 * Usage: npm run assets:hero-hd
 */
import fs from "fs/promises";
import path from "path";
import { fileURLToPath } from "url";
import sharp from "sharp";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const TARGET_W = 1920;

const slideshowDir = path.join(__dirname, "../src/assets/hero-slideshow");
const vf6Hero = path.join(__dirname, "../src/assets/vf6-earth-hero-family.png");

async function upscaleFile(absPath) {
  const meta = await sharp(absPath).metadata();
  const w = meta.width ?? 0;
  if (w >= TARGET_W) {
    console.log(`skip ${path.basename(absPath)} (${w}px ≥ ${TARGET_W})`);
    return;
  }
  const tmp = `${absPath}.tmp.png`;
  await sharp(absPath)
    .resize({
      width: TARGET_W,
      kernel: sharp.kernel.lanczos3,
      fastShrinkOnLoad: false,
    })
    .png({ compressionLevel: 7, effort: 9 })
    .toFile(tmp);
  await fs.rename(tmp, absPath);
  console.log(`upscaled ${path.basename(absPath)} ${w}px → ${TARGET_W}px wide`);
}

async function main() {
  const entries = await fs.readdir(slideshowDir);
  for (const name of entries.filter((n) => n.toLowerCase().endsWith(".png"))) {
    await upscaleFile(path.join(slideshowDir, name));
  }
  await upscaleFile(vf6Hero);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
