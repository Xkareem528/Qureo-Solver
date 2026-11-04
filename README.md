# QUREO Solver — merged prototype

## What is included
- Original dark/purple Arabic RTL visual direction, rebuilt as a connected dashboard.
- Express + SQLite backend.
- 42 placeholder chapter rows (not real QUREO chapter content).
- Save/search/match question API. Matching ignores choice order.
- Optional page helper in `reader/reader-bookmarklet.js`.

## Run locally
Requires Node.js 18+ and npm.

```bash
npm install
npm start
```
Open `http://localhost:3000`. The SQLite database `qureo.db` is created automatically.

## Page helper setup
1. Deploy this app to a host that provides a public HTTPS URL.
2. Open `reader/reader-bookmarklet.js` and replace `https://YOUR-DEPLOYED-APP.example.com` with that URL.
3. Install the script using a userscript manager in a compatible browser, or adapt it as a bookmarklet.
4. Log in to QUREO yourself, open a lesson, select the visible question text, and use the helper.
5. Enter options and the verified answer manually to save it. On a repeat, use Match to look up the saved answer.

## Important limitations
- QUREO's live page structure has not been inspected or tested here, so automatic DOM extraction is not implemented. The helper captures selected visible text; options are entered manually.
- The app does not collect QUREO credentials, cookies, or session tokens, and does not submit answers.
- Chapter titles and initial statistics are placeholders until real data is added.
- This prototype has no multi-user authentication. Do not expose it publicly with private data until authentication and access controls are added.
