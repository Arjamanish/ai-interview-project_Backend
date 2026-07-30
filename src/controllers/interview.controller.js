const PDFParse = require("pdf-parse");
const {
    generateInterviewReport,
} = require("../services/ai.service");
const { buildResumePdf } = require("../services/resume.service");
const { resolveAtsResume } = require("../services/resume.helper");
const { deriveReportTitle } = require("../utils/reportTitle");
const interviewReportModel = require("../models/interviewReport.model");

async function generateInterviewReportController(req, res) {
    try {
        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: "Resume PDF is required.",
            });
        }

        const { selfDescription, jobDescription } = req.body;

        if (!selfDescription || !jobDescription) {
            return res.status(400).json({
                success: false,
                message: "Job Description and Self Description are required.",
            });
        }

        let resumeContent;

        try {
            const pdf = new PDFParse.PDFParse(
                Uint8Array.from(req.file.buffer)
            );

            resumeContent = await pdf.getText();
        } catch (error) {
            console.error("PDF Parse Error:", error);

            return res.status(400).json({
                success: false,
                message: "Unable to read the uploaded PDF.",
            });
        }

        if (!resumeContent.text || !resumeContent.text.trim()) {
            return res.status(400).json({
                success: false,
                message: "No readable text found in the uploaded resume.",
            });
        }

        const interviewReportByAI =
            await generateInterviewReport({
                resume: resumeContent.text,
                selfDescription,
                jobDescription,
            });

        if (!interviewReportByAI) {
            return res.status(502).json({
                success: false,
                message:
                    "Unable to generate interview report right now. The AI service may be rate-limited — please wait a minute and try again.",
            });
        }

        const interviewReport = await interviewReportModel.create({
            user: req.user.id,
            resume: resumeContent.text,
            selfDescription,
            jobDescription,
            ...interviewReportByAI,
            title: deriveReportTitle({
                title: interviewReportByAI.title,
                jobDescription,
            }),
        });

        return res.status(201).json({
            success: true,
            message: "Interview report generated successfully.",
            interviewReport,
        });
    } catch (error) {
        console.error("Interview Controller Error:", error.message || error);

        const status = error?.status === 429 ? 429 : 500;
        const message =
            status === 429
                ? "AI quota exceeded. Please wait a minute and try again."
                : "Internal Server Error";

        return res.status(status).json({
            success: false,
            message,
            error:
                process.env.NODE_ENV === "development"
                    ? error.message
                    : undefined,
        });
    }
}

/**
 * Get Interview Report by ID
 */
async function getInterviewReportByIdContoller(req, res) {
    try {
        const { interviewId } = req.params;

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewId,
            user: req.user.id,
        });

        if (!interviewReport) {
            return res.status(404).json({
                success: false,
                message: "Interview report not found.",
            });
        }

        if (!interviewReport.title?.trim()) {
            interviewReport.title = deriveReportTitle(interviewReport);
            await interviewReportModel.updateOne(
                { _id: interviewReport._id },
                { $set: { title: interviewReport.title } }
            );
        }

        return res.status(200).json({
            success: true,
            message: "Interview report fetched successfully.",
            interviewReport,
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
}

/**
 * Get All Interview Reports
 */
async function getAllInterviewReportsController(req, res) {
    try {
        const interviewReports = await interviewReportModel
            .find({
                user: req.user.id,
            })
            .sort({ createdAt: -1 })
            .select(
                "-resume -selfDescription -jobDescription -__v -technicalQuestions -behavioralQuestions -skillGaps -preparationPlan"
            );

        return res.status(200).json({
            success: true,
            message: "Interview reports fetched successfully.",
            interviewReports: interviewReports ?? [],
        });
    } catch (error) {
        console.error(error);

        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
}

async function getResumePreviewController(req, res) {
    try {
        const { interviewId } = req.params;
        const regenerate = req.query.regenerate === "true";

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewId,
            user: req.user.id,
        });

        if (!interviewReport) {
            return res.status(404).json({
                success: false,
                message: "Interview report not found.",
            });
        }

        const resumeData = await resolveAtsResume(interviewReport, { regenerate });

        if (!resumeData) {
            return res.status(502).json({
                success: false,
                message: "Unable to generate ATS resume content.",
            });
        }

        return res.status(200).json({
            success: true,
            message: regenerate
                ? "ATS resume regenerated successfully."
                : "ATS resume fetched successfully.",
            atsResume: resumeData,
        });
    } catch (error) {
        console.error("Resume Preview Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to load resume preview.",
        });
    }
}

async function generateResumePdfController(req, res) {
    try {
        const { interviewId } = req.params;
        const regenerate = req.query.regenerate === "true";

        const interviewReport = await interviewReportModel.findOne({
            _id: interviewId,
            user: req.user.id,
        });

        if (!interviewReport) {
            return res.status(404).json({
                success: false,
                message: "Interview report not found.",
            });
        }

        const resumeData = await resolveAtsResume(interviewReport, { regenerate });

        if (!resumeData) {
            return res.status(502).json({
                success: false,
                message: "Unable to generate ATS resume content.",
            });
        }

        const pdfBuffer = await buildResumePdf(resumeData);
        const safeName = (interviewReport.title || "resume")
            .replace(/[^a-z0-9]+/gi, "-")
            .replace(/^-|-$/g, "")
            .toLowerCase();

        res.setHeader("Content-Type", "application/pdf");
        res.setHeader(
            "Content-Disposition",
            `attachment; filename="${safeName || "resume"}-ats.pdf"`
        );
        return res.status(200).send(pdfBuffer);
    } catch (error) {
        console.error("Resume PDF Error:", error);
        return res.status(500).json({
            success: false,
            message: "Failed to generate resume PDF.",
        });
    }
}

async function deleteInterviewReportController(req, res) {
    try {
        const { interviewId } = req.params;

        const deleted = await interviewReportModel.findOneAndDelete({
            _id: interviewId,
            user: req.user.id,
        });

        if (!deleted) {
            return res.status(404).json({
                success: false,
                message: "Interview report not found.",
            });
        }

        return res.status(200).json({
            success: true,
            message: "Interview report deleted successfully.",
        });
    } catch (error) {
        console.error(error);
        return res.status(500).json({
            success: false,
            message: "Internal Server Error",
        });
    }
}

module.exports = {
    generateInterviewReportController,
    getInterviewReportByIdContoller,
    getAllInterviewReportsController,
    deleteInterviewReportController,
    generateResumePdfController,
    getResumePreviewController,
};