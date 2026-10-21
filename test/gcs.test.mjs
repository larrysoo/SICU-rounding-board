import { load, eq, done } from './harness.mjs';

const g = load(['gcsTotal']);
const t = (m) => g.gcsTotal(m).txt;

console.log('GCS-T (intubated / tracheostomy: verbal not scored)');
eq('E1 VT M1 = 2T (issue: was 3T)', t({ gcs_e: 1, gcs_v: 1, gcs_v_t: true, gcs_m: 1 }), '2T');
eq('E4 VT M6 = 10T (max)', t({ gcs_e: 4, gcs_v: 1, gcs_v_t: true, gcs_m: 6 }), '10T');
eq('E2 VT M5 = 7T', t({ gcs_e: 2, gcs_v_t: true, gcs_m: 5 }), '7T');
eq('stored V is ignored when T', t({ gcs_e: 3, gcs_v: 4, gcs_v_t: true, gcs_m: 5 }), '8T');
console.log('GCS (not intubated)');
eq('E4 V5 M6 = 15', t({ gcs_e: 4, gcs_v: 5, gcs_m: 6 }), '15');
eq('E1 V1 M1 = 3', t({ gcs_e: 1, gcs_v: 1, gcs_v_t: false, gcs_m: 1 }), '3');
console.log('Incomplete');
eq('missing V (not intubated) → —', t({ gcs_e: 4, gcs_m: 6 }), '—');
eq('missing M → —', t({ gcs_e: 1, gcs_v_t: true }), '—');
eq('empty → —', t(undefined), '—');

const s = load(['sofaBrain']);
console.log('SOFA-2 brain unchanged (numeric convention V=1 when intubated)');
eq('E1 VT M1 → GCS 3 → 4 points', s.sofaBrain({ neuro: { monitor: { gcs_e: 1, gcs_v: 1, gcs_v_t: true, gcs_m: 1 } } }).score, 4);

done();
