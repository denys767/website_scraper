# Usage
1. Access the bot in Telegram: ```@kse_webscraper_bot```
2. Start the bot to subscribe to weekly summaries at Monday 9am.
3. Execute bot's commands provided in its menu to get summaries manually.
![alt text](/images/image2.png)
4. Update bot's cookies **every 12-13 days** using instruction below. If you don't update cookies, **LinkedIn summaries will stop working, because cookies expire in 13-14 days!**

## How to update LinkedIn Cookie?
1. Download this extension: https://chromewebstore.google.com/detail/export-cookie-json-file-f/nmckokihipjgplolmcmjakknndddifde
2. Go to LinkedIn, log into your account and export a JSON file using the extension. ![alt text](/images/image.png)
3. Run ```/updatecookie``` command in the bot.
4. Upload the JSON file after running the command. **Be aware that scraping data from LinkedIn is against their TOS, your account may get banned - don't use your main account!** 
5. Cookie should be successfully updated.
6. To check whether cookie update worked, run ```/linkedinsummary``` command. If results are not as expected, contact the developer (me :L ): @Rediska5_5_5.





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
7. If you run this bot on linux, you are likely to encounter this error
```
0|index  | Error generating website summary: Error: Failed to launch the browser process!
0|index  | /root/.cache/puppeteer/chrome/linux-131.0.6778.204/chrome-linux64/chrome: error while loading shared libraries: libnss3.so: cannot open shared object file: No such file or directory
```
To counter this, install chromium-browser ```apt-get install chromium -y``` and change your browser values in ```index.js``` like this:
```
const browser = await puppeteer.launch({ executablePath: '/usr/bin/chromium-browser', args: [ '--disable-gpu', '--disable-setuid-sandbox', '--no-sandbox', '--no-zygote' ] });
```
