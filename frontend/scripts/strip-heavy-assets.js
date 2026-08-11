/**
 * On Vercel Hobby, the outfit combo PNG set (~700MB+) blows the deploy size limit.
 * Remove them before `next build` so the site can ship; local `npm run build` keeps them.
 */
const fs = require("fs");
const path = require("path");

if (!process.env.VERCEL) {
  process.exit(0);
}

const targets = [
  path.join("public", "outfits", "combos"),
  path.join("public", "overlays", "aligned-combo"),
  path.join("public", "overlays", "aligned"),
  path.join("public", "overlays", "fitted"),
];

for (const dir of targets) {
  if (!fs.existsSync(dir)) continue;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`[vercel] removed ${dir} to fit deploy size limits`);
}
