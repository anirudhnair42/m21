/**
 * Resize the letter photos for the web. Run once:
 *   node scripts/prepare-letter-photos.mjs [source-root]
 *
 * The originals Ani supplied are 1-4 MB each straight off a camera. Shipping
 * them as-is would make the letter slow on exactly the phones most people will
 * open it on, so each is capped at 1600px on the long edge and re-encoded as
 * JPEG at quality 78.
 *
 * Uses macOS `sips` rather than sharp: this runs once, and sharp lives nested
 * in pnpm's store as a transitive dep of Next rather than at the top level.
 *
 * Order matters: the strip reads as an arc from daylight to dark, Foundation
 * Week to Friendsgiving, strangers to friends.
 */
import { execFileSync } from "node:child_process";
import { mkdirSync, statSync, copyFileSync } from "node:fs";
import { join } from "node:path";

/** Source → published name, in strip order. Paths are the originals as given. */
const PHOTOS = [
  ["YBxxV5/Jaime Fisac Robotics AI Researcher.jpg", "01-foundation-week.jpg"],
  ["l0Uekp/DSC 00190.jpg", "02-orientation-circles.jpg"],
  ["lexjDX/Photo DSC 1338.jpg", "03-friendsgiving-table.jpg"],
  ["ezWB1Q/Photo DSC 1449.jpg", "04-friendsgiving-plates.jpg"],
  ["I0vggd/Photo DSC 1333.jpg", "05-friendsgiving-mic.jpg"],
  ["Lkz8ik/Photo DSC 1495.jpg", "06-friendsgiving-group.jpg"],
];

const SRC_ROOT = process.argv[2] ?? ".context/attachments";
/**
 * NOT `public/letter` — that path collides with the /letter/[token] route and
 * every photo 404s, because the dynamic segment matches the filename first.
 */
const OUT_DIR = "public/assets/letter";
const MAX_EDGE = 1600;
/**
 * 65 rather than lower: half these frames are dim, candle-lit rooms, and
 * aggressive JPEG banding shows badly in dark gradients. These files are the
 * SOURCE — `next/image` re-encodes to WebP/AVIF at device size on delivery, so
 * a phone pulls well under 100 KB per photo regardless of what's committed.
 */
const QUALITY = 65;

mkdirSync(OUT_DIR, { recursive: true });

for (const [src, out] of PHOTOS) {
  const from = join(SRC_ROOT, src);
  const to = join(OUT_DIR, out);
  try {
    // sips edits in place, so copy first and resample the copy.
    copyFileSync(from, to);
    execFileSync("sips", [
      "-Z", String(MAX_EDGE),
      "--setProperty", "format", "jpeg",
      "--setProperty", "formatOptions", String(QUALITY),
      to,
    ], { stdio: "pipe" });
    const dims = execFileSync("sips", ["-g", "pixelWidth", "-g", "pixelHeight", to], {
      encoding: "utf8",
    });
    const w = dims.match(/pixelWidth:\s*(\d+)/)?.[1];
    const h = dims.match(/pixelHeight:\s*(\d+)/)?.[1];
    const kb = Math.round(statSync(to).size / 1024);
    console.log(`✓ ${out.padEnd(30)} ${w}×${h}  ${kb} KB`);
  } catch (err) {
    console.error(`✗ ${out} — ${err.message}`);
    process.exitCode = 1;
  }
}
