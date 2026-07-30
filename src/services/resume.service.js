const puppeteer = require("puppeteer-core");
const chromium = require("@sparticuz/chromium");

const { renderResumeHtml } = require("./resume.template");


async function htmlToPdfBuffer(html) {
    let browser;

    try {

        const executablePath = await chromium.executablePath();

        console.log("USING SPARTICUZ CHROMIUM");
        console.log("Chromium path:", executablePath);

        browser = await puppeteer.launch({
            executablePath,
            args: chromium.args,
            headless: true,
        });


        const page = await browser.newPage();

        await page.setContent(html, {
            waitUntil: "networkidle0",
        });


        const pdf = await page.pdf({
            format: "A4",
            printBackground: true,
            margin: {
                top: "0",
                right: "0",
                bottom: "0",
                left: "0",
            },
        });


        return Buffer.from(pdf);


    } finally {

        if (browser) {
            await browser.close();
        }

    }
}


async function buildResumePdf(resumeData) {

    const html = renderResumeHtml(resumeData);

    return htmlToPdfBuffer(html);

}


module.exports = {
    buildResumePdf,
};