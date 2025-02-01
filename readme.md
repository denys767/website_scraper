# Usage
1. Access the bot in Telegram: ```@kse_webscraper_bot```
2. Start the bot to subscribe to weekly summaries at Monday 9am.
3. Execute bot's commands provided in its menu to get summaries manually.
4. Update bot's cookies **every 12-13 days** using instruction below. If you don't update cookies, **LinkedIn summaries will stop working, because cookies expire in 13-14 days!**

# Installation (If you want to host this bot)
1. Create ```.env``` with these parameters:
```
TELEGRAM_BOT_TOKEN=3859034589fgdkjlgkjdlfgjkl345
TELEGRAM_CHAT_ID=123234345
OPENAI_API_KEY=sk-proj-sfsfsdf-sdfsdfjoSDFijIODFisdfuisifsjkfjlSJkfdjskldfsdf
```
2. Fill out ```urls.json``` file with your links.
3. Create ```linkedin_cookie.json``` file and paste there your linkedin session cookie json-content from this extension https://chromewebstore.google.com/detail/export-cookie-json-file-f/nmckokihipjgplolmcmjakknndddifde.
4. Create ```chat_ids.json``` and start the bot with ```/start``` command to register your chat id.
5. execute ```npm install .```
6. start with ```npm start```
7. If you run this bot on linux, install ```chromium``` (```apt-get install chromium -y```). If you run it in Windows, change all ```const browser;``` to ```const browser = await puppeteer.launch({headless: true});```

