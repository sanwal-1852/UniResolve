# UniResolve — University of Southern Punjab

A university complaint management system with an integrated natural-language chatbot.

Built with Node.js, Express, MongoDB and vanilla HTML/CSS/JavaScript. The chatbot uses a
lightweight CPU-only NLP library — **no large language model and no external API**, so the whole
application runs offline on a single machine.

---

## Features

**Students** — submit complaints (up to 5 attachments, optionally anonymous), track status live,
receive notifications, rate the resolution, and request a reopen if the problem returns.

**Coordinators** — see only the complaints assigned to them, move work through *In Progress* →
*Resolved*, add coordinator notes, and export reports.

**Admins** — review every complaint, mark *Under Review*, assign or reassign to a department
coordinator with a priority, reject with a recorded reason, review reopen requests, raise
complaints on a student's behalf, manage categories/departments/coordinators, and view analytics.

**UniBot** — answers questions about complaints and how the system works, in natural language,
scoped to whoever is asking.

---

## Local Setup

### 1. Prerequisites

- Node.js >= 18
- MongoDB >= 6 running locally

### 2. Install

```bash
git clone https://github.com/sanwal-1852/UniResolve.git
cd UniResolve
npm run install:backend
```

### 3. Create the environment file

`backend/.env` is **not** in version control because it holds the JWT signing secret.
Copy the example and edit if needed:

```bash
cp UniResolve-main/backend/.env.example UniResolve-main/backend/.env
```

```text
PORT=5000
NODE_ENV=development
MONGO_URI=mongodb://127.0.0.1:27017/usp_complaints
JWT_SECRET=replace-this-with-a-long-secret
JWT_EXPIRES_IN=7d
```

Change `MONGO_URI` if MongoDB runs on a different host, port or database name.

### 4. Seed and run

```bash
npm run seed     # WIPES and repopulates the database
npm start
```

Then open <http://localhost:5000>.

### 5. Demo accounts

The seed creates 25 users. Passwords are shown in full because this is demo data.

| Role | Email | Password |
|---|---|---|
| Admin | `admin@university.edu` | `admin123` |
| Coordinator — IT | `coordinator@university.edu` | `coord123` |
| Coordinator — Maintenance | `maintenance@university.edu` | `coord123` |
| Coordinator — Examination | `exams@university.edu` | `coord123` |
| Coordinator — Hostel | `hostel@university.edu` | `coord123` |
| Coordinator — Accounts | `accounts@university.edu` | `coord123` |
| Coordinator — Transport | `transport@university.edu` | `coord123` |
| Coordinator — Academic | `academics@university.edu` | `coord123` |
| Coordinator — Administration | `administration@university.edu` | `coord123` |
| Student | `sarah.j@university.edu` | `demo123` |
| Student | `michael.c@university.edu` | `demo123` |
| …plus 14 more students | | `demo123` |

---

## Available Scripts

Run from the project root:

| Command | What it does |
|---|---|
| `npm start` | Starts the server on port 5000 |
| `npm run dev` | Same, with nodemon auto-restart |
| `npm run seed` | Wipes and regenerates all demo data |
| `npm run install:backend` | Installs backend dependencies |
| `npm run chatbot:test` | Chatbot accuracy on held-out questions |
| `npm run chatbot:roleplay` | Chatbot consistency across phrasings |

---

## The Chatbot (UniBot)

UniBot uses **[NLP.js](https://github.com/axa-group/nlp.js) (`node-nlp`)** — a lightweight,
CPU-only NLP library. Everything runs inside the Node process and trains in roughly 300 ms at
startup. No model is downloaded, no API is called, and no text leaves the machine.

### Pipeline

Every message goes through five stages:

1. **Classify** — a small neural network, trained at startup on **783 example phrases across 39
   intents** (`chatbot/intents.js`), decides what kind of question this is. Each phrase is also
   registered in a normalised form (`chatbot/normalise.js`, 47 phrase rules + 20 word rules) so
   synonyms such as *grievance*, *knocked back* and *gathering dust* map onto vocabulary the
   classifier already knows. Questions are read both as written and normalised, and the more
   confident reading wins — normalisation can only add understanding, never remove it.
2. **Extract** — named entity recognition pulls out the specifics: complaint IDs (`CMP-1042`),
   status, category, department, priority and relative time periods (`chatbot/entities.js`).
   Entities are always read from the *original* wording, because normalising would corrupt proper
   nouns such as "Hostel Office".
3. **Resolve** — works out *which* complaint is meant, in priority order: an explicit ID, a keyword
   match against complaint titles ("my complaint about the course registration"), or whatever was
   being discussed a moment ago (`chatbot/context.js`, 30-minute memory).
4. **Answer** — queries MongoDB **within the asker's permissions** and phrases the reply for their
   role (`chatbot/answers.js`).
5. **Fall back** — below a 0.55 confidence threshold the bot never guesses. It offers the two
   closest matching topics as clickable suggestions and logs the question to `ChatLog`, so gaps in
   the training data can be found and fixed later.

### Measured accuracy

```bash
npm run chatbot:test        # held-out accuracy
npm run chatbot:roleplay    # consistency across phrasings
```

Three suites, because they answer different questions:

| Suite | What it measures | Result |
|---|---|---|
| Held-out (123 questions) | Generalisation — none appear in training | **97.6%** |
| Out-of-scope (12 of those) | Correctly refusing general-knowledge questions | **100%** |
| Role-play (196 phrasings) | Same question asked many ways → one intent | **99.5%** |
| Hard paraphrase (28) | Deliberately awkward wording, low word overlap | **53.6%** |

The **role-play** suite is a *coverage checklist*, built by working through each of the three roles
and asking how a real person would phrase things. The **held-out** suite is the honest
*generalisation* metric — its questions are never added to the training data. A few held-out
questions are genuinely ambiguous between two intents that would both answer correctly; those
accept either, and a comment explains why.

### What you can ask it

Questions are answered differently depending on who asks. A student means *their* complaints, a
coordinator means the ones *assigned to them*, and an admin means the *whole system* — and the
wording of the reply changes to match.

| | Examples |
|---|---|
| **Students** | "is my complaint resolved?" · "how many are resolved?" · "what about my complaint for the course registration?" · "who is handling it?" · "how long has it been open?" · "what should I do next?" · "which complaints can I rate?" · "what has happened with my complaint?" |
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
backend/chatbot/intents.js            training phrases + FAQ answers
backend/chatbot/normalise.js          synonym / idiom mapping (zero dependencies)
backend/chatbot/entities.js           entity definitions + topic keyword matching
backend/chatbot/context.js            30-minute conversation memory
backend/chatbot/answers.js            role-aware answer engine
backend/chatbot/service.js            training, classification, fallback handling
backend/chatbot/evaluate.js           held-out accuracy harness
backend/chatbot/roleplay.js           phrasing-consistency harness
backend/chatbot/*.testset.js          the three test sets
backend/models/ChatLog.js             records questions the bot could not answer
backend/routes/chatbot.js             GET /api/chatbot/greeting, POST /api/chatbot/message
public/js/chatbot.js                  floating chat widget
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
  server.js                        Express app, static hosting, startup
  config/db.js                     MongoDB connection
  config/seed.js                   demo data generator (deterministic)
  config/complaint-templates.js    realistic complaint scenarios
  models/                          User, Complaint, Category, Department,
                                   Notification, ChatLog
  routes/                          auth, complaints, admin, chatbot
  middleware/                      JWT auth + role guards, error handler
  chatbot/                         intents, normalisation, entities, context,
                                   answers, evaluation harnesses
  uploads/                         complaint attachments
public/
  *.html                           pages
  css/style.css                    design system
  js/main.js                       application logic
  js/chatbot.js                    chat widget
  vendor/                          Bootstrap 5.3.3, Bootstrap Icons, Chart.js 4.4.4
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

All 11 production dependencies are pure JavaScript — nothing needs compiling, so the project moves
between macOS, Windows and Linux without changes.

---

## Security Notes

- Passwords are hashed with bcrypt and never returned by the API.
- All `/api` routes are rate limited; the chatbot has its own tighter limit.
- Every complaint route enforces role scoping server-side — a student cannot read another
  student's complaint even by guessing its ID, and the chatbot obeys the same rules.
- Anonymous complaints have the student's identity stripped before the response leaves the server.
- `backend/.env` is git-ignored so the JWT secret is never published.

---

## Troubleshooting

**`git push` fails with `HTTP 400`** — Git's default buffer is too small for the attachment
images. Run once:

```bash
git config http.postBuffer 524288000
git config http.version HTTP/1.1
```

**`MongoDB connection error`** — MongoDB is not running. Start it, then `npm start` again.

**Chatbot answers "I did not quite catch that"** — the question fell below the confidence
threshold. It is recorded in the `chatlogs` collection so the phrasing can be added to
`chatbot/intents.js`.
