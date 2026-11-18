import { load, eq, done } from './harness.mjs';

let n = 0;
const ud = (p) => p + '_new' + (++n);

console.log('Import keeps vasoactive / sedation dilution (preset id remap)');
const t = load(['presetMerge', 'vsSame', 'nutSame', 'remapPresetIds'], { ud });
const local = [
  { id: 'vsp_B1', drug: 'Norepinephrine (Levophed)', amt: 8, amtu: 'mg', vol: 100, out: 'μg/kg/min' },
  { id: 'vsp_B2', drug: 'Fentanyl', amt: 500, amtu: 'μg', vol: 50, out: 'μg/hr' },
];
const incoming = [
  { id: 'vsp_A1', drug: 'Norepinephrine (Levophed)', amt: 8, amtu: 'mg', vol: 100, out: 'μg/kg/min' }, // same content, other device's id
  { id: 'vsp_B2', drug: 'Fentanyl', amt: 1000, amtu: 'μg', vol: 100, out: 'μg/hr' },                  // same id, different dilution
  { id: 'vsp_A3', drug: 'Dexmedetomidine', amt: 400, amtu: 'μg', vol: 100, out: 'μg/kg/hr' },          // new
];
const r = t.presetMerge(local, incoming, t.vsSame, 'vsp');
eq('same dilution → mapped to local id', r.map.vsp_A1, 'vsp_B1');
eq('id clash with other dilution → new id', r.map.vsp_B2, 'vsp_new1');
eq('new preset keeps its id', r.map.vsp_A3, undefined);
eq('library grows by 2', r.list.length, 4);
eq('local fentanyl untouched', r.list.find((x) => x.id === 'vsp_B2').amt, 500);
eq('imported fentanyl dilution kept', r.list.find((x) => x.id === 'vsp_new1').amt, 1000);

const pt = { days: { '2026-11-17': {
  hemo: { vasoactives: [{ drug: 'Norepinephrine', presetId: 'vsp_A1' }] },
  neuro: { infusions: [{ drug: 'Fentanyl', presetId: 'vsp_B2' }, { drug: 'Dex', presetId: 'vsp_A3' }] },
  nutr: { feedings: [{ en_preset_id: 'enp_x' }] },
} } };
t.remapPresetIds([pt], { vs: r.map, pn: {}, en: { enp_x: 'enp_std' } });
const d = pt.days['2026-11-17'];
eq('vasoactive presetId remapped', d.hemo.vasoactives[0].presetId, 'vsp_B1');
eq('infusion presetId remapped', d.neuro.infusions[0].presetId, 'vsp_new1');
eq('unmapped id unchanged', d.neuro.infusions[1].presetId, 'vsp_A3');
eq('EN preset remapped', d.nutr.feedings[0].en_preset_id, 'enp_std');
eq('re-import same file is a no-op', t.presetMerge(r.list, r.list, t.vsSame, 'vsp').added, 0);

console.log('MV settings carry forward');
const c = load(['respCarry']);
const snap = (time, values) => ({ time, values });
eq('MV: last support snapshot + later overlay, no SpO2', c.respCarry({ snapshots: [
  snap('08:00', { support_type: 'MV', mv_mode: 'AC-PC', peep: 8, fio2: 40, tv: 6.5, p_insp: 20, rr: 16, spo2: 95 }),
  snap('16:00', { fio2: 35, spo2: 97 }),
] }), { support_type: 'MV', fio2: 35, mv_mode: 'AC-PC', peep: 8, tv: 6.5, p_insp: 20, rr: 16 });
eq('extubated → HFNC only, MV values dropped', c.respCarry({ snapshots: [
  snap('08:00', { support_type: 'MV', mv_mode: 'PSV', peep: 5, fio2: 30 }),
  snap('14:00', { support_type: 'HFNC', fio2: 40 }),
] }), { support_type: 'HFNC', fio2: 40 });
eq('legacy day with monitor only', c.respCarry({ snapshots: [], monitor: { support_type: 'NIPPV', peep: 6, p_insp: 12, fio2: 50, rr: 22 } }), { support_type: 'NIPPV', fio2: 50, peep: 6, p_insp: 12 });
eq('no support recorded → nothing carried', c.respCarry({ snapshots: [snap('08:00', { spo2: 95 })] }), null);

console.log('Drainage / UF: shift entries excluded from 24h I/O');
const f = load(['drTotal', 'drShift', 'ufTotal', 'ufShift', 'ioDef24']);
const dr = { snapshots: [{ time: '08:00', output_ml: 300 }, { time: '16:00', output_ml: 150, is24h: false }] };
eq('drain 24h total excludes shift', f.drTotal(dr), 300);
eq('drain shift subtotal', f.drShift(dr), 150);
eq('legacy entries (no flag) still count', f.drTotal({ snapshots: [{ output_ml: 100 }, { output_ml: 50 }] }), 150);
const uf = { uf: { snapshots: [{ net_uf_ml: 1200 }, { net_uf_ml: 400, is24h: false }] } };
eq('UF 24h total excludes shift', f.ufTotal(uf), 1200);
eq('UF shift subtotal', f.ufShift(uf), 400);
eq('default follows latest I/O entry (shift)', f.ioDef24({ snapshots: [
  { time: '08:00', is24h: true, values: { intake_ml: 2000, uo_ml: 1500 } },
  { time: '16:00', is24h: false, values: { intake_ml: 700 } },
] }), false);
eq('default 24h when no I/O yet', f.ioDef24({ snapshots: [] }), true);

done();
