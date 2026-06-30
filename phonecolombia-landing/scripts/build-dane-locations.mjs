import fs from "fs";
import path from "path";
import { fileURLToPath } from "url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const csvPath = process.argv[2] || path.join(__dirname, "../src/data/ciudades.csv");
const outPath = path.join(__dirname, "../src/data/dane-locations.json");

const raw = fs.readFileSync(csvPath, "utf8");
const lines = raw.split(/\r?\n/).filter(Boolean);
const deptMap = new Map();

for (const line of lines) {
  if (!line.includes(";") || line.includes("Código Departamento")) continue;
  const parts = line.split(";").map((p) => p.replace(/^"|"$/g, "").trim());
  if (parts.length < 4) continue;
  const [deptCode, deptName, muniCode, muniName] = parts;
  if (!deptMap.has(deptCode)) {
    deptMap.set(deptCode, { code: deptCode, name: deptName, municipalities: [] });
  }
  const fullCode = deptCode.padStart(2, "0") + muniCode.padStart(3, "0");
  deptMap.get(deptCode).municipalities.push({
    code: fullCode,
    municipality_code: muniCode,
    name: muniName,
  });
}

const departments = [...deptMap.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
departments.forEach((d) => d.municipalities.sort((a, b) => a.name.localeCompare(b.name, "es")));

fs.mkdirSync(path.dirname(outPath), { recursive: true });
fs.writeFileSync(outPath, JSON.stringify({ departments }));

console.log(
  `Wrote ${outPath}: ${departments.length} departments, ${departments.reduce((s, d) => s + d.municipalities.length, 0)} municipalities`,
);
