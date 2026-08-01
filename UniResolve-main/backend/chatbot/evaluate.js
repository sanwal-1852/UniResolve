/**
 * ============================================================
 * UniBot — accuracy evaluation harness
 * ------------------------------------------------------------
 * Measures intent-classification accuracy on a HELD-OUT test set:
 * every question below is phrased differently from the training
 * examples in intents.js, so this measures generalisation rather
 * than memorisation.
 *
 * Run with:  npm run chatbot:test
 *
 * Reports overall accuracy, per-intent accuracy, the out-of-scope
 * rejection rate, and every individual misclassification so the
 * training data can be improved where it is actually weak.
 * ============================================================
 */

require('dotenv').config();
const { trainBot, classify, getStats, THRESHOLD } = require('./service');
const { PARAPHRASE_SET } = require('./paraphrase.testset');

/**
 * [question, expected intent] — none of these appear in the training data.
 *
 * A handful of questions are genuinely ambiguous between two intents that
 * would both give the user a correct, useful answer. Those list an array of
 * acceptable intents rather than a single one, and are marked with a comment
 * explaining why. Everything else demands one exact intent.
 */
const { TEST_SET } = require('./evaluate.testset');


function pad(s, n) { return String(s).padEnd(n); }

(async () => {
  console.log('Training UniBot…\n');
  await trainBot();
  const s = getStats();
  console.log(`Training set : ${s.utterances} phrases across ${s.intents} intents`);
  console.log(`Test set     : ${TEST_SET.length} held-out questions (none appear in training)`);
  console.log(`Threshold    : ${THRESHOLD}\n`);

  const perIntent = {};
  const failures = [];
  let correct = 0;
  let ambiguous = 0;

  for (const [question, expectedSpec] of TEST_SET) {
    const accepted = Array.isArray(expectedSpec) ? expectedSpec : [expectedSpec];
    const primary = accepted[0];
    if (accepted.length > 1) ambiguous += 1;

    const { intent, score } = await classify(question);
    const ok = accepted.includes(intent);
    if (ok) correct += 1;
    else failures.push({ question, expected: accepted.join(' | '), got: intent, score });

    perIntent[primary] = perIntent[primary] || { total: 0, correct: 0 };
    perIntent[primary].total += 1;
    if (ok) perIntent[primary].correct += 1;
  }

  const accuracy = (correct / TEST_SET.length) * 100;

  // In-scope vs out-of-scope broken out separately: rejecting nonsense
  // correctly is a different capability from classifying real questions.
  const oos = TEST_SET.filter(([, e]) => e === 'None');
  const inScope = TEST_SET.filter(([, e]) => e !== 'None');
  const oosCorrect = oos.length - failures.filter((f) => f.expected === 'None').length;
  const inCorrect = inScope.length - failures.filter((f) => f.expected !== 'None').length;

  console.log('─'.repeat(62));
  console.log(`OVERALL ACCURACY        ${accuracy.toFixed(1)}%   (${correct}/${TEST_SET.length})`);
  console.log(`In-scope accuracy       ${((inCorrect / inScope.length) * 100).toFixed(1)}%   (${inCorrect}/${inScope.length})`);
  console.log(`Out-of-scope rejection  ${((oosCorrect / oos.length) * 100).toFixed(1)}%   (${oosCorrect}/${oos.length})`);
  console.log('─'.repeat(62));

  console.log('\nPer-intent accuracy:');
  Object.entries(perIntent)
    .sort((a, b) => (a[1].correct / a[1].total) - (b[1].correct / b[1].total))
    .forEach(([intent, r]) => {
      const pct = (r.correct / r.total) * 100;
      const mark = pct === 100 ? 'ok  ' : pct >= 50 ? 'warn' : 'FAIL';
      console.log(`  ${mark}  ${pad(intent, 28)} ${pad(`${r.correct}/${r.total}`, 7)} ${pct.toFixed(0)}%`);
    });

  if (failures.length) {
    console.log(`\nMisclassifications (${failures.length}):`);
    failures.forEach((f) => {
      console.log(`  "${f.question}"`);
      console.log(`     expected ${f.expected}  ->  got ${f.got} (${f.score.toFixed(2)})`);
    });
  } else {
    console.log('\nNo misclassifications.');
  }

  console.log('');
  process.exit(failures.length > TEST_SET.length * 0.2 ? 1 : 0);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
