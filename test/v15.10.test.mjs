import { load, eq, done } from './harness.mjs';

console.log('Whole blood');
const t = load(['BLOOD_PRODUCTS', 'TXF_VOL', 'MASSIVE_PRBC', 'txfTotals', 'txfVol', 'txfPRBC', 'autoMassive', 'txfLine']);
const day = (...tx) => ({ heme: { transfusions: tx.map(([product, units]) => ({ product, units })) } });
eq('WB in product list', t.BLOOD_PRODUCTS.some((b) => b.v === 'WB'), true);
eq('WB 2u = 500 mL', t.txfVol(day(['WB', 2])), 500);
eq('PRBC 6 + WB 4 → massive', t.autoMassive(day(['PRBC', 6], ['WB', 4])), true);
eq('PRBC 6 + WB 3 → not massive', t.autoMassive(day(['PRBC', 6], ['WB', 3])), false);
eq('FFP not counted toward MTP', t.autoMassive(day(['PRBC', 9], ['FFP', 6])), false);
eq('txfLine shows WB', t.txfLine(day(['PRBC', 1], ['WB', 2])), 'PRBC 1u · WB 2u');

console.log('Fibrinogen');
const f = load(['fibSev']);
eq('120 → danger', f.fibSev(120), 'danger');
eq('149 → danger', f.fibSev(149), 'danger');
eq('150 → warning', f.fibSev(150), 'warning');
eq('250 → success', f.fibSev(250), 'success');
eq('450 → warning', f.fibSev(450), 'warning');
eq('null → none', f.fibSev(null), '');

console.log('FiO2 linked from Resp');
const r = load(['respFiAt', 'abgLinkFiO2']);
const snap = (time, fio2) => ({ time, values: { fio2 } });
const pt = () => ({ days: {
  '2026-10-16': { resp: { monitor: { fio2: 50 }, snapshots: [snap('08:00', 60), snap('20:00', 50)] } },
  '2026-10-17': { resp: { monitor: {}, snapshots: [snap('07:00', 40), snap('14:00', 30)] }, abg: { panels: [] } },
} });
let p = pt();
eq('at/before ABG time', r.respFiAt(p, '2026-10-17', '10:00'), { v: 40, at: '07:00' });
eq('exact time match', r.respFiAt(p, '2026-10-17', '14:00'), { v: 30, at: '14:00' });
eq('before first entry → previous day last', r.respFiAt(p, '2026-10-17', '05:00'), { v: 50, at: '10/16 20:00' });
p.days['2026-10-16'].resp.snapshots = []; p.days['2026-10-16'].resp.monitor = {};
eq('no previous day → same-day next entry', r.respFiAt(p, '2026-10-17', '05:00'), { v: 40, at: '07:00' });

p = pt();
p.days['2026-10-17'].resp = { monitor: { fio2: 35 }, snapshots: [] };
eq('day without snapshots → same-day monitor (not previous day)', r.respFiAt(p, '2026-10-17', '05:00'), { v: 35, at: '' });

p = pt();
p.days['2026-10-17'].abg.panels = [
  { id: 'new', time: '10:00', fio2: null, fio2_src: 'resp' },
  { id: 'legacy', time: '10:00', fio2: 70 },
  { id: 'blank-old', time: '15:00', fio2: null },
];
r.abgLinkFiO2(p);
const [a, b, c] = p.days['2026-10-17'].abg.panels;
eq('new panel gets Resp FiO2', [a.fio2, a.fio2_at], [40, '07:00']);
eq('legacy manual value untouched', [b.fio2, b.fio2_src], [70, undefined]);
eq('old blank panel becomes linked', [c.fio2, c.fio2_src], [30, 'resp']);
p.days['2026-10-17'].resp.snapshots[0].values.fio2 = 45;
r.abgLinkFiO2(p);
eq('Resp edited → ABG follows', a.fio2, 45);
const before = JSON.stringify(p); r.abgLinkFiO2(p);
eq('idempotent (no churn for sync)', JSON.stringify(p), before);
p.days['2026-10-17'].resp.snapshots = []; p.days['2026-10-16'].resp.snapshots = []; p.days['2026-10-16'].resp.monitor = {};
const e = { id: 'edited-legacy', time: '10:00', fio2: null, fio2_src: 'resp', fio2_legacy: 70 };
p.days['2026-10-17'].abg.panels = [e]; r.abgLinkFiO2(p);
eq('no Resp data → falls back to legacy value', e.fio2, 70);

done();
