LEAD SCRAPER - portable edition
===============================

Nothing to install: Node.js is included.

1. Unzip this folder somewhere permanent (for example C:\LeadScraper).
   Do not run it from inside the zip file.

2. Double-click start.bat.
   A black window opens and, a few seconds later, your browser opens the app.
   - If Windows says "Windows protected your PC", click "More info", then
     "Run anyway".
   - If the browser does not open by itself, go to  http://localhost:3210

3. Sign in with the email and password your admin gave you.

4. KEEP THE BLACK WINDOW OPEN while you work. Scrapes and contact lookups run
   inside it - closing the window (or turning the PC off) stops them.
   To quit, close the black window.

Your data is not stored on this PC. It lives in the team's shared database,
but you only see what you scraped yourself - your searches, products, brands
and Ad Library results. The admin sees everyone's.

Started a scrape by mistake? Open it (Jobs) and click "Stop job". Whatever it
found so far is kept.

Looked a brand up yourself? Open it in Brands, type in the website / email /
phone and press Save. The status updates by itself (or pick one in the Status
box). Only brands marked Found or Partial are included in the Brands export.


If something goes wrong
-----------------------
- The black window says the port is already in use: the app is already running
  (look for another black window), or another program is using port 3210.
- Signing in says it "isn't available right now": this PC cannot reach the
  database. Check the internet connection, then tell your admin.
- Pages show errors about "fetch failed": a network hiccup on this PC. Wait a
  minute and try again; a lookup that could not run is retried later.


Keep this folder inside the team
--------------------------------
It contains the team's database password and API keys (the .env file). Do not
email it or upload it anywhere public.
