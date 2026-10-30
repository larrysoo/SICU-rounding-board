import { load, eq, done } from './harness.mjs';

// v15.11.0 — SOAP (EMR) export. Synthetic demo record only (repo is public).
const t = load(['txtN', 'soapProblems', 'soapNote']);

const base = () => ({
  date: '2026-10-30',
  patient: { name: 'Demo, A.', age: 65, sex: 'M', weight_kg: 60, bed: 'ICU-1', mrn: 'DEMO001', admitDx: 'Perforated diverticulitis' },
  statusBadges: ['VIS 10', 'KDIGO 2'],
  neuro: 'GCS 8T · RASS -2', sap: 'Propofol 1.5 mg/kg/h', vitals: 'MAP 68 · HR 105 · Lac 2.4',
  vaso: 'Norepinephrine 0.1 mcg/kg/min', mcs: 'none',
  resp: 'MV · VC · SpO2 95% · PEEP 8 · FiO2 40%',
  abg: { time: '06:00', fio2: 40, ph: 7.31, pco2: 42, po2: 80, hco3: 20 },
  abgAn: { summary: 'Metabolic acidosis', ag: 16, pf: 200 },
  renal: 'Cr 2.1 · KDIGO 2 · no RRT', fluid: 'UO 400 mL · Today +1200 · Cum +3,500',
  lytes: 'Na 138 · K 4.1 · Cl 104 · iCa 1.1',
  cbc: 'Hb 8.2 · Plt 120 · INR 1.3', inf: 'Tmax 38.4°C · WBC 15.2 · CRP 180',
  abx: 'Meropenem 1 g q8h d3', nrsLine: '4 (at risk)', glyc: '', bowel: '',
  nutrTarget: '1500 kcal · 90 g protein', nutrAch: '600 kcal (40%) · 30 g (33%)',
  feeding: ['NG Ensure — 600 kcal/30g'], giSx: [], allergy: 'NKDA',
  events24: [{ time: '22:00', text: 'NE up-titrated' }], events8: [],
  soap: {
    icuDay: 4, surg: [{ proc: "Hartmann's", pod: 3 }],
    vis: 10, vasoN: 1, mcsN: 0, sedN: 1, mv: true, pf: 200,
    kdigo: 2, dialysis: null, abxN: 1, nrsRisk: true, nrsTotal: 4,
    txf: '', hb: 8.2, plt: 120,
    plansBy: { hemo: ['Wean NE to MAP ≥ 65'], resp: ['SBT if FiO2 ≤ 40%'], abg: [], renal: [], lyte: [], neuro: [], inf: ['F/u blood cx'], nutr: [], heme: [] },
  },
});

console.log('Problem list');
let P = t.soapProblems(base());
eq('shock title', P[0].title, 'Circulatory failure on vasoactives (VIS 10)');
eq('shock plan', P[0].p, ['Wean NE to MAP ≥ 65']);
eq('resp title', P[1].title, 'Acute respiratory failure on MV, moderate ARDS criteria (P/F 200)');
eq('AKI title', P[2].title, 'AKI, KDIGO 2');
eq('AKI no plan → listed (flagged)', P[2].p, []);
eq('sedation listed', P[3].title, 'Sedation / analgesia');
eq('infection plan', P[4].p, ['F/u blood cx']);
eq('nutrition risk', P[5].title, 'Nutritional risk (NRS-2002 4)');
eq('heme not listed (no flag, no plan)', P.some((x) => x.title === 'Hematology'), false);

const quiet = base();
Object.assign(quiet.soap, { vasoN: 0, mcsN: 0, sedN: 0, mv: false, pf: null, kdigo: 0, abxN: 0, nrsRisk: false,
  plansBy: { heme: ['Transfuse if Hb < 7'] } });
P = t.soapProblems(quiet);
eq('quiet patient → only organs with plans', P.map((x) => x.title), ['Hematology']);
eq('missing organ keys tolerated', P[0].p, ['Transfuse if Hb < 7']);

const rrt = base(); Object.assign(rrt.soap, { kdigo: 0, dialysis: 'CRRT' });
eq('RRT without KDIGO', t.soapProblems(rrt)[2].title, 'Renal failure on CRRT');

console.log('Note layout');
const s = t.soapNote(base());
const has = (label, frag) => eq(label, s.includes(frag), true);
has('header', 'ICU PROGRESS NOTE (SOAP)  2026-10-30  ICU day 4');
has('POD', "s/p Hartmann's (POD 3)");
has('S events', '  - 22:00 NE up-titrated');
has('empty 8h', ' Events, last 8 h:\n  - none');
has('ABG line', ' ABG    : 06:00 FiO2 40% · 7.31/42/80/20');
has('#1 admit Dx', "#1 Perforated diverticulitis, s/p Hartmann's POD 3");
has('#2 shock', '#2 Circulatory failure on vasoactives (VIS 10)');
has('plan line', '   P: Wean NE to MAP ≥ 65');
has('no plan placeholder', '#4 AKI, KDIGO 2\n   A: Cr 2.1 · KDIGO 2 · no RRT · UO 400 mL · Today +1200 · Cum +3,500 · Na 138 · K 4.1 · Cl 104 · iCa 1.1\n   P: —');
eq('order S → O → A/P', s.indexOf('S:\n') < s.indexOf('\nO:\n') && s.indexOf('\nO:\n') < s.indexOf('\nA/P:\n'), true);
eq('no markdown symbols', /[*`|]/.test(s), false);

const noAbg = base(); noAbg.abg = null; noAbg.abgAn = null; noAbg.soap.surg = [];
const s2 = t.soapNote(noAbg);
eq('no ABG', s2.includes(' ABG    : none today'), true);
eq('no surgery → plain #1', s2.includes('#1 Perforated diverticulitis\n'), true);

done();
