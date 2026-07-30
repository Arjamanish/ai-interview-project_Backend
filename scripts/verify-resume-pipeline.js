const { normalizeAtsResume, renderResumeHtml } = require("../src/services/resume.template");
const { deriveReportTitle } = require("../src/utils/reportTitle");

function assert(condition, message) {
    if (!condition) throw new Error(message);
}

// Fresher profile — empty work experience, null education duration
const fresherRaw = {
    name: "Priya Nair",
    headline: "",
    email: "priya@email.com",
    phone: "",
    professionalSummary: "",
    technicalSkills: ["JavaScript", "React", "Node.js"],
    workExperience: [],
    internships: [],
    projects: [],
    certifications: [],
    education: [
        {
            degree: "B.Tech Computer Science",
            institution: "State University",
            duration: null,
            details: null,
        },
    ],
};

const experiencedRaw = {
    name: "Rahul Sharma",
    headline: "Full Stack Developer",
    email: "rahul@email.com",
    phone: "+91 9876543210",
    professionalSummary: "Full stack engineer with 3+ years experience.",
    technicalSkills: ["JavaScript", "React", "Node.js", "MongoDB", "AWS"],
    workExperience: [
        {
            company: "Tech Co",
            role: "Developer",
            duration: "2022 - Present",
            responsibilities: ["Built APIs", "Led frontend migration"],
        },
    ],
    projects: [
        {
            name: "Platform",
            technologies: ["React", "Node"],
            description: "Internal tooling platform.",
        },
    ],
    education: [
        {
            degree: "B.Tech",
            institution: "University",
            duration: "2018 - 2022",
        },
    ],
};

const sparseFresherRaw = {
    name: "",
    email: "",
    phone: "",
    professionalSummary: "",
    technicalSkills: [],
    workExperience: [],
    education: [],
};

const sparseFresher = normalizeAtsResume(sparseFresherRaw, {
    targetTitle: "Frontend Intern",
    resumeText: "John Doe Resume\nEmail: john.doe@example.com",
    selfDescription: "Computer science graduate passionate about web development.",
    jobDescription: "Junior Full Stack Developer. Requires JavaScript, React, Node.js.",
});
assert(sparseFresher.name === "John Doe", "Name should derive from sparse resume text");
assert(sparseFresher.workExperience.length === 0, "Sparse fresher workExperience should be empty");
assert(sparseFresher.education.length >= 1, "Education fallback should exist");
assert(sparseFresher.technicalSkills.length >= 3, "Skills should be inferred from job description");

const fresher = normalizeAtsResume(fresherRaw, {
    targetTitle: "Frontend Intern",
    resumeText: "Priya Nair\npriya@email.com",
    selfDescription: "Computer science graduate.",
    jobDescription: "Frontend Intern role requiring React.",
});
assert(fresher.workExperience.length === 0, "Fresher workExperience should be empty");
assert(fresher.education[0].duration === "", "Null duration should become empty string");
assert(fresher.headline === "Frontend Intern", "Headline should default to target title");

const experienced = normalizeAtsResume(experiencedRaw, {
    targetTitle: "Senior Developer",
    resumeText: "Rahul Sharma resume",
    selfDescription: experiencedRaw.professionalSummary,
    jobDescription: "Senior Developer role",
});
assert(experienced.workExperience.length === 1, "Experienced profile keeps work history");

const html = renderResumeHtml(fresher);
assert(html.includes("Priya Nair"), "PDF HTML should include candidate name");
assert(html.includes("Education"), "PDF HTML should include education section");

const derived = deriveReportTitle({
    jobDescription: "Job Title: Full Stack Developer\nBuild APIs with Node.js",
});
assert(derived.includes("Full Stack Developer"), "Title should derive from job description");

console.log("✓ Resume normalization tests passed");
