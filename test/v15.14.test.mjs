import { load, eq, done } from './harness.mjs';

let n = 0;
const ud = (p) => p + '_' + (++n);

console.log('Events: day D last 8 h <-> day D+1 last 24 h');
const t = load(['ensureEv', 'evDayShift', 'evPartner', 'evSync'], { ud });
const mkP = () => ({ days: {
  '2026-11-19': { events: { e24: [], e8: [] } },
  '2026-11-20': { events: { e24: [], e8: [] } },
  '2026-11-22': { events: { e24: [], e8: [] } },
} });

let p = mkP();
eq('next day of D', t.evDayShift('2026-11-30', 1), '2026-12-01');
eq('partner of e8 is next day e24', t.evPartner(p, '2026-11-19', 'e8'), { dk: '2026-11-20', b: 'e24' });
eq('partner of e24 is previous day e8', t.evPartner(p, '2026-11-20', 'e24'), { dk: '2026-11-19', b: 'e8' });
eq('gap day → no partner', t.evPartner(p, '2026-11-20', 'e8').dk, null);

// back-dated add to an old day's last 8 h
const e = { id: 'ev_a', text: 'CT abdomen done', time: '14:00' };
p.days['2026-11-19'].events.e8.unshift(e);
t.evSync(p, '2026-11-19', 'e8', e, null);
const d2 = p.days['2026-11-20'].events.e24;
eq('add to D e8 → copied to D+1 e24', d2.map((x) => x.text), ['CT abdomen done']);
eq('pair shares a link id', d2[0].link, e.link);

// edit the copy in D+1 last 24 h → flows back to D last 8 h
const old = { ...d2[0] };
d2[0] = { ...d2[0], text: 'CT abdomen done — no leak', time: '14:30' };
t.evSync(p, '2026-11-20', 'e24', d2[0], old);
const e8now = p.days['2026-11-19'].events.e8[0];
eq('edit D+1 e24 → D e8 updated', [e8now.text, e8now.time], ['CT abdomen done — no leak', '14:30']);
eq('no duplicate created', p.days['2026-11-19'].events.e8.length, 1);

// add to last 24 h → goes into previous day's last 8 h
const f = { id: 'ev_b', text: 'new AF, HR 140s', time: '03:00' };
p.days['2026-11-20'].events.e24.unshift(f);
t.evSync(p, '2026-11-20', 'e24', f, null);
eq('add to D+1 e24 → D e8', p.days['2026-11-19'].events.e8.map((x) => x.text), ['new AF, HR 140s', 'CT abdomen done — no leak']);

// delete propagates
t.evSync(p, '2026-11-20', 'e24', f, f, true);
eq('delete removes the partner', p.days['2026-11-19'].events.e8.length, 1);

// legacy copy (made by old carry-forward, no link) matched by text + time
p = mkP();
const leg = { id: 'ev_x', text: 'extubated', time: '10:00' };
p.days['2026-11-19'].events.e8.push(leg);
p.days['2026-11-20'].events.e24.push({ id: 'ev_y', text: 'extubated', time: '10:00' });
const legOld = { ...leg };
leg.text = 'extubated → HFNC 40%';
t.evSync(p, '2026-11-19', 'e8', leg, legOld);
eq('legacy copy updated, not duplicated', p.days['2026-11-20'].events.e24.map((x) => x.text), ['extubated → HFNC 40%']);

console.log('Stool volume: shift entries excluded from 24h I/O');
const s = load(['stoolOut', 'stoolShift']);
const dy = { nutr: { bowel: { snapshots: [{ volume_ml: 300 }, { volume_ml: 200, is24h: false }, { volume_ml: null }] } } };
eq('24h stool output', s.stoolOut(dy), 300);
eq('shift stool subtotal', s.stoolShift(dy), 200);

console.log('PD counts as RRT');
const k = load(['sofaKidney']);
eq('SOFA kidney 4 on PD', k.sofaKidney({ days: { d: { renal: { dialysis: 'PD', monitor: {} } } } }, 'd').score, 4);

done();
