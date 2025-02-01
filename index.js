import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import cron from 'node-cron';
import fs from 'fs';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, { handlerTimeout: 9_000_000 });
const urls = JSON.parse(fs.readFileSync('urls.json', 'utf-8'));
const chatIdsFile = 'chat_ids.json';
const cookieFile = 'linkedin_cookie.json';

console.log('Loading chat IDs...');
function loadChatIds() {
    try {
        return new Set(JSON.parse(fs.readFileSync(chatIdsFile, 'utf-8')));
    } catch (err) {
        console.error('Error loading chat IDs:', err);
        return new Set();
    }
}

function saveChatIds() {
    console.log('Saving chat IDs...');
    fs.writeFileSync(chatIdsFile, JSON.stringify([...userChatIds], null, 2));
}

let userChatIds = loadChatIds();

bot.start((ctx) => {
    console.log(`User started bot: ${ctx.chat.id}`);
    userChatIds.add(ctx.chat.id);
    saveChatIds();
    ctx.reply("You have subscribed to weekly news summaries!");
});

async function scrapeWebsite(url) {
    console.log(`Scraping website: ${url}`);
    const browser = await puppeteer.launch ({ executablePath: '/usr/bin/chromium-browser', args: ['--disable-gpu', '--disable-setuid-sandbox', '--no-sandbox', '--no-zygote'] });
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);

    await page.goto(url, { waitUntil: 'domcontentloaded', timeout: 120000 });

    const scrollPage = async () => {
        await page.evaluate(async () => {
            let previousHeight = 0;
            while (true) {
                window.scrollTo(0, document.body.scrollHeight);
                await new Promise(resolve => setTimeout(resolve, 500));

                let newHeight = document.body.scrollHeight;
                if (newHeight === previousHeight) break;
                previousHeight = newHeight;
            }
        });
    };

    await scrollPage();

    const content = await page.evaluate(() => document.body.innerText.trim());
    await browser.close();
    console.log(`Scraped content from ${url}`);
    return content;
}

async function summarizeContent(text) {
    console.log('Summarizing content...');
    const response = await openai.chat.completions.create({
        model: "gpt-4o-mini",
        messages: [{ role: "system", content: "You are given content scraped from corporate websites. Your task is to ignore site's info such as company values, services, goals etc. and focus ONLY on detected articles, blog-posts etc. When you filter out the text for articles, blog-posts etc., return me a bullet list of briefly summarized topics, which those articles cover. Each topic should be followed by your opinion on this topic (- topic1. \n GPT's opinion on topic:bla-bla-bla\n - topic2. \n GPT's opinion on topic:bla-bla-bla). Try to give opinion on EVERY topic and be as consise AS POSSIBLE!!!" },
        { role: "user", content: text }],
        max_tokens: 3000
    });
    console.log('Summary generated.');
    return response.choices[0].message.content.trim();
}

function splitMessage(message, limit = 4096) {
    const parts = [];
    while (message.length > limit) {
        let chunk = message.slice(0, limit);
        let lastNewline = chunk.lastIndexOf('\n');
        if (lastNewline > -1) {
            chunk = chunk.slice(0, lastNewline);
        }
        parts.push(chunk);
        message = message.slice(chunk.length).trim();
    }
    parts.push(message);
    return parts;
}

async function getCurrentWeek() {
    const today = new Date();
    const firstDay = new Date(today.setDate(today.getDate() - today.getDay() + 1));
    const lastDay = new Date(today.setDate(today.getDate() - today.getDay() + 7));

    const formatDate = (date) => {
        return `${(date.getMonth() + 1).toString().padStart(2, '0')}/${date.getDate().toString().padStart(2, '0')}`;
    };

    return `Week ${formatDate(firstDay)} - ${formatDate(lastDay)}`;
}

async function generateWebsiteReport() {
    console.log('Generating website report...');
    const week = await getCurrentWeek();
    let report = `${week}\n`;
    for (const { company, url } of urls) {
        console.log(`Processing website content for ${company}...`);
        let content = await scrapeWebsite(url);
        const summary = await summarizeContent(content);
        report += `\n\n\n\n\n${company} published on their website articles that cover these topics:\n\n${summary}\n`;
    }
    return report;
}

bot.command('websitesummary', async (ctx) => {
    console.log(`User requested website summary: ${ctx.chat.id}`);
    ctx.reply("Generating website summary, please wait for 5-9 minutes...");
    try {
        const report = await generateWebsiteReport();
        const messageParts = splitMessage(report);
        messageParts.forEach(part => ctx.reply(part, { parse_mode: 'Markdown' }));
    } catch (error) {
        console.error('Error generating website summary:', error);
        ctx.reply("An error occurred while generating the website summary.");
    }
});

cron.schedule('0 9 * * 1', async () => {//every Monday at 09:00 AM '0 9 * * 1'
    console.log('Scheduled task: Generating weekly website and LinkedIn reports...');
    try {
        const websiteReport = await generateWebsiteReport();
        const fullReport = `Your weekly automatic summary:\n\n${websiteReport}`;
        const messageParts = splitMessage(fullReport);
        userChatIds.forEach(chatId => {
            messageParts.forEach(part => bot.telegram.sendMessage(chatId, part, { parse_mode: 'Markdown' }));
        });
    } catch (error) {
        console.error('Error in scheduled task:', error);
    }
});

console.log('Bot is running and scheduled to send reports every Monday at 09:00 AM.');

bot.launch().then(() => console.log('Bot launched successfully.')).catch(error => console.error('Error launching bot:', error));