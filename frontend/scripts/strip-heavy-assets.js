/**
 * On Vercel Hobby, the outfit combo PNG set (~700MB+) blows the deploy size limit.
 * Remove only that folder before `next build`. Local builds keep everything.
 */
const fs = require("fs");
const path = require("path");

if (!process.env.VERCEL) {
  process.exit(0);
}

const targets = [path.join("public", "outfits", "combos")];

for (const dir of targets) {
  if (!fs.existsSync(dir)) continue;
  fs.rmSync(dir, { recursive: true, force: true });
  console.log(`[vercel] removed ${dir} to fit deploy size limits`);
}
