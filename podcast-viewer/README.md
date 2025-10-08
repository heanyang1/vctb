# Podcast Viewer (static)

This is a small static web app that searches podcasts using the iTunes Search API and lists episodes by parsing podcast RSS feeds.

Files added:
- `index.html` — main page
- `styles.css` — small stylesheet
- `app.js` — vanilla JS implementing iTunes search and RSS parsing

How it works
- Search: the page calls the iTunes Search API from the browser.
- Episodes: the page fetches the podcast RSS feed and parses it in-browser to extract <enclosure> URLs. Some RSS feeds don't allow CORS; the app will try a public proxy (AllOrigins) when direct fetch fails.

Notes and limitations
- Public CORS proxies may be rate-limited or unavailable. For production use, host your own lightweight proxy or server-side endpoint to fetch RSS.
- The app intentionally keeps dependencies to zero (vanilla JS) and is intended for local/static hosting.

To run
1. Open `index.html` in a browser. For best results, serve the folder with a static server (e.g., `python -m http.server`) to avoid file:// restrictions.
