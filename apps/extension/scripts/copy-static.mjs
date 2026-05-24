import { copyFile, mkdir } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const packageRoot = join(dirname(fileURLToPath(import.meta.url)), "..");
const distRoot = join(packageRoot, "dist");

await mkdir(distRoot, { recursive: true });

await Promise.all([
  copyFile(join(packageRoot, "manifest.json"), join(distRoot, "manifest.json")),
  copyFile(join(packageRoot, "popup.html"), join(distRoot, "popup.html")),
  copyFile(join(packageRoot, "popup.css"), join(distRoot, "popup.css"))
]);
