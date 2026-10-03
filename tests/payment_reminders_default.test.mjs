import { boot, reporter, localDay } from './harness.mjs';
const t = reporter();
// p1 owes for 4 past sessions — enough to trigger a payment reminder when enabled
const mk = (id, d) => ({ id, patientId: 'p1', date: localDay(d), startTime: '10:00', duration: 50, status: 'completed', paid: false, notes: 'x' });
const local = (settings) => ({ schemaVersion: 2, settings, payments: [],
  patients: [{ id: 'p1', name: 'דנה כהן', sessionRate: 300, payerType: 'private' }],
  appointments: [mk('a1', -3), mk('a2', -10), mk('a3', -17), mk('a4', -40)] });
const card = (app) => [...app.window.document.querySelectorAll('h3')].find((h) => /תזכורות/.test(h.textContent)).closest('.card').textContent;

const off = await boot({ local: local(undefined) });
t.check('payment reminders off by default', !/דנה כהן/.test(card(off)) && /אין תזכורות כרגע/.test(card(off)));

const on = await boot({ local: local({ showPaymentReminders: true }) });
t.check('payment reminders shown when enabled in settings', /דנה כהן/.test(card(on)) && !/אין תזכורות כרגע/.test(card(on)));
t.done();
