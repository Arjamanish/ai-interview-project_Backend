const express = require("express");

const authMiddleware = require("../middlewares/auth.middleware");
const upload = require("../middlewares/file.middleware");
const interviewController = require("../controllers/interview.controller");

const interviewRouter = express.Router();

/**
 * ======================================================
 * @route   POST /api/interview
 * @desc    Generate Interview Report
 * @access  Private
 * ======================================================
 */
interviewRouter.post(
    "/",
    authMiddleware.authUser,
    upload.single("resume"),
    interviewController.generateInterviewReportController
);

/**
 * ======================================================
 * @route   GET /api/interview/report/:interviewId
 * @desc    Get Interview Report by ID
 * @access  Private
 * ======================================================
 */
interviewRouter.get(
    "/report/:interviewId",
    authMiddleware.authUser,
    interviewController.getInterviewReportByIdContoller
);

/**
 * ======================================================
 * @route   GET /api/interview
 * @desc    Get All Interview Reports
 * @access  Private
 * ======================================================
 */
interviewRouter.get(
    "/",
    authMiddleware.authUser,
    interviewController.getAllInterviewReportsController
);

interviewRouter.delete(
    "/report/:interviewId",
    authMiddleware.authUser,
    interviewController.deleteInterviewReportController
);

interviewRouter.post(
    "/report/:interviewId/resume",
    authMiddleware.authUser,
    interviewController.generateResumePdfController
);

interviewRouter.get(
    "/report/:interviewId/resume/preview",
    authMiddleware.authUser,
    interviewController.getResumePreviewController
);

module.exports = interviewRouter;