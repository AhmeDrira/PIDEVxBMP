const express = require('express');
const { protect, admin } = require('../middleware/authMiddleware');
const {
	createReport,
	getMyReports,
	getAdminReports,
	updateReportStatus,
} = require('../controllers/reportController');

const router = express.Router();

router.post('/', protect, createReport);
router.get('/me', protect, getMyReports);
router.get('/admin', protect, admin, getAdminReports);
router.patch('/admin/:id/status', protect, admin, updateReportStatus);

module.exports = router;
