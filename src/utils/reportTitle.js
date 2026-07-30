/**
 * Derive a stable job title for reports missing the title field.
 */
function deriveReportTitle(reportOrFields) {
    const existing = reportOrFields?.title?.trim();
    if (existing) return existing.slice(0, 120);

    const jobDescription = reportOrFields?.jobDescription || "";
    const lines = jobDescription
        .split(/\r?\n/)
        .map((line) => line.trim())
        .filter(Boolean);

    const labeled = jobDescription.match(
        /(?:job\s*title|position|role|designation)\s*[:\-]\s*([^\n]+)/i
    );
    if (labeled?.[1]?.trim()) return labeled[1].trim().slice(0, 120);

    const heading = lines.find((line) =>
        /developer|engineer|analyst|designer|manager|intern|consultant|specialist|architect|lead|associate|student|graduate/i.test(
            line
        )
    );
    if (heading) return heading.slice(0, 120);

    if (lines[0]) return lines[0].slice(0, 120);

    return "Interview Report";
}

module.exports = { deriveReportTitle };
