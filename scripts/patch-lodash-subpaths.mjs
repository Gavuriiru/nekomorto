import fs from "node:fs";
import path from "node:path";

const projectRoot = path.resolve(import.meta.dirname, "..");
const lodashRoot = path.join(projectRoot, "node_modules", "lodash");
const shims = [
  {
    fileName: "isEqualWith",
    target: "./isEqualWith.js",
  },
];

if (!fs.existsSync(lodashRoot)) {
  process.exit(0);
}

for (const { fileName, target } of shims) {
  const shimPath = path.join(lodashRoot, fileName);
  if (fs.existsSync(shimPath)) {
    continue;
  }

  fs.writeFileSync(
    shimPath,
    `module.exports = require(${JSON.stringify(target)});\n`,
  );
}
