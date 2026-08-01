# UniResolve — University of Southern Punjab

University complaint management system with an integrated **rule-free NLP chatbot**.
Built with Node.js, Express, MongoDB, and vanilla HTML/CSS/JavaScript.

---

## Features

**Students** — submit complaints (with up to 5 attachments, optionally anonymous), track status
live, receive notifications, rate the resolution, and request a reopen if the issue returns.

**Coordinators** — see only complaints assigned to them, move work through *In Progress* →
*Resolved*, add coordinator notes, and export reports.

**Admins** — review every complaint, mark *Under Review*, assign/reassign to a department
coordinator with a priority, reject with a reason, review reopen requests, create complaints on a
student's behalf, manage categories/departments/coordinators, and view analytics.

**UniBot (chatbot)** — answers questions about complaints and FAQs in natural language.

---

## Local Setup

### 1. Prerequisites

- Node.js >= 18
- MongoDB >= 6 running locally

### 2. Install and seed

```bash
npm run install:backend
npm run seed
npm start
```

Then open <http://localhost:5000>.

### 3. Demo accounts

```text
Admin        admin@university.edu         admin123
Coordinator  coordinator@university.edu   coord123
Coordinator  maintenance@university.edu   coord123
Student      sarah.j@university.edu       demo123
Student      michael.c@university.edu     demo123
```

> `npm run seed` **wipes and repopulates** the database. Run it once for a fresh demo.

### 4. Database connection

The backend reads `backend/.env`:

```text
MONGO_URI=mongodb://127.0.0.1:27017/usp_complaints
```

Change this if MongoDB runs on a different host, port, or database name.

---

## The Chatbot (UniBot)

UniBot uses **[NLP.js](https://github.com/axa-group/nlp.js) (`node-nlp`)** — a lightweight,
CPU-only NLP library. **No large language model and no external API is used.** Everything runs
inside the Node process and trains in about 130 ms at startup.

### Pipeline

Every message goes through five stages:

1. **Classify** — a small neural network, trained at startup on ~780 example phrases across
   39 intents (`chatbot/intents.js`), decides what kind of question this is. Each phrase is
   also registered in a normalised form (`chatbot/normalise.js`) so synonyms such as
   *grievance*, *knocked back* and *gathering dust* map onto the vocabulary the classifier
   already knows. Questions are read both as written and normalised, and the more confident
   reading wins — so normalisation can only add understanding, never remove it.
2. **Extract** — named entity recognition pulls out the specifics: complaint IDs (`CMP-1042`),
   status, category, department, priority and relative time periods (`chatbot/entities.js`).
3. **Resolve** — works out *which* complaint is meant, in priority order: an explicit ID, a
   keyword match against complaint titles ("my complaint about the course registration"), or
   whatever was being discussed a moment ago (`chatbot/context.js`).
4. **Answer** — queries MongoDB **within the asker's permissions** and phrases the reply for
   their role (`chatbot/answers.js`).
5. **Fall back** — below a 0.55 confidence threshold the bot never guesses. It offers the two
   closest matching topics as clickable suggestions, and logs the question to `ChatLog` so gaps
   in the training data can be found and fixed.

Because the classifier generalises from examples rather than matching keywords, it copes with
typos and rephrasings: *"wats the status of my complaints"* still resolves correctly.

### Measured accuracy

```bash
npm run chatbot:test        # held-out accuracy
npm run chatbot:roleplay    # consistency across phrasings
```

Three separate measurements, because they answer different questions:

| Suite | What it measures | Result |
|---|---|---|
| Held-out (123 questions) | Generalisation — none appear in training | **97.6%** |
| Out-of-scope (12 of those) | Correctly refusing general-knowledge questions | **100%** |
| Role-play (196 phrasings) | Same question asked many ways reaches one intent | **99.5%** |
| Hard paraphrase (28) | Deliberately awkward wording, low word overlap | **53.6%** |

The role-play suite is a *coverage checklist* built by working through each of
the three roles; the held-out suite is the honest *generalisation* metric, and
its questions are never added to training. A handful of held-out questions are
genuinely ambiguous between two intents that would both answer correctly; those
accept either, and say why in a comment.

### What you can ask it

Questions are answered differently depending on who asks. A student means *their* complaints, a
coordinator means the ones *assigned to them*, and an admin means the *whole system* — and the
wording of the reply changes to match.

| | Examples |
|---|---|
| **Students** | "is my complaint resolved?" · "how many are resolved?" · "what about my complaint for the course registration?" · "who is handling it?" · "how long has it been open?" · "what should I do next?" · "show my pending complaints" · "did any of mine get rejected?" |
| **Coordinators** | "what should I work on next?" · "which are still pending?" · "what is my oldest complaint?" · "how am I performing?" · "show me urgent complaints" |
| **Admins** | "what is waiting for review?" · "which department has the most complaints?" · "who is the best performing coordinator?" · "give me an overview" · "how many complaints are there?" |
| **FAQs (all roles)** | "how do I submit a complaint?" · "what does *Assigned* mean?" · "how long does it take?" · "can I attach a photo?" · "can I complain anonymously?" · "how do I reopen a complaint?" |

**Follow-up questions work.** Ask about a complaint, then simply say *"is it resolved?"*,
*"who is handling it?"* or *"how long has it been open?"* — the bot remembers which complaint you
were discussing for 30 minutes.

**Filters are understood.** "How many *hostel* complaints do I have?", "show my *resolved*
complaints", "any *urgent* ones?" all narrow the query correctly.

### Files

```text
backend/chatbot/intents.js     training phrases + FAQ answers
backend/chatbot/normalise.js   synonym / idiom vocabulary mapping (zero dependencies)
backend/chatbot/entities.js    entity definitions + topic keyword matching
backend/chatbot/context.js     30-minute conversation memory
backend/chatbot/answers.js     role-aware answer engine
backend/chatbot/service.js     training, classification, fallback handling
backend/chatbot/evaluate.js    held-out accuracy harness (npm run chatbot:test)
backend/chatbot/roleplay.js    phrasing-consistency harness (npm run chatbot:roleplay)
backend/models/ChatLog.js      records questions the bot could not answer
backend/routes/chatbot.js      GET /api/chatbot/greeting, POST /api/chatbot/message
public/js/chatbot.js           floating chat widget
```

The widget keeps its conversation across page navigation, and complaint IDs in replies are
clickable — they open that complaint's detail modal.

---

## Complaint Lifecycle

```text
Submitted ──► Under Review ──► Assigned ──► In Progress ──► Resolved
     │              │                                          │
     └──────────────┴──► Rejected (with reason)                 └──► Reopen Requested
```

---

## Project Structure

```text
backend/
  server.js              Express app, static hosting, startup
  config/db.js           MongoDB connection
  config/seed.js         demo data generator
  config/complaint-templates.js  realistic complaint scenarios
  models/                User, Complaint, Category, Department, Notification, ChatLog
  routes/                auth, complaints, admin, chatbot
  middleware/            JWT auth + role guards, error handler
  chatbot/               intents, entities, context, answers, evaluation
  uploads/               complaint attachments
public/
  *.html                 pages
  css/style.css          design system
  js/main.js             application logic
  js/chatbot.js          chat widget
  vendor/                Bootstrap 5.3.3, Bootstrap Icons, Chart.js 4.4.4
```

All front-end libraries are **vendored locally** — the app runs with no internet connection.

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js 18+ |
| Server | Express 4 |
| Database | MongoDB 6+ / Mongoose 8 |
| Auth | JWT (`jsonwebtoken`) + bcrypt password hashing |
| Uploads | Multer (5 MB/file, max 5 files) |
| NLP | NLP.js (`node-nlp`) — intent classification + NER, CPU only, no LLM |
| Charts | Chart.js 4.4.4 |
| UI | Bootstrap 5.3.3 + custom design system |

---

## Security Notes

- Passwords are hashed with bcrypt and never returned by the API.
- All `/api` routes are rate limited; the chatbot has its own tighter limit.
- Every complaint route enforces role scoping server-side — a student cannot read another
  student's complaint even by guessing its ID.
- Anonymous complaints have the student's identity stripped before the response leaves the server.
