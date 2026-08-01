/**
 * ============================================================
 * UniBot — role-play consistency test
 * ------------------------------------------------------------
 * Checks something the accuracy score alone cannot: that the SAME
 * question asked in many different ways always reaches the same
 * intent. A user should not have to guess the magic wording.
 *
 * For each group of paraphrases it reports how many landed on the
 * expected intent, and prints every wording that did not, so the
 * training data can be widened exactly where real phrasings fail.
 *
 * Run with:  npm run chatbot:roleplay
 * ============================================================
 */

require('dotenv').config();
const { trainBot, classify } = require('./service');
const { STUDENT, COORDINATOR, ADMIN } = require('./roleplay.testset');

const ROLES = [
  ['STUDENT', STUDENT],
  ['COORDINATOR', COORDINATOR],
  ['ADMIN', ADMIN],
];

(async () => {
  console.log('Training UniBot…\n');
  await trainBot();

  let grandTotal = 0;
  let grandOk = 0;
  const weakGroups = [];

  for (const [roleName, groups] of ROLES) {
    let roleTotal = 0;
    let roleOk = 0;

    console.log('='.repeat(72));
    console.log(`${roleName}`);
    console.log('='.repeat(72));

    for (const group of groups) {
      const misses = [];
      for (const ask of group.asks) {
        const { intent } = await classify(ask);
        if (intent !== group.intent) misses.push({ ask, intent });
      }

      const ok = group.asks.length - misses.length;
      roleTotal += group.asks.length;
      roleOk += ok;

      const pct = (ok / group.asks.length) * 100;
      const mark = pct === 100 ? ' ok ' : pct >= 70 ? 'warn' : 'FAIL';
      console.log(`\n  [${mark}] ${ok}/${group.asks.length}  ${group.why}`);
      console.log(`         expects ${group.intent}`);

      misses.forEach((m) => console.log(`         MISS  "${m.ask}"  ->  ${m.intent}`));
      if (pct < 100) weakGroups.push({ roleName, group, misses });
    }

    grandTotal += roleTotal;
    grandOk += roleOk;
    console.log(`\n  ${roleName} TOTAL: ${roleOk}/${roleTotal}  (${((roleOk / roleTotal) * 100).toFixed(1)}%)\n`);
  }

  console.log('='.repeat(72));
  console.log(`CONSISTENCY ACROSS PHRASINGS: ${((grandOk / grandTotal) * 100).toFixed(1)}%   (${grandOk}/${grandTotal})`);
  console.log('='.repeat(72));

  if (weakGroups.length) {
    console.log(`\n${weakGroups.length} question group(s) are not fully consistent:`);
    weakGroups.forEach((w) => {
      console.log(`  ${w.roleName} — ${w.group.intent}: ${w.misses.length} wording(s) missed`);
    });
  } else {
    console.log('\nEvery phrasing of every question reached the expected intent.');
  }

  console.log('');
  process.exit(0);
})().catch((err) => { console.error(err); process.exit(1); });
