import { load, eq, done } from './harness.mjs';

// v15.12.0 — PharmD review. Synthetic demo patients only (repo is public).
let KD = 0;
const t = load(['ORG', 'iA', 'dot', 'pdDB', 'pdMatch', 'pdHas', 'pdIs', 'pdMeds', 'pdMon', 'pdPrev', 'pdDays', 'pdLab', 'pdRenal', 'pdRenalLine', 'pdUnstableTxt', 'pdFlags', 'pdConsult'], {
  kd: () => KD, vsLatestDose: () => null, vsPresetFor: () => null, vsFmtDose: (d) => String(d), insSummary: () => 'IV infusion',
});
const T = '2026-11-11', Y = '2026-11-10';
const day = (o = {}) => ({ renal: { monitor: { cr: 'cr' in o ? o.cr : 1.0 }, dialysis: o.rrt ?? null, uf: { snapshots: o.uf ?? [] } },
  lyte: { monitor: { k: 'k' in o ? o.k : 4.0, mg: o.mg ?? 2.0 } }, hemo: { monitor: { qtc: o.qtc ?? null, lac: o.lac ?? 1 }, vasoactives: [] },
  heme: { monitor: { plt: o.plt ?? 200, hb: 10, bili: o.bili ?? null, ast: o.ast ?? null, alt: o.alt ?? null }, meds: o.heme ?? [] },
  inf: { monitor: { wbc: 9 } }, neuro: { infusions: o.inf ?? [], meds: o.neuro ?? [] }, nutr: {} });
const med = (name, route = 'IV') => ({ name, route, active: true, snapshots: [{ time: '08:00', dose: '1 unit' }] });
const abx = (drug, start = Y) => ({ drug, dose: 'x', startDate: start, stopDate: null });
const pt = (o = {}) => ({ bed: 'ICU-9', name: 'Demo, Z.', mrn: 'DEMO999', age: o.age ?? 70, sex: o.sex ?? 'M', weight_kg: o.wt ?? 80, height_cm: 'ht' in o ? o.ht : 175,
  admitDx: 'Demo sepsis', antibiotics: o.abx ?? [], days: { [Y]: day(o.yday ?? {}), [T]: day(o) } });
const flags = (p) => t.pdFlags(p, T);
const has = (F, sev, frag) => F.some((f) => f.sev === sev && f.msg.includes(frag));

console.log('Drug matching');
eq('Tapimycin → pip-tazo', t.pdMatch('Tapimycin 4.5 g').k, 'Piperacillin-tazobactam');
eq('cefoperazone/sulbactam not plain sulbactam', t.pdMatch('Cefoperazone/sulbactam').k, 'Cefoperazone-sulbactam');
eq('Brosym', t.pdMatch('Brosym').k, 'Cefoperazone-sulbactam');
eq('Ampicillin/sulbactam combo first', t.pdMatch('Ampicillin/sulbactam').k, 'Ampicillin-sulbactam');
eq('escitalopram ≠ citalopram', t.pdMatch('Escitalopram').k, 'Escitalopram');
eq('Levophed is not levofloxacin', t.pdMatch('Norepinephrine (Levophed)'), null);
eq('remifentanil ≠ fentanyl', t.pdMatch('Remifentanil'), null);
eq('enalapril → ACE inhibitor', t.pdMatch('Enalapril').k, 'ACE inhibitor');
eq('Depakine → valproate', t.pdMatch('Depakine').k, 'Valproate');
eq('Invanz → ertapenem', t.pdMatch('Invanz').k, 'Ertapenem');

console.log('Med list');
let p = pt({ abx: [abx('Meropenem'), abx('Colistin (inhaled)'), abx('Old', '2026-12-01')], inf: [{ drug: 'Fentanyl', active: true }, { drug: 'Propofol', active: false }], neuro: [med('Haloperidol')] });
let M = t.pdMeds(p, T);
eq('active only, all sources', M.map((m) => m.name), ['Meropenem', 'Colistin (inhaled)', 'Fentanyl', 'Haloperidol']);
eq('inhaled colistin has no rules', M[1].local && M[1].d === null, true);
eq('abx day of therapy', M[0].dot, 2);
eq('organ med dose from latest snapshot', M[3].dose, '1 unit');

console.log('Renal function');
let r = t.pdRenal(pt(), T);
eq('IBW 175 cm male', r.ibw, 70.5);
eq('non-obese → IBW', r.dwl + ' ' + r.dw, 'IBW 70.5');
eq('CG CrCl', r.crcl, 69);
r = t.pdRenal(pt({ age: 50, wt: 150, ht: 170 }), T);
eq('obese → AdjBW', r.dwl + ' ' + r.dw, 'AdjBW 99.5');
eq('obese CrCl', r.crcl, 124);
eq('female × 0.85', t.pdRenal(pt({ sex: 'F', ht: null }), T).crcl, Math.round(70 * 80 / 72 * 0.85));
r = t.pdRenal(pt({ rrt: 'CRRT', uf: [{ time: '06:00', effluent: 2000 }, { time: '14:00', effluent: 2400, dialysate: 1500 }] }), T);
eq('CRRT clearance = latest effluent / 60', r.effClr, 40);
eq('CRRT line', t.pdRenalLine(r).startsWith('On CRRT · est. clearance ~40 mL/min'), true);
eq('rising Cr → unstable, up', t.pdRenal(pt({ cr: 1.6, yday: { cr: 1.1 } }), T).trend, 'up');
eq('falling Cr → down', t.pdRenal(pt({ cr: 1.6, yday: { cr: 2.4 } }), T).trend, 'down');
eq('falling Cr text says underestimate', t.pdRenalLine(t.pdRenal(pt({ cr: 1.6, yday: { cr: 2.4 } }), T)).includes('may underestimate'), true);
eq('rising Cr flag', has(flags(pt({ cr: 1.6, yday: { cr: 1.1 }, abx: [abx('Meropenem')] })), 'mod', 'Cr rising — CG overestimates'), true);

console.log('Renal flags');
eq('meropenem CrCl 40 → mod', has(flags(pt({ cr: 1.7, abx: [abx('Meropenem')] })), 'mod', 'Meropenem: renally cleared'), true);
eq('meropenem CrCl ~20 → hi', has(flags(pt({ cr: 3.5, abx: [abx('Meropenem')] })), 'hi', 'Meropenem: renally cleared'), true);
eq('meropenem CrCl 69 → no renal flag', flags(pt({ abx: [abx('Meropenem')] })).some((f) => f.cat === 'renal'), false);
eq('first days: keep loading dose', has(flags(pt({ cr: 3.5, abx: [abx('Meropenem', T)] })), 'hi', 'do not reduce the loading'), true);
eq('ARC', has(flags(pt({ age: 25, cr: 0.5, abx: [abx('Meropenem')] })), 'mod', 'Augmented renal clearance'), true);
eq('CRRT without effluent → data flag', has(flags(pt({ rrt: 'CRRT', abx: [abx('Vancomycin')] })), 'info', 'effluent not recorded'), true);
eq('no Cr → data flag', has(flags(pt({ cr: null })), 'info', 'record creatinine'), true);

console.log('Toxicity flags');
KD = 1;
let F = flags(pt({ abx: [abx('Vancomycin'), abx('Tapimycin')] }));
eq('vanco + pip-tazo in AKI → hi', has(F, 'hi', 'Vancomycin + piperacillin-tazobactam'), true);
eq('nephrotoxin during AKI', has(F, 'hi', 'Nephrotoxin exposure during AKI'), true);
KD = 0;
eq('inhaled colistin → no nephrotoxin flag', flags(pt({ abx: [abx('Colistin (inhaled)'), abx('Vancomycin')] })).some((f) => f.cat === 'nephro'), false);
eq('hepatotoxic + AST 300', has(flags(pt({ ast: 300, abx: [abx('Voriconazole')] })), 'hi', 'Hepatotoxic drugs with abnormal liver tests'), true);
eq('HIT: plt 200 → 80 on heparin', has(flags(pt({ plt: 80, heme: [med('Heparin')] })), 'hi', 'assess HIT'), true);
eq('no HIT flag without heparin', flags(pt({ plt: 80 })).some((f) => f.msg.includes('HIT')), false);
eq('linezolid day 12', has(flags(pt({ abx: [abx('Linezolid', '2026-10-31')] })), 'mod', 'Linezolid day 12'), true);

console.log('Interactions');
eq('carbapenem + valproate', has(flags(pt({ abx: [abx('Meropenem')], neuro: [med('Depakine')] })), 'hi', 'Carbapenem + valproate'), true);
eq('linezolid + sertraline', has(flags(pt({ abx: [abx('Linezolid')], neuro: [med('Sertraline')] })), 'hi', 'Serotonin syndrome'), true);
eq('QT pair with QTc 510 → hi', has(flags(pt({ qtc: 510, abx: [abx('Levofloxacin')], neuro: [med('Haloperidol')] })), 'hi', 'QT-prolonging combination'), true);
eq('single QT drug + K 3.1 → mod', has(flags(pt({ k: 3.1, qtc: 450, neuro: [med('Haloperidol')] })), 'mod', 'torsades risk'), true);
eq('voriconazole + midazolam → CYP3A4', has(flags(pt({ abx: [abx('Voriconazole')], inf: [{ drug: 'Midazolam', active: true }] })), 'mod', 'CYP3A4 inhibition'), true);
eq('clarithromycin + colchicine → hi', has(flags(pt({ abx: [abx('Clarithromycin')], heme: [med('Colchicine', 'PO')] })), 'hi', 'CYP3A4 inhibition'), true);
eq('rifampicin + apixaban → HIGH induction', has(flags(pt({ abx: [abx('Rifampicin')], heme: [med('Apixaban', 'PO')] })), 'hi', 'Enzyme / P-gp induction'), true);
eq('K 5.8 + spironolactone', has(flags(pt({ k: 5.8, heme: [med('Spironolactone', 'PO')] })), 'hi', 'potassium-raising'), true);
eq('two anticoagulants → bleeding', has(flags(pt({ heme: [med('Enoxaparin', 'SC'), med('Aspirin', 'PO')] })), 'mod', 'Additive bleeding risk'), true);
eq('severity order', flags(pt({ k: 5.8, heme: [med('Spironolactone', 'PO')], neuro: [med('Haloperidol')] })).map((f) => f.sev).join(','), 'hi,info');


console.log('Review fixes');
eq('tramadol/acetaminophen keeps both', t.pdMatch('Tramadol/acetaminophen').k, 'Tramadol + Paracetamol');
eq('combo keeps tramadol tags', t.pdHas(t.pdMatch('Tramadol/acetaminophen'), 'sero2'), true);
eq('Polymyxin E → colistin', t.pdMatch('Polymyxin E').k, 'Colistin');
eq('fosphenytoin', t.pdMatch('Fosphenytoin').k, 'Phenytoin');
eq('cefoperazone/sulbactam is one row, renal', [t.pdMatch('Cefoperazone/sulbactam').k, t.pdHas(t.pdMatch('Cefoperazone/sulbactam'), 'renal')], ['Cefoperazone-sulbactam', true]);
eq('ceftazidime-avibactam is one row', t.pdMatch('Ceftazidime-avibactam').k, 'Ceftazidime-avibactam');
eq('Precedex recognised', t.pdMatch('Dexmedetomidine (Precedex)').k, 'Dexmedetomidine');
eq('linezolid + fentanyl → no HIGH', flags(pt({ abx: [abx('Linezolid')], inf: [{ drug: 'Fentanyl', active: true }] })).some((f) => f.sev === 'hi'), false);
eq('linezolid + fentanyl → info', has(flags(pt({ abx: [abx('Linezolid')], inf: [{ drug: 'Fentanyl', active: true }] })), 'info', 'low serotonergic risk'), true);
eq('tramadol + sertraline → mod', has(flags(pt({ neuro: [med('Tramadol', 'PO'), med('Sertraline', 'PO')] })), 'mod', 'Serotonergic combination'), true);
eq('PO vancomycin + pip-tazo → no AKI flag', flags(pt({ abx: [{ drug: 'Vancomycin', dose: '125 mg PO q6h', startDate: Y }, abx('Tapimycin')] })).some((f) => f.msg.includes('Vancomycin + piperacillin')), false);
eq('heparin flush → no HIT flag', flags(pt({ plt: 80, heme: [med('Heparin flush')] })).some((f) => f.msg.includes('HIT')), false);
eq('K from yesterday is used', has(flags(pt({ k: null, yday: { k: 3.1 }, qtc: 450, neuro: [med('Haloperidol')] })), 'mod', 'K 3.1'), true);
eq('consult shows lab date', t.pdConsult(pt({ k: null, yday: { k: 3.1 } }), T).includes('K 3.1 (11-10)'), true);
eq('falling Cr after RRT → not recovery', t.pdRenalLine(t.pdRenal(pt({ cr: 1.6, yday: { cr: 2.6, rrt: 'CRRT' } }), T)).includes('not recovery'), true);
eq('rising Cr: anti-infectives keep full dose', has(flags(pt({ cr: 1.6, yday: { cr: 1.1 }, abx: [abx('Meropenem')] })), 'mod', 'Anti-infectives: keep full dose'), true);
eq('CRRT clearance 60 ≥ meropenem threshold → no renal flag', flags(pt({ rrt: 'CRRT', uf: [{ time: '08:00', effluent: 3600 }], abx: [abx('Meropenem')] })).some((f) => f.msg.startsWith('Meropenem')), false);
eq('CRRT clearance 20 → HIGH', has(flags(pt({ rrt: 'CRRT', uf: [{ time: '08:00', effluent: 1200 }], abx: [abx('Meropenem')] })), 'hi', 'Meropenem: renally cleared — check dose for CRRT'), true);
eq('HD → HIGH', has(flags(pt({ rrt: 'HD', abx: [abx('Meropenem')] })), 'hi', 'for HD'), true);
eq('no "keep loading dose" note for aciclovir', flags(pt({ cr: 3.5, abx: [abx('Aciclovir', T)] })).some((f) => f.msg.includes('loading')), false);
eq('voriconazole + tacrolimus → HIGH', has(flags(pt({ abx: [abx('Voriconazole')], heme: [med('Tacrolimus', 'PO')] })), 'hi', 'Strong CYP3A4 inhibition'), true);
eq('digoxin + K 3.2 → HIGH', has(flags(pt({ k: 3.2, hemo_meds: 1, heme: [med('Digoxin', 'PO')] })), 'hi', 'Digoxin with K 3.2'), true);
eq('Mg 0.6 (mmol/L) read as low', has(flags(pt({ mg: 0.6, qtc: 450, neuro: [med('Haloperidol')] })), 'mod', 'Mg 1.5'), true);
eq('clopidogrel + omeprazole', has(flags(pt({ heme: [med('Clopidogrel', 'PO'), med('Omeprazole', 'PO')] })), 'mod', 'prefer pantoprazole'), true);
eq('furosemide + low K', has(flags(pt({ k: 3.0, heme: [med('Lasix')] })), 'mod', 'replace K / Mg'), true);
p = pt({ inf: [{ drug: 'Propofol', active: true }] });
p.days['2026-11-09'] = day({ inf: [{ drug: 'Propofol', active: true }] }); p.days[Y].neuro.infusions = [{ drug: 'Propofol', active: true }];
eq('propofol day 3 → TG check', has(flags(p), 'info', 'Propofol infusion day 3'), true);

console.log('Consult block');
p = pt({ abx: [abx('Meropenem')], neuro: [med('Haloperidol')] });
const c = t.pdConsult(p, T);
eq('de-identified: no name', c.includes('Demo, Z.'), false);
eq('de-identified: no MRN', c.includes('DEMO999'), false);
eq('header', c.startsWith('PHARMD REVIEW — ICU-9 · 70M · 80 kg · 175 cm (IBW 70.5, dosing wt IBW 70.5) · ICU day 2'), true);
eq('lists drugs', c.includes('- Meropenem — x [Abx] · day 2') && c.includes('- Haloperidol — 1 unit · IV [Neuro]'), true);
eq('includes flags', c.includes('[info] QTc not recorded'), true);
eq('asks the skill', c.includes('Using the icu-pharmd skill'), true);

done();
