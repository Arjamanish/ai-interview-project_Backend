/**
 * End-to-end API verification script.
 * Requires: backend running on :3000, valid .env (MONGO_URI, JWT_SECRET, GOOGLE_GENAI_API_KEY)
 *
 * Usage: node scripts/e2e-verify.js
 */

require("dotenv").config();

const BASE = process.env.API_BASE || "http://localhost:3000";
let cookieHeader = "";

const runId = Date.now();
const testUser = {
    username: `e2e_user_${runId}`,
    email: `e2e_${runId}@test.com`,
    password: "TestPass123!",
};

const jobDescription = `
Job Title: Junior Full Stack Developer
Company: InterviewPrep Labs

Requirements:
- JavaScript, React, Node.js, MongoDB
- REST APIs and Git
- Strong problem-solving

Responsibilities:
- Build frontend features in React
- Develop Express APIs
- Collaborate in Agile teams
`.trim();

const selfDescription = `
Computer science graduate passionate about web development.
Built personal projects with React and Node.js.
Comfortable learning quickly and working in teams.
`.trim();

const minimalPdf = Buffer.from(
    `%PDF-1.4
1 0 obj<<>>endobj
2 0 obj<</Length 44>>stream
BT /F1 12 Tf 100 700 Td (John Doe Resume) Tj ET
endstream
endobj
3 0 obj<</Type/Page/Parent 4 0 R/MediaBox[0 0 612 792]/Contents 2 0 R>>endobj
4 0 obj<</Type/Pages/Kids[3 0 R]/Count 1>>endobj
5 0 obj<</Type/Catalog/Pages 4 0 R>>endobj
xref
0 6
0000000000 65535 f 
0000000009 00000 n 
0000000028 00000 n 
0000000120 00000 n 
0000000215 00000 n 
0000000274 00000 n 
trailer<</Size 6/Root 5 0 R>>
startxref
330
%%EOF`
);

function log(step, ok, detail = "") {
    console.log(`${ok ? "✓" : "✗"} ${step}${detail ? ` — ${detail}` : ""}`);
    if (!ok) process.exitCode = 1;
}

function storeCookies(response) {
    const raw = response.headers.getSetCookie?.() || [];
    const pairs = raw.map((entry) => entry.split(";")[0]).filter(Boolean);
    if (pairs.length) {
        cookieHeader = pairs.join("; ");
    }
}

async function request(path, options = {}) {
    const headers = { ...(options.headers || {}) };
    if (cookieHeader) headers.Cookie = cookieHeader;

    const response = await fetch(`${BASE}${path}`, {
        ...options,
        headers,
    });

    storeCookies(response);

    const contentType = response.headers.get("content-type") || "";
    let data;

    if (contentType.includes("application/pdf") || options.binary) {
        data = Buffer.from(await response.arrayBuffer());
    } else if (contentType.includes("application/json")) {
        data = await response.json();
    } else {
        data = await response.text();
    }

    return { status: response.status, data, headers: response.headers };
}

async function main() {
    console.log(`\nE2E verification against ${BASE}\n`);

    let registerRes = await request("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(testUser),
    });
    log("Register", registerRes.status === 201, registerRes.data?.message);

    let loginRes = await request("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
            email: testUser.email,
            password: testUser.password,
        }),
    });
    log("Login", loginRes.status === 200, loginRes.data?.message);

    let meRes = await request("/api/auth/get-me");
    log(
        "Authentication persistence (get-me)",
        meRes.status === 200 && meRes.data?.user?.email === testUser.email,
        meRes.data?.user?.username
    );

    let dashRes = await request("/api/interview");
    log(
        "Dashboard / recent reports",
        dashRes.status === 200 && Array.isArray(dashRes.data?.interviewReports),
        `${dashRes.data?.interviewReports?.length ?? 0} reports`
    );

    const boundary = `----E2EBoundary${runId}`;
    const formBody = Buffer.concat([
        Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="jobDescription"\r\n\r\n${jobDescription}\r\n`
        ),
        Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="selfDescription"\r\n\r\n${selfDescription}\r\n`
        ),
        Buffer.from(
            `--${boundary}\r\nContent-Disposition: form-data; name="resume"; filename="resume.pdf"\r\nContent-Type: application/pdf\r\n\r\n`
        ),
        minimalPdf,
        Buffer.from(`\r\n--${boundary}--\r\n`),
    ]);

    console.log("\nGenerating interview report (Gemini) — may take up to 120s...\n");

    let genRes = await request("/api/interview", {
        method: "POST",
        headers: { "Content-Type": `multipart/form-data; boundary=${boundary}` },
        body: formBody,
    });

    log(
        "Generate interview report",
        genRes.status === 201 && genRes.data?.interviewReport?._id,
        genRes.data?.message || genRes.data?.error
    );

    if (genRes.status !== 201) {
        console.error(genRes.data);
        return;
    }

    const reportId = genRes.data.interviewReport._id;
    const title = genRes.data.interviewReport.title;
    log("MongoDB storage + title", Boolean(title), title);

    let getRes = await request(`/api/interview/report/${reportId}`);
    log("Open existing report", getRes.status === 200, getRes.data?.interviewReport?.title);

    console.log("\nGenerating ATS resume preview (Gemini) — may take up to 120s...\n");

    let previewRes = await request(
        `/api/interview/report/${reportId}/resume/preview`
    );
    log(
        "Generate ATS resume preview",
        previewRes.status === 200 && previewRes.data?.atsResume?.name,
        previewRes.data?.atsResume?.name
    );

    if (previewRes.status !== 200) {
        console.error(previewRes.data);
        return;
    }

    let regenRes = await request(
        `/api/interview/report/${reportId}/resume/preview?regenerate=true`
    );
    log(
        "Regenerate ATS resume",
        regenRes.status === 200 && regenRes.data?.atsResume?.name,
        regenRes.data?.message
    );

    let pdfRes = await request(`/api/interview/report/${reportId}/resume`, {
        method: "POST",
        binary: true,
    });

    const pdfHeader = pdfRes.data?.slice?.(0, 4)?.toString?.() || "";
    log(
        "Download resume PDF",
        pdfRes.status === 200 && pdfHeader === "%PDF",
        `${pdfRes.data?.length ?? 0} bytes`
    );

    let delRes = await request(`/api/interview/report/${reportId}`, {
        method: "DELETE",
    });
    log("Delete report", delRes.status === 200, delRes.data?.message);

    let logoutRes = await request("/api/auth/logout");
    log("Logout", logoutRes.status === 200, logoutRes.data?.message);

    let meAfterLogout = await request("/api/auth/get-me");
    log(
        "Session cleared after logout",
        meAfterLogout.status === 401 || meAfterLogout.status === 404,
        `status ${meAfterLogout.status}`
    );

    console.log("\nE2E verification complete.\n");
}

main().catch((err) => {
    console.error("E2E script failed:", err.message);
    process.exit(1);
});
