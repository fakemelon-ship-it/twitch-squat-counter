import express from "express";
import fs from "fs";
import puppeteer from "puppeteer-core";
import chromium from "@sparticuz/chromium";

const app = express();
const PORT = process.env.PORT || 10000; // Render auto-assigns this
const CHANNEL = "deathknightrealofficial";
const DB_FILE = "count.json";

// ensure file exists
if (!fs.existsSync(DB_FILE)) fs.writeFileSync(DB_FILE, JSON.stringify({ count: 0 }));

const readCount = () => JSON.parse(fs.readFileSync(DB_FILE)).count;
const writeCount = (val) => fs.writeFileSync(DB_FILE, JSON.stringify({ count: val }));

// main counter page
app.get("/counter", (req, res) => {
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
      <div id="count">${readCount()}</div>
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

// optional reset endpoint
app.get("/reset", (req, res) => {
  writeCount(0);
  res.send("Counter reset to 0");
});

// Twitch watcher (runs headless)
async function startWatcher() {
  try {
    const executablePath = await chromium.executablePath();
    const browser = await puppeteer.launch({
      args: chromium.args,
      defaultViewport: chromium.defaultViewport,
      executablePath,
      headless: chromium.headless,
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
        if (!chat) return setTimeout(start, 2000);
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

    console.log("✅ Twitch watcher running.");
  } catch (err) {
    console.error("❌ Watcher error:", err);
    // Retry automatically after 30 seconds if it fails
    setTimeout(startWatcher, 30000);
  }
}

app.listen(PORT, () => console.log(`✅ Server live on port ${PORT}`));
startWatcher();

