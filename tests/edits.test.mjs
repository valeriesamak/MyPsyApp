// Editing records must not lose fields the form doesn't show, and a payment
// must only mark the chosen patient's sessions as paid.
import { boot, reporter, localDay } from './harness.mjs';
const t = reporter();
const appt = (id, patientId, d, extra) => ({ id, patientId, date: localDay(d), startTime: '10:00', duration: 50, status: 'completed', paid: false, ...extra });
const app = await boot({ local: { schemaVersion: 2,
  patients: [
    { id: 'p1', name: 'דנה כהן', sessionRate: 300, payerType: 'private' },
    { id: 'p2', name: 'רון ארכיון', sessionRate: 300, payerType: 'private', archived: true, archivedAt: localDay(-30) },
    { id: 'p3', name: 'מיכל סדרה', sessionRate: 300, payerType: 'private' },
    { id: 'p4', name: 'יוסי לוי', sessionRate: 250, payerType: 'private' },
    { id: 'p5', name: 'נועה חשבונית', sessionRate: 300, payerType: 'private' }],
  appointments: [
    appt('inv', 'p5', -20, { paid: true, invoiced: true }),
    appt('u1', 'p1', -10), appt('u2', 'p1', -3),
    appt('s1', 'p3', 7, { status: 'scheduled', paid: true }),
    appt('s2', 'p3', 14, { status: 'scheduled' }),
    appt('s3', 'p3', 21, { status: 'scheduled' })],
  payments: [] } });
const props = (el) => el[Object.keys(el).find((k) => k.startsWith('__reactProps$'))];
const open = async (name, archived) => {
  await app.click(app.findAll('button', /מטופלים$/)[0], 'patients');
  const back = app.findAll('button', /חזרה לרשימת המטופלים/)[0]; if (back) await app.click(back, 'back');
  const tab = app.findAll('button', archived ? /ארכיון \(/ : /^הכל$/)[0]; if (tab) await app.click(tab, 'tab');
  await app.click(app.findAll('h3', new RegExp(name))[0]?.closest('.card'), 'open ' + name);
};
const saveModal = () => app.click(app.findAll('.modal button', /^שמירה$/)[0], 'save');
const byId = (id) => app.store().appointments.find((a) => a.id === id);

// editing an invoiced session keeps it invoiced
await open('נועה חשבונית');
await app.click(app.window.document.querySelector('button[title^="עריכת הפגישה"]'), 'edit appt');
t.check('appointment editor opened', /עריכת פגישה/.test(app.txt()));
await saveModal();
t.check('edited session keeps invoiced flag', byId('inv').invoiced === true && byId('inv').paid === true);

// editing an archived patient keeps them archived
await open('רון ארכיון', true);
await app.click(app.findAll('button', /עריכה$/)[0], 'edit patient');
await saveModal();
const p2 = app.store().patients.find((p) => p.id === 'p2');
t.check('archived patient stays archived after edit', p2.archived === true && !!p2.archivedAt);

// moving a series keeps each session's own data
const dow = new Date(byId('s1').date + 'T00:00:00').getDay();
await open('מיכל סדרה');
await app.click(app.findAll('button', /עריכה$/)[0], 'edit patient');
await app.click(app.findAll('.modal button', /שינוי$/)[0], 'change series');
const daySel = [...app.window.document.querySelectorAll('.modal select')].find((s) => /יום/.test(s.textContent) && Number(s.value) === dow);
await app.act(async () => props(daySel).onChange({ target: { value: String((dow + 1) % 7) } }));
await app.click(app.findAll('.modal button', /עדכון מהיום ואילך/)[0], 'update series');
const series = app.store().appointments.filter((a) => a.patientId === 'p3');
t.check('series moved to the new weekday', series.length === 3 && series.every((a) => new Date(a.date + 'T00:00:00').getDay() === (dow + 1) % 7));
t.check('only the prepaid session is paid', series.filter((a) => a.paid).length === 1);
t.check('sessions keep their ids', ['s1', 's2', 's3'].every((id) => series.some((a) => a.id === id)));
const close = app.findAll('.modal button', /ביטול/)[0]; if (close) await app.click(close, 'close modal');

// payment: switching patient after ticking sessions must not mark the first patient's sessions
await app.click(app.findAll('button', /כספים$/)[0], 'finance');
await app.click(app.findAll('button', /רישום תשלום/)[0], 'add payment');
const patSel = () => app.window.document.querySelector('.modal select');
await app.act(async () => props(patSel()).onChange({ target: { value: 'p1' } }));
const boxes = [...app.window.document.querySelectorAll('.modal input[type="checkbox"]')];
t.check('p1 unpaid sessions listed', boxes.length === 2);
for (const b of boxes) await app.act(async () => props(b).onChange({ target: { checked: true } }));
await app.act(async () => props(patSel()).onChange({ target: { value: 'p4' } }));
t.check('amount cleared on patient switch', app.window.document.querySelector('.modal input[type="number"]').value === '');
await app.setVal(app.window.document.querySelector('.modal input[type="number"]'), '250');
await saveModal();
t.check('payment recorded for p4', app.store().payments.some((p) => p.patientId === 'p4' && p.amount === 250));
t.check("p1's sessions still unpaid", byId('u1').paid === false && byId('u2').paid === false);
t.done();
