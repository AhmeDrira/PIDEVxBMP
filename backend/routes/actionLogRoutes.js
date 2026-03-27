const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const {
  listActionLogs,
  deleteActionLog,
  deleteManyActionLogs,
} = require('../controllers/actionLogController');

const router = express.Router();

router.get('/', protect, admin, listActionLogs);
router.delete('/:id', protect, admin, deleteActionLog);
router.post('/bulk-delete', protect, admin, deleteManyActionLogs);

module.exports = router;
