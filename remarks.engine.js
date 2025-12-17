// remarks.engine.js
import { REMARKS } from "./remarks.messages.js";

function clampLang(currentLanguage) {
  if (currentLanguage === "fr") return "FR";
  if (currentLanguage === "en") return "EN";
  return "AR";
}

function toSeedInt(seed) {
  if (typeof seed === "number" && Number.isFinite(seed)) return Math.abs(Math.floor(seed));
  if (typeof seed === "string" && seed.length) {
    let h = 0;
    for (let i = 0; i < seed.length; i++) h = (h * 31 + seed.charCodeAt(i)) | 0;
    return Math.abs(h);
  }
  return 0;
}

function pick(list, seed = 0) {
  if (!Array.isArray(list) || list.length === 0) return "";
  const k = toSeedInt(seed) % list.length;
  return String(list[k] ?? "");
}


function findBandIndex(bands, value) {
  if (value === null || value === undefined) return -1;
  const v = Number(value);
  if (!Number.isFinite(v)) return -1;

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    if (v >= b.min && v <= b.max) return i;
  }
  return -1;
}

export function computeAdviceByAverage(avg, currentLanguage, seed = 0) {
  const lang = clampLang(currentLanguage);
  const idx = findBandIndex(REMARKS.avgBands, avg);
  if (idx < 0) return "";
  const candidates = REMARKS.advice?.[lang]?.[idx] ?? [];
  return pick(candidates, seed);
}

export function computeObservationByDiff(devoir, comp, currentLanguage, seed = 0) {
  const lang = clampLang(currentLanguage);

  const d = Number(devoir);
  const c = Number(comp);
  if (!Number.isFinite(d) || !Number.isFinite(c)) return "";

  const diff = d - c;
  const idx = findBandIndex(REMARKS.diffBands, diff);
  if (idx < 0) return "";

  const candidates = REMARKS.observation?.[lang]?.[idx] ?? [];
  return pick(candidates, seed);
}

export function computeExportRemarks({ devoir, comp, avg, currentLanguage, seed = 0 }) {
    return {
    obs: computeObservationByDiff(devoir, comp, currentLanguage, seed),
    cons: computeAdviceByAverage(avg, currentLanguage, seed + 1)
  };
}
