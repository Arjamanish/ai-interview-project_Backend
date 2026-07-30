require("dotenv").config();
const { generateAtsResume } = require("../src/services/ai.service");

const resume = "John Doe Resume\nEmail: john.doe@email.com\nPhone: +1 555-0100\nB.Tech Computer Science, State University, 2021-2025\nSkills: JavaScript, React, Node.js";
const selfDescription = "Computer science graduate passionate about web development.";
const jobDescription = "Job Title: Junior Full Stack Developer\nRequirements: JavaScript, React, Node.js";

generateAtsResume({
    resume,
    selfDescription,
    jobDescription,
    title: "Junior Full Stack Developer",
    skillGaps: [{ skill: "React", severity: "medium" }],
})
    .then((result) => {
        if (!result) {
            console.error("generateAtsResume returned null");
            process.exit(1);
        }
        console.log(JSON.stringify(result, null, 2));
    })
    .catch((err) => {
        console.error(err);
        process.exit(1);
    });
