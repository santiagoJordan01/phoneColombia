import daneData from "../data/dane-locations.json";

const { departments } = daneData;

const municipalityByCode = new Map();
const departmentByCode = new Map();

for (const dept of departments) {
  departmentByCode.set(dept.code, dept);
  for (const muni of dept.municipalities) {
    municipalityByCode.set(muni.code, { ...muni, department: dept });
  }
}

export function getDepartments() {
  return departments;
}

export function getDepartmentOptions() {
  return departments.map((d) => ({
    value: d.code,
    label: titleCase(d.name),
    sublabel: d.code,
  }));
}

export function getMunicipalitiesByDepartment(departmentCode) {
  if (!departmentCode) return [];
  const dept = departmentByCode.get(departmentCode);
  return dept?.municipalities ?? [];
}

export function getMunicipalityOptions(departmentCode) {
  return getMunicipalitiesByDepartment(departmentCode).map((m) => ({
    value: m.code,
    label: titleCase(m.name),
    sublabel: m.code,
  }));
}

export function findMunicipality(code) {
  return municipalityByCode.get(code) ?? null;
}

export function findDepartment(code) {
  return departmentByCode.get(code) ?? null;
}

export function municipalityLabel(code) {
  const muni = findMunicipality(code);
  return muni ? titleCase(muni.name) : "";
}

export function departmentLabel(code) {
  const dept = findDepartment(code);
  return dept ? titleCase(dept.name) : "";
}

export function formatDaneLocation({ departmentCode, municipalityCode, city } = {}) {
  const muni = municipalityCode ? findMunicipality(municipalityCode) : null;
  const name = muni ? titleCase(muni.name) : city ? titleCase(city) : "";
  if (!name) return "";
  if (municipalityCode) return `${name} (${municipalityCode})`;
  return name;
}

export function resolveLocationFromSupplier(supplier) {
  if (!supplier) {
    return { department_code: "", municipality_code: "", city: "" };
  }
  if (supplier.municipality_code) {
    const muni = findMunicipality(supplier.municipality_code);
    return {
      department_code: muni?.department?.code || supplier.department_code || "",
      municipality_code: supplier.municipality_code,
      city: muni ? titleCase(muni.name) : supplier.city || "",
    };
  }
  if (supplier.city) {
    const match = findMunicipalityByName(supplier.city);
    if (match) {
      return {
        department_code: match.department.code,
        municipality_code: match.code,
        city: titleCase(match.name),
      };
    }
  }
  return {
    department_code: supplier.department_code || "",
    municipality_code: "",
    city: supplier.city || "",
  };
}

export function findMunicipalityByName(name) {
  const q = normalizeName(name);
  if (!q) return null;
  for (const muni of municipalityByCode.values()) {
    if (normalizeName(muni.name) === q) return muni;
  }
  return null;
}

export function locationPayload({ department_code, municipality_code, city }) {
  const muni = municipality_code ? findMunicipality(municipality_code) : null;
  return {
    department_code: department_code || muni?.department?.code || null,
    municipality_code: municipality_code || null,
    city: muni ? titleCase(muni.name) : city?.trim() || null,
  };
}

function titleCase(value) {
  return String(value || "")
    .toLowerCase()
    .split(/\s+/)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

function normalizeName(value) {
  return String(value || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .trim()
    .toLowerCase();
}
