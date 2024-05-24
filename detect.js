require('dotenv').config(); // Import dotenv for loading environment variables
const puppeteer = require('puppeteer');
const fs = require('fs');
const pixelmatch = require('pixelmatch');
const { createCanvas, loadImage } = require('canvas');
const { Client, Intents } = require('discord.js');

const SCREENSHOT_PATH = 'screenshot.png';
const PREVIOUS_SCREENSHOT_PATH = 'previous_screenshot.png';
const DIFF_SCREENSHOT_PATH = 'diff_screenshot.png';

// Retrieve Discord bot token and user ID from environment variables
const DISCORD_BOT_TOKEN = process.env.DISCORD_BOT_TOKEN;
const USER_ID = process.env.DISCORD_USER_ID;

async function takeScreenshot() {
    const browser = await puppeteer.launch();
    const page = await browser.newPage();
    await page.goto('https://example.com'); // Replace with the URL you want to visit
    await page.screenshot({ path: SCREENSHOT_PATH });
    await browser.close();
}

async function compareScreenshots() {
    const img1 = await loadImage(PREVIOUS_SCREENSHOT_PATH);
    const img2 = await loadImage(SCREENSHOT_PATH);

    const { width, height } = img1;
    const canvas = createCanvas(width, height);
    const ctx = canvas.getContext('2d');

    ctx.drawImage(img1, 0, 0);
    const img1Data = ctx.getImageData(0, 0, width, height);

    ctx.drawImage(img2, 0, 0);
    const img2Data = ctx.getImageData(0, 0, width, height);

    const diff = createCanvas(width, height);
    const diffCtx = diff.getContext('2d');
    const diffData = diffCtx.createImageData(width, height);

    const numDiffPixels = pixelmatch(img1Data.data, img2Data.data, diffData.data, width, height, { threshold: 0.1 });

    diffCtx.putImageData(diffData, 0, 0);
    const out = fs.createWriteStream(DIFF_SCREENSHOT_PATH);
    const stream = diff.createPNGStream();
    stream.pipe(out);

    return numDiffPixels;
}

async function sendDiffScreenshot(client) {
    const user = await client.users.fetch(USER_ID);
    await user.send('Screenshots are different:', { files: [DIFF_SCREENSHOT_PATH] });
}

async function runProcess() {
    await takeScreenshot();

    if (fs.existsSync(PREVIOUS_SCREENSHOT_PATH)) {
        const numDiffPixels = await compareScreenshots();

        if (numDiffPixels > 0) {
            const client = new Client({ intents: [Intents.FLAGS.DIRECT_MESSAGES, Intents.FLAGS.GUILDS], partials: ["CHANNEL"] });
            client.once('ready', async () => {
                console.log(`Logged in as ${client.user.tag}!`);
                await sendDiffScreenshot(client);
                await client.destroy();
            });
            await client.login(DISCORD_BOT_TOKEN);
        }
    } else {
        // If no previous screenshot exists, just copy the current screenshot
        fs.copyFileSync(SCREENSHOT_PATH, PREVIOUS_SCREENSHOT_PATH);
    }

    // Update the previous screenshot
    fs.copyFileSync(SCREENSHOT_PATH, PREVIOUS_SCREENSHOT_PATH);
}

async function start() {
    await runProcess(); // Run the process immediately

    setInterval(async () => {
        await runProcess(); // Run the process every 24 hours
    }, 24 * 60 * 60 * 1000); // 24 hours in milliseconds
}

start();
