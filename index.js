import dotenv from 'dotenv';
import puppeteer from 'puppeteer';
import OpenAI from 'openai';
import { Telegraf } from 'telegraf';
import cron from 'node-cron';
import fs from 'fs';

dotenv.config();

const openai = new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
const bot = new Telegraf(process.env.TELEGRAM_BOT_TOKEN, {handlerTimeout: 9_000_000});
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

bot.command('updatecookie', async (ctx) => {
    ctx.reply("Upload JSON-format cookie file of your LinkedIn session provided by this extension. https://chromewebstore.google.com/detail/export-cookie-json-file-f/nmckokihipjgplolmcmjakknndddifde?hl=ru. Make sure to update it every 12 days to avoid expiration. BE AWARE: YOUR LINKEDIN ACCOUNT MAY BE BANNED FOR SCRAPING DATA! After uploading the file, check if it works by running linkedin summary command. If it doesn't work - contact @Rediska5_5_5 (author).");

    bot.on('document', async (ctx) => {
    const fileId = ctx.message.document.file_id;
    const fileLink = await ctx.telegram.getFileLink(fileId);
    
    const response = await fetch(fileLink);
    const newCookie = await response.json();
    
    if (!Array.isArray(newCookie)) {
        return ctx.reply("Invalid cookie format. It should be an array of cookie objects.");
    }

    
    fs.writeFileSync(cookieFile, JSON.stringify(newCookie, null, 2));
    ctx.reply("LinkedIn cookie updated successfully! Remember to update it every 12 days to avoid expiration.");
    });
});

async function loadLinkedInCookie() {
    try {
        return JSON.parse(fs.readFileSync(cookieFile, 'utf-8'));
    } catch (err) {
        console.error('Error loading LinkedIn cookie:', err);
        return [];
    }
}


async function scrapeWebsite(url) {
  console.log(`Scraping website: ${url}`);
  const browser = await puppeteer.launch({headless: true});
  const page = await browser.newPage();
  await page.setDefaultNavigationTimeout(0);
  await page.goto(url, { waitUntil: 'domcontentloaded', timeout: '0' });
  await page.waitForNetworkIdle({ idleTime: 1000 });

  const scrollPageToBottom = async () => {
    await page.evaluate(() => {
      window.scrollTo(0, document.body.scrollHeight);
    });
    await page.waitForNetworkIdle(300); // Adjust timeout as needed
  };

  // Scrolling in a loop until a certain condition is met
  let previousHeight = 0;
  while (true) {
    await scrollPageToBottom();
    const newHeight = await page.evaluate(() => document.body.scrollHeight);
    // Breaking the loop if no new content is loaded
    if (newHeight === previousHeight) {
      break;
    }
    previousHeight = newHeight;
  }
  
  const content = await page.evaluate(() => document.body.innerText.trim());
  await browser.close();
  console.log(`Scraped content from ${url}`);
  return content;
}

async function scrapeLinkedIn(company, linkedinUrl) {
    console.log(`Scraping LinkedIn for ${company}: ${linkedinUrl}`);
    const browser = await puppeteer.launch({headless: true});
    const cookies = await loadLinkedInCookie();
    if (cookies.length) {
        await browser.setCookie(...cookies);
    }
    const page = await browser.newPage();
    await page.setDefaultNavigationTimeout(0);
    await page.goto(linkedinUrl, { waitUntil: 'domcontentloaded', timeout:'0'});
    await page.waitForNetworkIdle({ idleTime: 1000 });

    const scrollPageToBottom = async () => {
      await page.evaluate(() => {
        window.scrollTo(0, document.body.scrollHeight);
      });
      await page.waitForNetworkIdle(250); // Adjust timeout as needed
    };
  
    // Scrolling in a loop until a certain condition is met
    let previousHeight = 0;
    while (true) {
      await scrollPageToBottom();
      const newHeight = await page.evaluate(() => document.body.scrollHeight);
      // Breaking the loop if no new content is loaded
      if (newHeight === previousHeight) {
        break;
      }
      previousHeight = newHeight;
    }
    
    const content = await page.evaluate(() => document.body.innerText.trim());
    await browser.close();
    console.log(`Scraped Linkedin content for ${company}`);
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
        report += `\n\n\n\n\n\n${company} published on their website articles that cover these topics:\n\n\n\n${summary}\n\n`;
    }
    return report;
}

async function generateLinkedInReport() {
    console.log('Generating LinkedIn report...');
    const week = await getCurrentWeek();
    let report = `${week}\n`;
    for (const { company, linkedin } of urls) {
        if (!linkedin) continue;
        console.log(`Processing LinkedIn content for ${company}...`);
        let content = await scrapeLinkedIn(company, linkedin);
        const summary = await summarizeContent(content);
        report += `\n\n\n\n\n\n${company} posted on LinkedIn articles that cover these topics:\n\n\n\n${summary}\n\n`;
    }
    return report;
}

bot.command('websitesummary', async (ctx) => {
    console.log(`User requested website summary: ${ctx.chat.id}`);
    ctx.reply("Generating website summary, please wait for 5-6 minutes...");
    try {
        const report = await generateWebsiteReport();
        const messageParts = splitMessage(report);
        messageParts.forEach(part => ctx.reply(part, { parse_mode: 'Markdown' }));
    } catch (error) {
        console.error('Error generating website summary:', error);
        ctx.reply("An error occurred while generating the website summary.");
    }
});

bot.command('linkedinsummary', async (ctx) => {
    console.log(`User requested LinkedIn summary: ${ctx.chat.id}`);
    ctx.reply("Generating LinkedIn summary, please wait for 5-6 minutes...");
    try {
        const report = await generateLinkedInReport();
        const messageParts = splitMessage(report);
        messageParts.forEach(part => ctx.reply(part, { parse_mode: 'Markdown' }));
    } catch (error) {
        console.error('Error generating LinkedIn summary:', error);
        ctx.reply("An error occurred while generating the LinkedIn summary.");
    }
});

cron.schedule('0 9 * * 1', async () => {//every Monday at 09:00 AM '0 9 * * 1'
    console.log('Scheduled task: Generating weekly website and LinkedIn reports...');
    try {
        const websiteReport = await generateWebsiteReport();
        const linkedinReport = await generateLinkedInReport();
        const fullReport = `${websiteReport}\n\n\n\n\n\n\n\n\n\n\n\n\n${linkedinReport}`;
        const messageParts = splitMessage(fullReport);
        userChatIds.forEach(chatId => {
            messageParts.forEach(part => bot.telegram.sendMessage(chatId, part, { parse_mode: 'Markdown' }));
        });
    } catch (error) {
        console.error('Error in scheduled task:', error);
    }
});

cron.schedule('0 9 */12 * *', () => {
    userChatIds.forEach(chatId => {
        bot.telegram.sendMessage(chatId, "Reminder: Update your LinkedIn session cookie file using /updatecookie to prevent expiration. You should check if new one works by running /linkedinsummary. If it doesn't work - contact @Rediska5_5_5 (author). Upload JSON-format cookie file of the LinkedIn session provided by this extension. https://chromewebstore.google.com/detail/export-cookie-json-file-f/nmckokihipjgplolmcmjakknndddifde?hl=ru. Make sure to update it every 12 days to avoid expiration. BE AWARE: YOUR LINKEDIN ACCOUNT MAY BE BANNED FOR SCRAPING DATA!");
    });
});


console.log('Bot is running and scheduled to send reports every Monday at 09:00 AM.');

bot.launch().then(() => console.log('Bot launched successfully.')).catch(error => console.error('Error launching bot:', error));
