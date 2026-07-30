const { GoogleGenAI } = require("@google/genai");
const { z } = require("zod");
const { normalizeAtsResume } = require("./resume.template");

const ai = new GoogleGenAI({
    apiKey: process.env.GOOGLE_GENAI_API_KEY,
});

const questionSchema = z.object({
    question: z.string().min(5),
    intention: z.string().min(5),
    answer: z.string().min(10),
});

const interviewReportSchema = z.object({
    title: z.string().min(2),
    matchScore: z.number().min(0).max(100),
    technicalQuestions: z.array(questionSchema).length(10),
    behavioralQuestions: z.array(questionSchema).length(10),
    skillGaps: z
        .array(
            z.object({
                skill: z.string().min(2),
                severity: z.enum(["low", "medium", "high"]),
            })
        )
        .min(5),
    preparationPlan: z
        .array(
            z.object({
                day: z.number().int().min(1).max(7),
                focus: z.array(z.string().min(2)).min(1),
                tasks: z.array(z.string().min(2)).min(1),
            })
        )
        .length(7),
});

function isRetryableAiError(error) {
    if (error?.code === "ESSENTIAL_VALIDATION") return false;

    const status = error?.status || error?.response?.status;
    if (status === 429 || status === 503 || status === 500) return true;

    const message = String(error?.message || "").toLowerCase();
    return (
        message.includes("fetch") ||
        message.includes("network") ||
        message.includes("timeout") ||
        message.includes("econn") ||
        message.includes("503") ||
        message.includes("429") ||
        message.includes("resource_exhausted") ||
        message.includes("json") ||
        message.includes("unexpected token") ||
        error instanceof SyntaxError
    );
}

async function callGeminiJson(prompt) {
    const response = await ai.models.generateContent({
        model: "gemini-3.5-flash-lite",
        contents: prompt,
        config: {
            temperature: 0.2,
            responseMimeType: "application/json",
        },
    });

    const rawText = response.text || "";
    const cleanedResponse = rawText
        .replace(/```json/gi, "")
        .replace(/```/g, "")
        .trim();

    if (!cleanedResponse) {
        throw new Error("Gemini returned an empty response.");
    }

    return JSON.parse(cleanedResponse);
}

async function generateInterviewReport({
    resume,
    selfDescription,
    jobDescription,
}) {
    const prompt = `
You are an expert ATS analyzer and senior technical interviewer.

Return ONLY valid JSON. No markdown. No code fences. No commentary.

Schema:
{
  "title": "target job title",
  "matchScore": 0-100,
  "technicalQuestions": [10 items: { "question", "intention", "answer" }],
  "behavioralQuestions": [10 items: { "question", "intention", "answer" }],
  "skillGaps": [5-8 items: { "skill", "severity": "low"|"medium"|"high" }],
  "preparationPlan": [7 items: { "day": 1-7, "focus": [strings], "tasks": [strings] }]
}

Quality rules:
- Questions must reflect the job description and resume specifics (tools, domains, seniority).
- Answers should be concise but interview-ready (3-6 sentences).
- Skill gaps must be actionable and prioritized.
- Preparation plan days must be distinct and progressive.
- title must be a non-empty job title string.

Resume:
${resume}

Self description:
${selfDescription}

Job description:
${jobDescription}
`;

    const MAX_RETRIES = 3;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            let result = await callGeminiJson(prompt);

            if (!result.behavioralQuestions && result.behaviouralQuestions) {
                result.behavioralQuestions = result.behaviouralQuestions;
            }

            result.title = String(result.title ?? "").trim() || "Interview Report";
            result.matchScore = Number(result.matchScore ?? 0);
            result.technicalQuestions ??= [];
            result.behavioralQuestions ??= [];
            result.skillGaps ??= [];
            result.preparationPlan ??= [];

            return interviewReportSchema.parse(result);
        } catch (error) {
            console.error(`Interview AI attempt ${attempt} failed:`, error.message);

            if (attempt === MAX_RETRIES || !isRetryableAiError(error)) {
                console.error("Interview AI service failed.");
                return null;
            }
        }
    }

    return null;
}

async function generateAtsResume({
    resume,
    selfDescription,
    jobDescription,
    title,
    skillGaps,
}) {
    const gapList = (skillGaps || [])
        .map((g) => `${g.skill} (${g.severity})`)
        .join(", ");

    const prompt = `
You are an expert resume writer optimizing for ATS and human recruiters.

Return ONLY valid JSON. No markdown.

Create an ATS-friendly resume tailored to the target role using ONLY facts from the source resume and self description.
Do not invent employers, degrees, or metrics.

For students/freshers with no full-time jobs:
- workExperience may be an empty array []
- internships may contain academic/industrial training
- projects and education should carry most of the content

Use empty arrays [] for missing optional sections. Use "" for missing string fields (never null).

Schema:
{
  "name": "",
  "headline": "",
  "location": "",
  "email": "",
  "phone": "",
  "linkedin": { "text": "", "href": "" },
  "github": { "text": "", "href": "" },
  "professionalSummary": "",
  "technicalSkills": ["..."],
  "workExperience": [{ "company", "role", "duration", "responsibilities": ["..."] }],
  "internships": [{ "company", "role", "duration", "responsibilities": ["..."] }],
  "projects": [{ "name", "technologies": ["..."], "description": "" }],
  "certifications": [{ "name", "issuer", "date": "" }],
  "education": [{ "degree", "institution", "duration", "details": "" }]
}

Required essentials:
- name
- at least one contact field (email, phone, linkedin.href, or github.href)
- at least 3 technicalSkills
- at least 1 education entry

Target role title: ${title || "Professional"}
Priority skills to emphasize (from gap analysis): ${gapList || "N/A"}

Original resume text:
${resume}

Self description:
${selfDescription}

Job description:
${jobDescription}
`;

    const MAX_RETRIES = 3;
    let lastRaw = null;

    for (let attempt = 1; attempt <= MAX_RETRIES; attempt++) {
        try {
            lastRaw = await callGeminiJson(prompt);
            return normalizeAtsResume(lastRaw, {
                targetTitle: title || "Professional",
                resumeText: resume,
                selfDescription,
                jobDescription,
            });
        } catch (error) {
            if (error?.code === "ESSENTIAL_VALIDATION") {
                console.error("Resume AI essential validation failed:", error.message);
                return null;
            }

            console.error(`Resume AI attempt ${attempt} failed:`, error.message);

            if (attempt === MAX_RETRIES || !isRetryableAiError(error)) {
                break;
            }
        }
    }

    if (lastRaw) {
        try {
            return normalizeAtsResume(lastRaw, {
                targetTitle: title || "Professional",
                resumeText: resume,
                selfDescription,
                jobDescription,
            });
        } catch (error) {
            console.error("Resume normalization failed after Gemini response:", error.message);
        }
    }

    return null;
}

module.exports = generateInterviewReport;
module.exports.generateInterviewReport = generateInterviewReport;
module.exports.generateAtsResume = generateAtsResume;
