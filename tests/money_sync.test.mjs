// Money history and sync safety: rate changes, payment deletion, the v2
// migration, stale saves during a sync, and backup import.
import { boot, reporter, localDay } from './harness.mjs';
const t = reporter();
const appt = (id, patientId, d, extra) => ({ id, patientId, date: localDay(d), startTime: '10:00', duration: 50, status: 'completed', paid: false, notes: 'x', ...extra });
const app = await boot({ local: { schemaVersion: 2,
  patients: [{ id: 'p1', name: 'דנה כהן', sessionRate: 300, payerType: 'private' }],
  appointments: [
    appt('a1', 'p1', -14), appt('a2', 'p1', -7),
    appt('f1', 'p1', 7, { status: 'scheduled', notes: '' })],
  payments: [] } });
const W = app.window;
const props = (el) => el[Object.keys(el).find((k) => k.startsWith('__reactProps$'))];
const byId = (id) => app.store().appointments.find((a) => a.id === id);
const saveModal = () => app.click(app.findAll('.modal button', /^שמירה$/)[0], 'save');

// --- raising the rate doesn't reprice sessions that already happened
await app.click(app.findAll('button', /מטופלים$/)[0], 'patients');
await app.click(app.findAll('h3', /דנה כהן/)[0]?.closest('.card'), 'open p1');
await app.click(app.findAll('button', /עריכה$/)[0], 'edit patient');
const rateInput = [...W.document.querySelectorAll('.modal input[type="number"]')].find((i) => i.value === '300');
await app.setVal(rateInput, '350');
await saveModal();
const p1 = app.store().patients[0];
t.check('new rate saved', Number(p1.sessionRate) === 350);
t.check('past sessions keep the old price', W.apptPrice(byId('a1'), p1) === 300 && W.apptPrice(byId('a2'), p1) === 300);
t.check('future session uses the new rate', W.apptPrice(byId('f1'), p1) === 350);

// --- a payment remembers its sessions; deleting it can un-mark them
await app.click(app.findAll('button', /כספים$/)[0], 'finance');
await app.click(app.findAll('button', /רישום תשלום/)[0], 'add payment');
await app.act(async () => props(W.document.querySelector('.modal select')).onChange({ target: { value: 'p1' } }));
for (const b of [...W.document.querySelectorAll('.modal input[type="checkbox"]')]) await app.act(async () => props(b).onChange({}));
await saveModal();
const pay = app.store().payments[0];
t.check('payment covers the ticked sessions', pay && pay.amount === 600 && [...(pay.apptIds || [])].sort().join() === 'a1,a2');
t.check('sessions marked paid', byId('a1').paid && byId('a2').paid);
const payRow = app.findAll('tr', /דנה כהן/).find((r) => r.querySelectorAll('button').length === 2);
app.ui.answers = [true];
await app.click(payRow?.querySelectorAll('button')[1], 'delete payment');
await app.click(app.findAll('.modal button', /^מחיקה$/)[0], 'confirm delete');
t.check('payment deleted', app.store().payments.length === 0);
t.check('its sessions are unpaid again', !byId('a1').paid && !byId('a2').paid);

// --- the v2 migration counts sessions already marked paid against the payments
const migrated = W.migrateDataV2({
  patients: [{ id: 'q', sessionRate: 300 }],
  appointments: [
    { id: 'm1', patientId: 'q', date: '2025-01-01', startTime: '10:00', status: 'completed', paid: true },
    { id: 'm2', patientId: 'q', date: '2025-01-08', startTime: '10:00', status: 'completed', paid: false }],
  payments: [{ id: 'x', patientId: 'q', amount: 300 }] });
t.check('migration: one payment does not cover two sessions', migrated.appointments.find((a) => a.id === 'm2').paid === false);

// --- a save built from stale data must not delete records a sync just brought in
const base = { patients: [{ id: 'p1' }], appointments: [{ id: 'a1' }], payments: [] };
const current = { ...base, appointments: [...base.appointments, { id: 'fromOtherDevice' }] };
const next = { ...base, appointments: base.appointments.map((a) => ({ ...a, paid: true })) };
const rebased = W.rebaseChanges(base, next, current);
t.check('stale save keeps the synced record', rebased.appointments.some((a) => a.id === 'fromOtherDevice'));
t.check('stale save still applies its own change', rebased.appointments.find((a) => a.id === 'a1').paid === true);
const del = W.rebaseChanges(base, { ...base, appointments: [] }, current);
t.check('stale delete removes only what the user deleted', del.appointments.map((a) => a.id).join() === 'fromOtherDevice');

// --- backup import: reject junk, confirm before replacing
await app.click(app.findAll('button', /הגדרות$/)[0], 'settings');
const fileInput = W.document.querySelector('input[type="file"]');
const importFile = async (obj) => {
  const f = new W.File([JSON.stringify(obj)], 'b.json', { type: 'application/json' });
  await app.act(async () => props(fileInput).onChange({ target: { files: [f], value: '' } }));
  await app.settle(80);
};
await importFile({});
t.check('empty file rejected, data untouched', app.store().appointments.length === 3 && /אינו גיבוי תקין/.test(app.txt()));
app.ui.answers = [false];
await importFile({ patients: [], appointments: [], payments: [] });
t.check('cancelled import leaves data untouched', app.store().appointments.length === 3);
app.ui.answers = [true];
await importFile({ schemaVersion: 2, patients: [{ id: 'z', name: 'גיבוי', sessionRate: 200 }], appointments: [], payments: [] });
t.check('confirmed import replaces data', app.store().patients.map((p) => p.id).join() === 'z' && app.store().appointments.length === 0);
t.check('success message shown', /יובא בהצלחה/.test(app.txt()));
t.done();
