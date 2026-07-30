const interviewReportModel = require("../models/interviewReport.model");
const { generateAtsResume } = require("./ai.service");
const { deriveReportTitle } = require("../utils/reportTitle");

async function ensureReportTitle(interviewReport) {
    const title = deriveReportTitle(interviewReport);

    if (interviewReport.title?.trim() === title) {
        return title;
    }

    await interviewReportModel.updateOne(
        { _id: interviewReport._id },
        { $set: { title } }
    );

    interviewReport.title = title;
    return title;
}

async function persistAtsResume(interviewReportId, resumeData) {
    await interviewReportModel.updateOne(
        { _id: interviewReportId },
        { $set: { atsResume: resumeData } }
    );
}

async function resolveAtsResume(interviewReport, { regenerate = false } = {}) {
    if (!regenerate && interviewReport.atsResume) {
        return interviewReport.atsResume;
    }

    const title = await ensureReportTitle(interviewReport);

    const resumeData = await generateAtsResume({
        resume: interviewReport.resume,
        selfDescription: interviewReport.selfDescription,
        jobDescription: interviewReport.jobDescription,
        title,
        skillGaps: interviewReport.skillGaps,
    });

    if (!resumeData) return null;

    await persistAtsResume(interviewReport._id, resumeData);
    interviewReport.atsResume = resumeData;

    return resumeData;
}

module.exports = { resolveAtsResume, ensureReportTitle, persistAtsResume };
