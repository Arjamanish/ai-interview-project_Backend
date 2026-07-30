const { z } = require("zod");

const toStringOrEmpty = (value) => {
    if (value == null) return "";
    return String(value).trim();
};

const toStringArray = (value) => {
    if (!Array.isArray(value)) return [];
    return value.map((item) => String(item ?? "").trim()).filter(Boolean);
};

const linkSchema = z
    .object({
        text: z.preprocess(toStringOrEmpty, z.string()),
        href: z.preprocess(toStringOrEmpty, z.string()),
    })
    .optional();

const workExperienceSchema = z.object({
    company: z.preprocess(toStringOrEmpty, z.string()),
    role: z.preprocess(toStringOrEmpty, z.string()),
    duration: z.preprocess(toStringOrEmpty, z.string()),
    responsibilities: z.preprocess(toStringArray, z.array(z.string())),
});

const internshipSchema = z.object({
    company: z.preprocess(toStringOrEmpty, z.string()),
    role: z.preprocess(toStringOrEmpty, z.string()),
    duration: z.preprocess(toStringOrEmpty, z.string()),
    responsibilities: z.preprocess(toStringArray, z.array(z.string())),
});

const projectSchema = z.object({
    name: z.preprocess(toStringOrEmpty, z.string()),
    technologies: z.preprocess(toStringArray, z.array(z.string())),
    description: z.preprocess(toStringOrEmpty, z.string()),
});

const certificationSchema = z.object({
    name: z.preprocess(toStringOrEmpty, z.string()),
    issuer: z.preprocess(toStringOrEmpty, z.string()),
    date: z.preprocess(toStringOrEmpty, z.string()),
});

const educationSchema = z.object({
    degree: z.preprocess(toStringOrEmpty, z.string()),
    institution: z.preprocess(toStringOrEmpty, z.string()),
    duration: z.preprocess(toStringOrEmpty, z.string()),
    details: z.preprocess(toStringOrEmpty, z.string()),
});

/** Permissive schema — normalizes Gemini output before essential checks. */
const atsResumeSchema = z.object({
    name: z.preprocess(toStringOrEmpty, z.string()),
    headline: z.preprocess(toStringOrEmpty, z.string()),
    location: z.preprocess(toStringOrEmpty, z.string()),
    email: z.preprocess(toStringOrEmpty, z.string()),
    phone: z.preprocess(toStringOrEmpty, z.string()),
    linkedin: linkSchema,
    github: linkSchema,
    professionalSummary: z.preprocess(toStringOrEmpty, z.string()),
    technicalSkills: z.preprocess(toStringArray, z.array(z.string())),
    workExperience: z.preprocess(
        (value) => (Array.isArray(value) ? value : []),
        z.array(workExperienceSchema)
    ),
    internships: z.preprocess(
        (value) => (Array.isArray(value) ? value : []),
        z.array(internshipSchema)
    ),
    projects: z.preprocess(
        (value) => (Array.isArray(value) ? value : []),
        z.array(projectSchema)
    ),
    certifications: z.preprocess(
        (value) => (Array.isArray(value) ? value : []),
        z.array(certificationSchema)
    ),
    education: z.preprocess(
        (value) => (Array.isArray(value) ? value : []),
        z.array(educationSchema)
    ),
});

function hasContactInfo(resume) {
    return Boolean(
        resume.email?.trim() ||
            resume.phone?.trim() ||
            resume.linkedin?.href?.trim() ||
            resume.github?.href?.trim()
    );
}

function extractEmail(text) {
    const match = String(text || "").match(/[\w.+-]+@[\w.-]+\.[A-Za-z]{2,}/);
    return match?.[0] || "";
}

function extractPhone(text) {
    const match = String(text || "").match(/(?:\+?\d[\d\s\-().]{7,}\d)/);
    return match?.[0]?.replace(/\s+/g, " ").trim() || "";
}

function extractNameFromResume(resumeText) {
    const lines = String(resumeText || "")
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    for (const line of lines.slice(0, 8)) {
        const cleaned = line.replace(/\bresume\b/gi, "").trim();
        if (
            cleaned.length >= 2 &&
            cleaned.length <= 60 &&
            !/@/.test(cleaned) &&
            !/^\d/.test(cleaned)
        ) {
            return cleaned;
        }
    }

    const inline = String(resumeText || "").match(
        /([A-Z][a-z]+(?: [A-Z][a-z]+){1,3})\s+Resume/i
    );
    return inline?.[1]?.trim() || "";
}

function inferSkillsFromJobDescription(jobDescription) {
    const catalog = [
        "JavaScript",
        "TypeScript",
        "React",
        "Node.js",
        "Express.js",
        "MongoDB",
        "SQL",
        "Python",
        "Java",
        "AWS",
        "Docker",
        "Git",
        "REST APIs",
        "Problem Solving",
        "Communication",
        "Agile",
        "HTML",
        "CSS",
    ];

    const haystack = String(jobDescription || "").toLowerCase();
    return catalog.filter((skill) => haystack.includes(skill.toLowerCase()));
}

function enrichAtsResumeFromSources(
    resume,
    { resumeText = "", selfDescription = "", jobDescription = "", targetTitle = "Professional" } = {}
) {
    const enriched = { ...resume };
    const source = `${resumeText}\n${selfDescription}\n${jobDescription}`;

    if (!enriched.name?.trim()) {
        enriched.name =
            extractNameFromResume(resumeText) ||
            extractNameFromResume(selfDescription) ||
            "Candidate";
    }

    if (!enriched.email?.trim()) enriched.email = extractEmail(source);
    if (!enriched.phone?.trim()) enriched.phone = extractPhone(source);

    if (!enriched.linkedin?.href?.trim() && !enriched.linkedin?.text?.trim()) {
        enriched.linkedin = { text: "", href: "" };
    }
    if (!enriched.github?.href?.trim() && !enriched.github?.text?.trim()) {
        enriched.github = { text: "", href: "" };
    }

    if (!enriched.technicalSkills?.length) {
        const inferred = inferSkillsFromJobDescription(jobDescription);
        enriched.technicalSkills =
            inferred.length >= 3
                ? inferred.slice(0, 8)
                : ["JavaScript", "Problem Solving", "Communication"];
    }

    if (!enriched.education?.length) {
        const degreeMatch = source.match(
            /(?:B\.?\s?Tech|M\.?\s?Tech|Bachelor|Master|B\.?\s?Sc|M\.?\s?Sc|Computer Science|Information Technology)[^\n]*/i
        );
        enriched.education = [
            {
                degree: degreeMatch?.[0]?.trim() || "Relevant academic background",
                institution: "See uploaded resume",
                duration: "",
                details: selfDescription?.trim()?.slice(0, 240) || "",
            },
        ];
    }

    if (!enriched.headline?.trim()) {
        enriched.headline = targetTitle;
    }

    if (!enriched.professionalSummary?.trim()) {
        enriched.professionalSummary = selfDescription?.trim() ||
            `Motivated ${targetTitle} candidate with foundational skills and a strong learning mindset.`;
    }

    return enriched;
}

function applyAtsResumeDefaults(resume, targetTitle = "Professional") {
    const normalized = { ...resume };

    if (!normalized.headline?.trim()) {
        normalized.headline = targetTitle;
    }

    if (!normalized.professionalSummary?.trim()) {
        normalized.professionalSummary =
            "Motivated candidate seeking to contribute strong technical skills and a growth mindset to the target role.";
    }

    normalized.workExperience = (normalized.workExperience || []).filter(
        (item) => item.company || item.role || item.responsibilities?.length
    );
    normalized.internships = (normalized.internships || []).filter(
        (item) => item.company || item.role || item.responsibilities?.length
    );
    normalized.projects = (normalized.projects || []).filter(
        (item) => item.name || item.description
    );
    normalized.certifications = (normalized.certifications || []).filter(
        (item) => item.name || item.issuer
    );
    normalized.education = (normalized.education || []).filter(
        (item) => item.degree || item.institution
    );

    return normalized;
}

function assertEssentialAtsResume(resume) {
    const errors = [];

    if (!resume.name?.trim()) {
        errors.push("name is required");
    }

    if (!hasContactInfo(resume)) {
        errors.push("at least one contact field is required (email, phone, LinkedIn, or GitHub)");
    }

    if (!resume.technicalSkills?.length) {
        errors.push("at least one technical skill is required");
    }

    if (!resume.education?.length) {
        errors.push("at least one education entry is required");
    }

    if (errors.length) {
        const err = new Error(`ATS resume missing essential fields: ${errors.join("; ")}`);
        err.code = "ESSENTIAL_VALIDATION";
        throw err;
    }
}

function normalizeAtsResume(raw, { targetTitle = "Professional", resumeText = "", selfDescription = "", jobDescription = "" } = {}) {
    const parsed = atsResumeSchema.parse(raw ?? {});
    const enriched = enrichAtsResumeFromSources(parsed, {
        resumeText,
        selfDescription,
        jobDescription,
        targetTitle,
    });
    const withDefaults = applyAtsResumeDefaults(enriched, targetTitle);
    assertEssentialAtsResume(withDefaults);
    return withDefaults;
}

function escapeHtml(value) {
    return String(value ?? "")
        .replace(/&/g, "&amp;")
        .replace(/</g, "&lt;")
        .replace(/>/g, "&gt;")
        .replace(/"/g, "&quot;");
}

function renderExperienceBlock(items, emptyLabel) {
    if (!items?.length) {
        return `<p class="muted-section">${escapeHtml(emptyLabel)}</p>`;
    }

    return items
        .map(
            (job) => `
      <section class="block">
        <div class="row">
          <h3>${escapeHtml(job.role || "Role")}</h3>
          <span class="muted">${escapeHtml(job.duration || "")}</span>
        </div>
        <p class="company">${escapeHtml(job.company || "")}</p>
        ${
            job.responsibilities?.length
                ? `<ul>${job.responsibilities.map((item) => `<li>${escapeHtml(item)}</li>`).join("")}</ul>`
                : ""
        }
      </section>`
        )
        .join("");
}

function renderProjectsBlock(projects) {
    if (!projects?.length) {
        return `<p class="muted-section">Relevant academic and personal projects highlighted in summary.</p>`;
    }

    return projects
        .map(
            (project) => `
      <section class="block">
        <div class="row">
          <h3>${escapeHtml(project.name || "Project")}</h3>
          <span class="muted">${(project.technologies || []).map(escapeHtml).join(", ")}</span>
        </div>
        <p>${escapeHtml(project.description || "")}</p>
      </section>`
        )
        .join("");
}

function renderEducationBlock(education) {
    return education
        .map(
            (edu) => `
      <section class="block">
        <div class="row">
          <h3>${escapeHtml(edu.degree || "Degree")}</h3>
          <span class="muted">${escapeHtml(edu.duration || "")}</span>
        </div>
        <p class="company">${escapeHtml(edu.institution || "")}</p>
        ${edu.details ? `<p>${escapeHtml(edu.details)}</p>` : ""}
      </section>`
        )
        .join("");
}

function renderCertificationsBlock(certifications) {
    if (!certifications?.length) return "";

    const items = certifications
        .map(
            (cert) => `
      <section class="block">
        <div class="row">
          <h3>${escapeHtml(cert.name || "Certification")}</h3>
          <span class="muted">${escapeHtml(cert.date || "")}</span>
        </div>
        <p class="company">${escapeHtml(cert.issuer || "")}</p>
      </section>`
        )
        .join("");

    return `<h2>Certifications</h2>${items}`;
}

function renderResumeHtml(resume) {
    const contactParts = [
        resume.location,
        resume.email,
        resume.phone,
        resume.linkedin?.href
            ? `<a href="${escapeHtml(resume.linkedin.href)}">${escapeHtml(resume.linkedin.text || "LinkedIn")}</a>`
            : null,
        resume.github?.href
            ? `<a href="${escapeHtml(resume.github.href)}">${escapeHtml(resume.github.text || "GitHub")}</a>`
            : null,
    ].filter(Boolean);

    const skills = (resume.technicalSkills || []).map(escapeHtml).join(" · ");
    const experienceHtml = renderExperienceBlock(
        resume.workExperience,
        "Early-career candidate — experience summarized in projects and education."
    );
    const internshipsHtml = resume.internships?.length
        ? `<h2>Internships</h2>${renderExperienceBlock(resume.internships, "")}`
        : "";
    const projectsHtml = renderProjectsBlock(resume.projects);
    const educationHtml = renderEducationBlock(resume.education);
    const certificationsHtml = renderCertificationsBlock(resume.certifications);

    return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8" />
  <style>
    @page { size: A4; margin: 18mm 16mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "Segoe UI", Arial, sans-serif;
      font-size: 10.5pt;
      line-height: 1.45;
      color: #111;
      margin: 0;
    }
    h1 { font-size: 20pt; margin: 0 0 4px; letter-spacing: -0.02em; }
    h2 {
      font-size: 11pt;
      text-transform: uppercase;
      letter-spacing: 0.08em;
      border-bottom: 1px solid #ddd;
      padding-bottom: 4px;
      margin: 18px 0 8px;
      color: #333;
    }
    h3 { font-size: 10.5pt; margin: 0; }
    .headline { color: #444; margin: 0 0 6px; font-weight: 600; }
    .contact { color: #555; font-size: 9.5pt; margin-bottom: 8px; }
    .contact a { color: #333; text-decoration: none; }
    .row { display: flex; justify-content: space-between; gap: 12px; align-items: baseline; }
    .muted { color: #666; font-size: 9.5pt; white-space: nowrap; }
    .muted-section { color: #666; font-style: italic; }
    .company { margin: 2px 0 6px; color: #444; font-weight: 600; }
    ul { margin: 0; padding-left: 16px; }
    li { margin-bottom: 3px; }
    p { margin: 0 0 6px; }
    .block { margin-bottom: 10px; }
    .skills { margin-top: 4px; }
  </style>
</head>
<body>
  <header>
    <h1>${escapeHtml(resume.name)}</h1>
    <p class="headline">${escapeHtml(resume.headline)}</p>
    <p class="contact">${contactParts.join(" · ")}</p>
  </header>

  <h2>Professional Summary</h2>
  <p>${escapeHtml(resume.professionalSummary)}</p>

  <h2>Technical Skills</h2>
  <p class="skills">${skills}</p>

  <h2>Experience</h2>
  ${experienceHtml}

  ${internshipsHtml}

  <h2>Projects</h2>
  ${projectsHtml}

  <h2>Education</h2>
  ${educationHtml}

  ${certificationsHtml}
</body>
</html>`;
}

module.exports = {
    atsResumeSchema,
    normalizeAtsResume,
    renderResumeHtml,
};
