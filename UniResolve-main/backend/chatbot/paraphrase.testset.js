/**
 * ============================================================
 * Paraphrase stress set
 * ------------------------------------------------------------
 * Questions whose MEANING is unmistakable but whose WORDS barely
 * overlap the training data — "grievance" for complaint,
 * "knocked back" for rejected, "languishing" for oldest.
 *
 * A bag-of-words classifier cannot generalise to these, so this
 * set measures exactly what the semantic embedding layer adds.
 * It is deliberately harsher than real student language.
 * ============================================================
 */

const PARAPHRASE_SET = [
  ['any word back from the university on my grievance', 'data.complaint.status'],
  ['did the people upstairs ever action my grievance', 'data.complaint.status'],
  ['im still in the dark about my submission', 'data.complaint.status'],
  ['has my matter reached a conclusion', 'data.complaint.check'],
  ['tally up everything ive escalated', 'data.complaint.count'],
  ['enumerate my outstanding grievances', 'data.complaint.pending'],
  ['whats gathering dust in my queue', 'data.complaint.pending'],
  ['anything of mine wrapped up successfully', 'data.complaint.resolved'],
  ['was my petition ever knocked back', 'data.complaint.rejected'],
  ['who took ownership of my case', 'data.complaint.handler'],
  ['which individual is accountable for my matter', 'data.complaint.handler'],
  ['how many sunrises since i raised this', 'data.complaint.duration'],
  ['whats languishing the longest in my queue', 'data.complaint.oldest'],
  ['anything on fire that needs me', 'data.complaint.urgent'],
  ['paint me a picture of the whole operation', 'data.stats.performance'],
  ['which faculty is drowning in grievances', 'data.stats.departments'],
  ['whos my star performer', 'data.stats.coordinators'],
  ['whats piling up on my desk', 'data.stats.unassigned'],
  ['point me at the thing that matters most', 'data.stats.workload'],
  ['walk me through raising a grievance', 'faq.submit'],
  ['decode these labels for me', 'faq.status.meaning'],
  ['may i append documentation', 'faq.attachment'],
  ['can my identity remain concealed', 'faq.anonymous'],
  ['the defect resurfaced whats the procedure', 'faq.reopen'],
  ['what is the chronology of my case', 'data.complaint.timeline'],
  ['carve up my grievances by theme', 'data.complaint.breakdown'],

  // Plausible-sounding but out of scope — must still be rejected.
  ['what is the grievance procedure at oxford university', 'None'],
  ['explain machine learning to me', 'None'],
];

module.exports = { PARAPHRASE_SET };
