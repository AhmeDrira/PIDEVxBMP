const express = require('express');
const router = express.Router();
const {
  getEvents,
  getPublicEvents,
  createEvent,
  updateEvent,
  deleteEvent,
} = require('../controllers/calendarController');
const { protect } = require('../middleware/authMiddleware');

// Public route: expert views artisan's public calendar
router.get('/public/:artisanId', getPublicEvents);

// Protected routes: artisan manages their own calendar
router.get('/', protect, getEvents);
router.post('/', protect, createEvent);
router.put('/:id', protect, updateEvent);
router.delete('/:id', protect, deleteEvent);

module.exports = router;
