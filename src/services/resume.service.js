const puppeteer = require("puppeteer");
const { renderResumeHtml } = require("./resume.template");

async function htmlToPdfBuffer(html) {
  let browser;
  try {
    browser = await puppeteer.launch({
      headless: true,
      args: ["--no-sandbox", "--disable-setuid-sandbox"],
    });
    const page = await browser.newPage();
    await page.setContent(html, { waitUntil: "load" });
    const pdf = await page.pdf({
      format: "A4",
      printBackground: false,
      margin: { top: "0", right: "0", bottom: "0", left: "0" },
    });
    return Buffer.from(pdf);
  } finally {
    if (browser) await browser.close();
  }
}

async function buildResumePdf(resumeData) {
  const html = renderResumeHtml(resumeData);
  return htmlToPdfBuffer(html);
}

module.exports = {
  buildResumePdf,
};
