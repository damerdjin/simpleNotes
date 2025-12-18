// remarks.engine.js
// Moteur intelligent: croise écart (diff) + moyenne pour message hyper-personnalisé

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
  
  // Arrondir à 2 décimales pour éviter bug flottants
  const vv = Math.round(v * 100) / 100;

  for (let i = 0; i < bands.length; i++) {
    const b = bands[i];
    if (vv >= b.min && vv <= b.max) return i;
  }
  return -1;
}

/**
 * Calcule l'observation basée sur la différence Devoir - Composition
 * Contextualise le pattern pédagogique et psychologique
 */
export function computeObservationByDiff(devoir, comp, currentLanguage, seed = 0) {
  const lang = clampLang(currentLanguage);

  const d = Number(devoir);
  const c = Number(comp);
  
  // Si l'un est manquant, observation vide (données insuffisantes)
  if (!Number.isFinite(d) || !Number.isFinite(c)) return "";

  const diff = d - c;
  const idx = findBandIndex(REMARKS.diffBands, diff);
  if (idx < 0) return "";

  const candidates = REMARKS.observations?.[lang]?.[idx] ?? [];
  return pick(Array.isArray(candidates) ? candidates : [], seed);
}

/**
 * Calcule le conseil basé sur la moyenne
 * Messages précis et actionnables selon le niveau
 */
export function computeAdviceByAverage(avg, currentLanguage, seed = 0) {
  const lang = clampLang(currentLanguage);
  const idx = findBandIndex(REMARKS.avgBands, avg);
  if (idx < 0) return "";

  let candidates = REMARKS.advice?.[lang]?.[idx];

  // Tolérance: si string au lieu de array
  if (typeof candidates === "string") candidates = [candidates];

  // Fallback clés minuscules si besoin (au cas où)
  if (!candidates) {
    const altLang = (currentLanguage || "fr").toLowerCase();
    candidates = REMARKS.advice?.[altLang]?.[idx];
    if (typeof candidates === "string") candidates = [candidates];
  }

  return pick(Array.isArray(candidates) ? candidates : [], seed);
}

/**
 * Export principal: croise les 2 dimensions pour un message hyper-personnalisé
 * @param {number} devoir - Note du devoir (ex: 14)
 * @param {number} comp - Note de la composition (ex: 7)
 * @param {number} avg - Moyenne (ex: 10)
 * @param {string} currentLanguage - Langue UI (fr, en, ar)
 * @param {number|string} seed - ID étudiant pour variation déterministe
 * @returns {{obs: string, cons: string}} Observation + Conseil personnalisés
 */
export function computeExportRemarks({ devoir, comp, avg, currentLanguage, seed = 0 }) {
  return {
    obs: computeObservationByDiff(devoir, comp, currentLanguage, seed),
    cons: computeAdviceByAverage(avg, currentLanguage, seed + 1)
  };
}