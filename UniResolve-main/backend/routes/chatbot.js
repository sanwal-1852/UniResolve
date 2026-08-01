const express = require('express');
const rateLimit = require('express-rate-limit');
const { body, validationResult } = require('express-validator');
const { protect } = require('../middleware/auth');
const { askBot, isReady, suggestionsFor } = require('../chatbot/service');

const router = express.Router();

// Keep one chatty tab from hammering the classifier.
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: 60,
  standardHeaders: true,
  legacyHeaders: false,
  message: { success: false, message: 'You are sending messages too quickly. Please wait a moment.' },
});

router.use(protect);

/** Greeting + quick replies shown when the widget opens. */
router.get('/greeting', (req, res) => {
  const firstName = String(req.user.name || '').split(' ')[0];
  res.json({
    success: true,
    ready: isReady(),
    greeting: `Hi ${firstName}! I am **UniBot**. Ask me about your complaints or how the system works.`,
    suggestions: suggestionsFor(req.user.role),
  });
});

router.post(
  '/message',
  chatLimiter,
  [body('message').trim().isLength({ min: 1, max: 500 }).withMessage('Please type a question first')],
  async (req, res, next) => {
    const errors = validationResult(req);
    if (!errors.isEmpty()) {
      return res.status(400).json({ success: false, message: errors.array()[0].msg });
    }

    try {
      const result = await askBot(req.body.message, req.user);
      res.json({
        success: true,
        reply: result.reply,
        intent: result.intent,
        score: Number(result.score.toFixed(3)),
        source: result.source,
        // Follow-up chips offered when confidence was too low to answer.
        suggestions: (result.suggestions || []).map((s) => s.example),
      });
    } catch (err) {
      next(err);
    }
  }
);

module.exports = router;
