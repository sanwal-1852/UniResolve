/**
 * ============================================================
 * Role-play question bank
 * ------------------------------------------------------------
 * Written by working through each of the three roles and asking
 * "how would a real person actually phrase this?" — polite and
 * blunt, full sentences and fragments, formal and casual, with
 * and without question marks.
 *
 * Every group below is the SAME underlying question asked many
 * different ways. The classifier must land them all on the same
 * intent, because the user's wording should not change what the
 * system understands.
 *
 * Used by chatbot/roleplay.js.
 * ============================================================
 */

/* ============================================================
   STUDENT — cares about their own complaints
   ============================================================ */
const STUDENT = [
  {
    intent: 'data.complaint.check',
    why: 'Has my complaint been resolved? — a yes/no question',
    asks: [
      'is my complaint resolved',
      'is my complaint resolved?',
      'has my complaint been resolved yet',
      'did my complaint get resolved',
      'is it fixed now',
      'has it been sorted',
      'is my issue closed',
      'tell me if my complaint is done',
      'complaint resolved or not',
      'has anyone actually resolved it',
    ],
  },
  {
    intent: 'data.complaint.status',
    why: 'Where does my complaint stand right now?',
    asks: [
      'what is the status of my complaint',
      'status of my complaint',
      'my complaint status please',
      'whats happening with my complaint',
      'any update on my complaint',
      'update please',
      'where is my complaint at',
      'can you check my complaint',
      'i want to know about my complaint',
      'give me an update on my complaint',
    ],
  },
  {
    intent: 'data.complaint.count',
    why: 'How many complaints do I have?',
    asks: [
      'how many complaints do i have',
      'how many complaints have i submitted',
      'count my complaints',
      'total complaints i have',
      'number of complaints i submitted',
      'how many have i submitted in total',
      'how many complaints are mine',
    ],
  },
  {
    intent: 'data.complaint.pending',
    why: 'Which of mine are still open?',
    asks: [
      'which complaints are still pending',
      'show my pending complaints',
      'what is still pending',
      'anything still open',
      'which ones are not resolved yet',
      'what have i got outstanding',
      'list my open complaints',
      'show me what is unresolved',
    ],
  },
  {
    intent: 'data.complaint.resolved',
    why: 'Which of mine are done?',
    asks: [
      'show my resolved complaints',
      'which complaints are resolved',
      'list the resolved ones',
      'what has been resolved',
      'show me the completed complaints',
      'which of mine are finished',
    ],
  },
  {
    intent: 'data.complaint.handler',
    why: 'Who is dealing with my complaint?',
    asks: [
      'who is handling my complaint',
      'who is handling my complaints',
      'who is working on my complaint',
      'who has my complaint',
      'which coordinator is handling it',
      'who is responsible for my complaint',
      'who will fix my complaint',
      'which department has my complaint',
      'who is looking into it',
    ],
  },
  {
    intent: 'data.complaint.duration',
    why: 'How long has this been going on?',
    asks: [
      'how long has my complaint been open',
      'how many days has it been pending',
      'how long have i been waiting',
      'when will my complaint be resolved',
      'how much longer will it take',
      'how old is my complaint',
    ],
  },
  {
    intent: 'data.complaint.timeline',
    why: 'What has actually happened on it?',
    asks: [
      'what has happened with my complaint',
      'show me the history',
      'what updates have there been',
      'show the progress so far',
      'what has been done on my complaint',
      'give me the timeline',
    ],
  },
  {
    intent: 'data.complaint.next',
    why: 'Is anything required from me?',
    asks: [
      'what should i do next',
      'what happens now',
      'do i need to do anything',
      'is there anything required from me',
      'what is the next step',
      'anything i should be doing',
    ],
  },
  {
    intent: 'data.complaint.rejected',
    why: 'Were any of mine rejected?',
    asks: [
      'show my rejected complaints',
      'were any of my complaints rejected',
      'did any get rejected',
      'which of mine were rejected',
      'anything rejected',
    ],
  },
  {
    intent: 'data.complaint.latest',
    why: 'My most recent one',
    asks: [
      'what is my latest complaint',
      'my most recent complaint',
      'the last complaint i submitted',
      'show me my newest complaint',
      'what did i submit last',
    ],
  },
  {
    intent: 'data.complaint.feedback',
    why: 'What can I rate?',
    asks: [
      'which complaints can i rate',
      'do i need to give feedback',
      'anything waiting for my rating',
      'have i rated everything',
      'which ones still need feedback',
    ],
  },
  {
    intent: 'data.notifications',
    why: 'Any updates for me?',
    asks: [
      'do i have any notifications',
      'any new notifications',
      'show my notifications',
      'anything new for me',
      'any messages',
    ],
  },
  {
    intent: 'faq.submit',
    why: 'How do I raise a complaint?',
    asks: [
      'how do i submit a complaint',
      'how to file a complaint',
      'i want to submit a complaint',
      'where do i submit a complaint',
      'how can i complain about something',
      'how do i report an issue',
    ],
  },
  {
    intent: 'faq.status.meaning',
    why: 'What do these labels mean?',
    asks: [
      'what do the statuses mean',
      'what does assigned mean',
      'what does in progress mean',
      'explain the statuses',
      'meaning of under review',
    ],
  },
  {
    intent: 'faq.anonymous',
    why: 'Can I stay anonymous?',
    asks: [
      'can i submit anonymously',
      'can i complain anonymously',
      'will my name be shown',
      'is my complaint confidential',
      'can i hide my name',
    ],
  },
  {
    intent: 'faq.reopen',
    why: 'The problem came back',
    asks: [
      'how do i reopen a complaint',
      'can i reopen my complaint',
      'the problem is back what do i do',
      'my issue happened again',
      'it was not really fixed what now',
    ],
  },
  {
    intent: 'faq.attachment',
    why: 'Can I attach evidence?',
    asks: [
      'can i attach a file',
      'can i upload a photo',
      'how do i add proof',
      'what files can i upload',
      'is there a file size limit',
    ],
  },
];

/* ============================================================
   COORDINATOR — cares about their own caseload
   ============================================================ */
const COORDINATOR = [
  {
    intent: 'data.stats.workload',
    why: 'What should I do first?',
    asks: [
      'what should i work on next',
      'what should i do first',
      'what is my priority',
      'where should i start',
      'what needs my attention',
      'help me prioritise',
      'what is most important right now',
    ],
  },
  {
    intent: 'data.complaint.pending',
    why: 'What is still open on my desk?',
    asks: [
      'which are still pending',
      'show my pending complaints',
      'what is still open',
      'what have i not finished',
      'list my unresolved cases',
      'what is left to do',
    ],
  },
  {
    intent: 'data.complaint.count',
    why: 'How big is my caseload?',
    asks: [
      'how many complaints are assigned to me',
      'how many complaints do i have',
      'what is my caseload',
      'count my assigned complaints',
      'how many am i handling',
    ],
  },
  {
    intent: 'data.complaint.urgent',
    why: 'What is urgent?',
    asks: [
      'show urgent complaints',
      'what is high priority',
      'which ones are urgent',
      'anything urgent for me',
      'show me the priority cases',
    ],
  },
  {
    intent: 'data.complaint.oldest',
    why: 'What has been waiting longest?',
    asks: [
      'what is my oldest complaint',
      'which has been open the longest',
      'what has been waiting the longest',
      'show me the oldest case',
      'which one is overdue',
    ],
  },
  {
    intent: 'data.stats.coordinators',
    why: 'How am I doing?',
    asks: [
      'how am i performing',
      'what is my rating',
      'how is my performance',
      'how am i doing',
      'what do students think of my work',
    ],
  },
  {
    intent: 'data.complaint.list',
    why: 'Show me my cases',
    asks: [
      'show me the complaints assigned to me',
      'list my complaints',
      'what is assigned to me',
      'show my cases',
      'what am i handling',
    ],
  },
  {
    intent: 'data.complaint.resolved',
    why: 'What have I closed?',
    asks: [
      'show resolved complaints',
      'what have i resolved',
      'which ones are resolved',
      'list my completed cases',
    ],
  },
];

/* ============================================================
   ADMIN — cares about the whole system
   ============================================================ */
const ADMIN = [
  {
    intent: 'data.stats.unassigned',
    why: 'What needs my review?',
    asks: [
      'what is waiting for review',
      'what needs to be assigned',
      'show unassigned complaints',
      'what is waiting for me',
      'how many are awaiting approval',
      'what is in the queue',
      'what needs my approval',
    ],
  },
  {
    intent: 'data.stats.departments',
    why: 'Department comparison',
    asks: [
      'which department has the most complaints',
      'complaints by department',
      'show department statistics',
      'how are the departments doing',
      'which department is worst',
      'department breakdown',
    ],
  },
  {
    intent: 'data.stats.coordinators',
    why: 'Who is performing well?',
    asks: [
      'which coordinator has the best rating',
      'coordinator performance',
      'who is the best coordinator',
      'how are the coordinators doing',
      'rank the coordinators',
    ],
  },
  {
    intent: 'data.stats.performance',
    why: 'Overall health of the system',
    asks: [
      'give me an overview',
      'what is the average resolution time',
      'overall statistics',
      'how is the system doing',
      'summary of everything',
      'what is the average rating',
    ],
  },
  {
    intent: 'data.complaint.count',
    why: 'System volume',
    asks: [
      'how many complaints are there',
      'total complaints in the system',
      'how many complaints do we have',
      'what is the total count',
    ],
  },
  {
    intent: 'data.complaint.urgent',
    why: 'What is critical right now?',
    asks: [
      'show urgent complaints',
      'what is high priority',
      'which complaints are urgent',
      'anything critical',
    ],
  },
  {
    intent: 'data.complaint.pending',
    why: 'What is still open system-wide?',
    asks: [
      'what is still pending',
      'show pending complaints',
      'which are unresolved',
      'what is still open',
    ],
  },
  {
    intent: 'data.complaint.oldest',
    why: 'What is dragging?',
    asks: [
      'what is the oldest complaint',
      'which has been open longest',
      'what is taking the longest',
      'show the oldest case',
    ],
  },
];

module.exports = { STUDENT, COORDINATOR, ADMIN };
