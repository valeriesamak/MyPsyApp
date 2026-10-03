import { boot, reporter, localDay } from './harness.mjs';
const t = reporter();
const mk = (id, d) => ({ id, patientId: 'p1', date: localDay(d), startTime: '10:00', duration: 50, status: 'completed', paid: true });
const app = await boot({ local: { schemaVersion: 2, patients: [{ id: 'p1', name: 'דנה כהן', sessionRate: 300, payerType: 'private' }],
  appointments: [mk('w1', -3), mk('w3', -20), mk('w9', -45)], payments: [] } });
const card = [...app.window.document.querySelectorAll('h3')].find((h) => /תזכורות/.test(h.textContent)).closest('.card');
t.check('3-day-old missing summary listed', (card.textContent.match(/לכתוב סיכום פגישה/g) || []).length >= 1);
t.check('20-day-old missing summary now listed (was dropped after 7 days)', /תזכורות \(2\)/.test(card.querySelector('h3').textContent));
t.check('45-day-old one not resurrected', !/תזכורות \(3\)/.test(card.querySelector('h3').textContent));
t.done();
