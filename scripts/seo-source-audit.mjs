import { readFile } from "node:fs/promises";

const files = [
  "app/page.tsx",
  "app/face-swap/page.tsx",
  "lib/content.ts",
  "lib/face-content.ts",
  "components/Studio.tsx",
  "components/FaceSwapStudio.tsx",
];
const retiredClaims = [
  /without signup/i,
  /no signup/i,
  /no account/i,
  /per IP/i,
  /per hour/i,
  /attempts per/i,
  /attempts\s*\/\s*hour/i,
];

const failures = [];
for (const file of files) {
  const source = await readFile(file, "utf8");
  for (const claim of retiredClaims) {
    if (claim.test(source)) failures.push(`${file}: retired claim ${claim}`);
  }
}

if (failures.length) {
  console.error(failures.join("\n"));
  process.exit(1);
}

console.log(`SEO source audit passed for ${files.length} files.`);
