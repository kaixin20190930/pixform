import { readdir, readFile } from "node:fs/promises";
import { extname, join } from "node:path";

const roots = ["app", "lib", "components", "content"];
const extensions = new Set([".js", ".jsx", ".json", ".md", ".mdx", ".ts", ".tsx"]);
const retiredClaims = [
  /without signup/i,
  /no signup/i,
  /no account/i,
  /without an account/i,
  /free to try/i,
  /per IP/i,
  /per hour/i,
  /attempts per/i,
  /attempts\s*\/\s*hour/i,
];

async function sourceFiles(directory) {
  let entries;
  try { entries = await readdir(directory, { withFileTypes: true }); }
  catch (error) {
    if (error?.code === "ENOENT") return [];
    throw error;
  }
  const files = [];
  for (const entry of entries) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) files.push(...await sourceFiles(path));
    else if (entry.isFile() && extensions.has(extname(entry.name))) files.push(path);
  }
  return files;
}

const files = (await Promise.all(roots.map(sourceFiles))).flat();
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
