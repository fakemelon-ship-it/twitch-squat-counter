// server.js – Twitch "10 Squats" Counter Bot for Render
import express from "express";
import fs from "fs";
import puppeteer from "puppeteer";

const app = express();
const PORT = process.env.PORT || 3000;
const CHANNEL = "deathknightrealofficial"; // Twitch channel name
const DB_FILE = "count.json";

// make sure the file exists
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ count: 0 }));

const readCount = () => JSON.parse(fs.readFileSync(DB_FILE)).count;
const writeCount = (val) => fs.writeFileSync(DB_FILE, JSON.stringify({ count: val }));

// main counter page for OBS
app.get("/counter", (req, res) => {
  const c = readCount();
  res.send(`
    <html><head>
    <style>
      body {background:#000;color:#fff;font-family:sans-serif;text-align:center;
            height:100vh;display:flex;flex-direction:column;justify-content:center;}
      #count {font-size:140px;color:#9146FF;text-shadow:0 0 20px #9146FF;}
      h1 {font-size:28px;color:#aaa;margin:0;}
    </style></head>
    <body>
      <h1>Total Squats</h1>
      <div id="count">${c}</div>
      <script>
        setInterval(async ()=>{
          const r = await fetch('/value');
          const j = await r.json();
          document.getElementById('count').textContent = j.count;
        },1500);
      </script>
    </body></html>
  `);
});

app.get("/value", (req, res) => res.json({ count: readCount() }));

// Twitch watcher (runs in headless Chrome)
async function startWatcher() {
  const browser = await puppeteer.launch({
    headless: true,
    args: ["--no-sandbox", "--disable-setuid-sandbox"],
  });
  const page = await browser.newPage();
  await page.goto(`https://www.twitch.tv/${CHANNEL}`, { waitUntil: "domcontentloaded" });

  await page.exposeFunction("onRedeem", (text) => {
    if (/redeem(ed|s)?/i.test(text) && /10\s*squats/i.test(text)) {
      const c = readCount() + 10;
      writeCount(c);
      console.log(`+10 Squats! Total: ${c}`);
    }
  });

  await page.evaluate(() => {
    function findChat() {
      return (
        document.querySelector('[data-a-target="chat-scroller"]') ||
        document.querySelector(".chat-scrollable-area__message-container")
      );
    }
    function scanNode(n) {
      const text = (n.innerText || n.textContent || "").trim();
      if (/redeem(ed|s)?/i.test(text) && /10\s*squats/i.test(text))
        window.onRedeem(text);
    }
    function start() {
      const chat = findChat();
      if (!chat) return setTimeout(start, 1000);
      const mo = new MutationObserver((muts) => {
        muts.forEach((m) =>
          m.addedNodes.forEach((n) => {
            if (n.nodeType === 1) scanNode(n);
          })
        );
      });
      mo.observe(chat, { childList: true, subtree: true });
      console.log("Watching chat for 'redeemed 10 squats'...");
    }
    start();
  });
}

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
startWatcher();

