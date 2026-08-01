/**
 * Held-out evaluation questions for UniBot.
 * None of these appear in the training data in chatbot/intents.js.
 * Batch 1 was iterated against while tuning; batch 2 was written after the
 * training data was frozen and never used to tune it.
 */

const TEST_SET = [
  // --- status of a complaint ---
  ['where has my complaint got to', 'data.complaint.status'],
  ['any movement on my complaint', 'data.complaint.status'],
  // "the latest on my complaint" reads equally as "current status" or
  // "most recent complaint"; both replies show the same record and status.
  ['whats the latest on my complaint', ['data.complaint.status', 'data.complaint.latest']],
  ['can you check my complaint for me', 'data.complaint.status'],
  ['i want an update on my complaint', 'data.complaint.status'],

  // --- yes/no resolution checks ---
  ['has my complaint been sorted out yet', 'data.complaint.check'],
  ['did they end up fixing it', 'data.complaint.check'],
  ['is that complaint closed now', 'data.complaint.check'],
  ['has my issue been resolved or not', 'data.complaint.check'],
  ['is my complaint finished', 'data.complaint.check'],

  // --- topic reference ---
  ['what about my complaint regarding the course registration', 'data.complaint.about'],
  ['the complaint i raised about the internet', 'data.complaint.about'],
  ['what happened to my complaint about the mess food', 'data.complaint.about'],
  ['update on the one about my fee voucher', 'data.complaint.about'],

  // --- listing ---
  ['can i see everything i have submitted', 'data.complaint.list'],
  ['bring up my complaints', 'data.complaint.list'],
  ['what have i got open with you', 'data.complaint.list'],

  // --- counting ---
  ['how many have i put in altogether', 'data.complaint.count'],
  ['whats my total number of complaints', 'data.complaint.count'],
  ['how many have been resolved so far', 'data.complaint.count'],

  // --- pending ---
  ['what of mine is still outstanding', 'data.complaint.pending'],
  ['anything not finished yet', 'data.complaint.pending'],
  ['which ones have not been closed', 'data.complaint.pending'],

  // --- resolved ---
  ['which of mine have been sorted', 'data.complaint.resolved'],
  ['list the ones that are finished', 'data.complaint.resolved'],

  // --- rejected ---
  ['did any of mine get turned down', 'data.complaint.rejected'],
  ['show me what was declined', 'data.complaint.rejected'],

  // --- latest / oldest / urgent ---
  ['what did i file last', 'data.complaint.latest'],
  ['which one has been sitting the longest', 'data.complaint.oldest'],
  ['what is taking forever', 'data.complaint.oldest'],
  ['anything marked as critical', 'data.complaint.urgent'],
  ['what are the top priority items', 'data.complaint.urgent'],

  // --- handler / duration / next ---
  ['who has got my complaint', 'data.complaint.handler'],
  ['which coordinator is dealing with it', 'data.complaint.handler'],
  ['how many days has my complaint been sitting there', 'data.complaint.duration'],
  ['how much longer do i need to wait', 'data.complaint.duration'],
  ['is there anything i need to do', 'data.complaint.next'],
  ['what happens from here', 'data.complaint.next'],

  // --- notifications ---
  ['have i got any new alerts', 'data.notifications'],
  ['anything new i should see', 'data.notifications'],

  // --- staff analytics ---
  ['which department is getting the most complaints', 'data.stats.departments'],
  ['show me how each department is doing', 'data.stats.departments'],
  ['who is the top rated coordinator', 'data.stats.coordinators'],
  ['how well am i doing', 'data.stats.coordinators'],
  ['what is the mean time to resolve', 'data.stats.performance'],
  ['give me a summary of the whole system', 'data.stats.performance'],
  ['how many still need assigning', 'data.stats.unassigned'],
  ['what has come in that i have not looked at', 'data.stats.unassigned'],
  ['what is the most important thing for me to do', 'data.stats.workload'],
  ['help me decide what to tackle first', 'data.stats.workload'],

  // --- FAQs ---
  ['where do i go to raise a new issue', 'faq.submit'],
  ['i need to put in a complaint', 'faq.submit'],
  ['explain what in progress means', 'faq.status.meaning'],
  ['what is the difference between submitted and assigned', 'faq.status.meaning'],
  ['typically how many days until something is fixed', 'faq.time'],
  ['am i able to add a picture', 'faq.attachment'],
  ['is there a size limit on uploads', 'faq.attachment'],
  ['will anyone know it was me', 'faq.anonymous'],
  ['the issue has come back what now', 'faq.reopen'],
  ['where do i leave a rating', 'faq.feedback'],
  ['how can i keep an eye on my complaint', 'faq.track'],
  ['what sort of issues are covered', 'faq.categories'],
  ['who should i speak to about this', 'faq.contact'],
  ['on what basis would something be turned down', 'faq.reject'],

  // --- small talk ---
  ['good evening', 'chat.greeting'],
  ['hey unibot', 'chat.greeting'],
  ['much appreciated', 'chat.thanks'],
  ['thanks for the help', 'chat.thanks'],
  ['ok that is everything', 'chat.bye'],
  ['what sort of things can i ask', 'chat.help'],
  ['tell me what you are capable of', 'chat.help'],

  // --- out of scope: must be rejected, not guessed ---
  ['what is the capital of australia', 'None'],
  ['how do i make a cup of tea', 'None'],
  ['who won the world cup', 'None'],
  ['what is the square root of 144', 'None'],
  ['recommend a good restaurant nearby', 'None'],
  ['tell me about quantum physics', 'None'],
  ['asdkjh askjdh askjd', 'None'],
  ['what is the price of gold today', 'None'],

  /* ------------------------------------------------------------------
   * BATCH 2 — written after the training data was finalised and never
   * used to tune it. This is the fairest measure of generalisation:
   * batch 1 has been iterated against, batch 2 has not.
   * ------------------------------------------------------------------ */
  ['has anything moved on my complaint', 'data.complaint.status'],
  ['give me the current state of my complaint', 'data.complaint.status'],
  ['did my complaint get fixed in the end', 'data.complaint.check'],
  ['is my issue closed off now', 'data.complaint.check'],
  ['what about the complaint i made about the hostel water', 'data.complaint.about'],
  ['the one i logged regarding my transcript', 'data.complaint.about'],
  ['put all my complaints on screen', 'data.complaint.list'],
  ['what is the count of my complaints', 'data.complaint.count'],
  ['how many are sitting unresolved', ['data.complaint.count', 'data.complaint.pending']],
  ['what of mine has not been dealt with', 'data.complaint.pending'],
  ['show everything that is done', 'data.complaint.resolved'],
  ['were any of mine thrown out', 'data.complaint.rejected'],
  ['what is the newest thing i filed', 'data.complaint.latest'],
  ['which of mine is the most overdue', 'data.complaint.oldest'],
  ['what needs urgent attention', 'data.complaint.urgent'],
  ['which staff member is looking after my complaint', 'data.complaint.handler'],
  ['how many days have i been waiting on this', 'data.complaint.duration'],
  ['do i have to do anything else', 'data.complaint.next'],
  ['show me the full record of what happened', 'data.complaint.timeline'],
  ['what activity has there been on it', 'data.complaint.timeline'],
  ['what type of issue do i raise most often', 'data.complaint.breakdown'],
  ['split my complaints up by type', 'data.complaint.breakdown'],
  ['is there anything i still need to score', 'data.complaint.feedback'],
  ['which of mine are awaiting a rating from me', 'data.complaint.feedback'],
  ['are there any messages waiting for me', 'data.notifications'],
  ['which section receives the most complaints', 'data.stats.departments'],
  ['rank the coordinators for me', 'data.stats.coordinators'],
  ['what is our average turnaround', 'data.stats.performance'],
  ['what is stacked up needing approval', 'data.stats.unassigned'],
  ['what ought i to handle first', 'data.stats.workload'],
  ['how do i lodge something new', 'faq.submit'],
  ['what does the assigned label indicate', 'faq.status.meaning'],
  ['can proof be attached to a complaint', 'faq.attachment'],
  ['is it possible to stay unnamed', 'faq.anonymous'],
  ['the fault has returned what do i do', 'faq.reopen'],
  ['how do i leave a score for the department', 'faq.feedback'],
  ['which areas does this system cover', 'faq.categories'],
  ['morning', 'chat.greeting'],
  ['that is really helpful thanks', 'chat.thanks'],
  ['give me a rundown of your abilities', 'chat.help'],
  ['what is the tallest building in the world', 'None'],
  ['how many calories in a banana', 'None'],
  ['translate hello into french', 'None'],
  ['who directed inception', 'None'],
];

module.exports = { TEST_SET };
