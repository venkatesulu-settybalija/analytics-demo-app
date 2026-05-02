import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const root = path.join(path.dirname(fileURLToPath(import.meta.url)), "..");
const srcPublic = path.join(root, "public");
const destPublic = path.join(root, "dist", "public");

fs.mkdirSync(path.dirname(destPublic), { recursive: true });
fs.cpSync(srcPublic, destPublic, { recursive: true });
console.log("Copied public/ → dist/public/");
