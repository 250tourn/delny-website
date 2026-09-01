/* ====================================================================
   SHARED CONFIG + DATA UTILITIES — used by both index.html and post.html
   ---------------------------------------------------------------------
   GOOGLE SHEET SETUP (one-time)

   1. Create a Google Sheet with four tabs, named exactly:

        "Gallery" — header row: Title | ImageURL | Link
          - Title:    caption / alt text for the piece
          - ImageURL: paste the ordinary Google Drive share link for the
                      photo (see "Adding photos" below) — the site
                      converts it automatically, no editing needed
          - Link:     (optional) where clicking the thumbnail should go;
                      falls back to ImageURL if left blank

      Adding photos (Google Drive):
        a. Create a folder in Google Drive, e.g. "Delny Website Images".
        b. Right-click the folder -> Share -> General access ->
           "Anyone with the link" -> Viewer. (Do this once.)
        c. Upload artwork photos into that folder. Drive doesn't compress
           these for the web, so before uploading, resize/export each
           photo to roughly 2000px on the longest side (a few hundred KB)
           — otherwise a full-resolution camera photo loads as-is and
           can slow the page down.
        d. Right-click a photo -> Share -> "Copy link", and paste that
           link straight into the ImageURL (or CoverImageURL) column.

        "Events" — header row: Date | Title | Location | Time | Price | BookingLink
          - Rows display in the order they appear in the sheet, so keep
            them sorted by date manually.

        "Shop" — header row: Title | Price | ImageURL | BuyLink
          - ImageURL: same Google Drive share-link workflow as Gallery
          - BuyLink:  a PayPal.me link, a PayPal "Buy Now" button link,
                      or a Stripe Payment Link — whichever you're using
                      for that item. The button just opens this URL.

        "News" — header row: Date | Title | Excerpt | CoverImageURL | Body
          - Rows display in the order they appear in the sheet, so put
            the newest post at the top.
          - Excerpt:       a short 1-2 sentence teaser shown on the
                            homepage card.
          - CoverImageURL: (optional) Drive share link for a header image.
          - Body:          the full post, shown on its own page when the
                            card is clicked. Tip: draft it somewhere
                            comfortable first (Notepad, Google Docs, Word)
                            then paste the finished text in — a Sheet
                            cell is a fine home for the final text, not
                            a fun place to write a first draft.

            A little formatting is supported in Body:
              - Leave a blank line between paragraphs.
              - **bold** and *italic*
              - [link text](https://example.com)
              - ![](https://drive-share-link) on its own line drops in
                an image at full width — same Drive-link workflow as
                everywhere else on the site.

   2. Share the sheet: Share -> General access -> "Anyone with the link"
      -> Viewer. (No Google login needed for visitors, and nothing is
      editable from the public link.)

   3. Copy the Sheet ID out of its URL:
      https://docs.google.com/spreadsheets/d/ >>THIS PART<< /edit
      and paste it into SHEET_ID below.

   Once SHEET_ID is set, editing rows in the Sheet updates the live site
   on next page load — no code, no redeploy. Until it's set, or if the
   sheet is unreachable, the placeholder content already in the page is
   shown instead.
   ==================================================================== */
const SHEET_ID = '1d_IhI7NfcPjRlQCbKaEACOc4PsFmYC75iUOmpUW1v7k';
const GALLERY_TAB = 'Gallery';
const EVENTS_TAB = 'Events';
const SHOP_TAB = 'Shop';
const NEWS_TAB = 'News';

function sheetCsvUrl(tabName) {
  return `https://docs.google.com/spreadsheets/d/${SHEET_ID}/gviz/tq?tqx=out:csv&sheet=${encodeURIComponent(tabName)}`;
}

function parseCSV(text) {
  const rows = [];
  let row = [], field = '', inQuotes = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i], next = text[i + 1];
    if (inQuotes) {
      if (c === '"' && next === '"') { field += '"'; i++; }
      else if (c === '"') { inQuotes = false; }
      else { field += c; }
    } else if (c === '"') { inQuotes = true; }
    else if (c === ',') { row.push(field); field = ''; }
    else if (c === '\r') { /* ignore */ }
    else if (c === '\n') { row.push(field); rows.push(row); row = []; field = ''; }
    else { field += c; }
  }
  if (field.length || row.length) { row.push(field); rows.push(row); }
  return rows.filter(r => r.some(f => f.trim() !== ''));
}

function rowsToObjects(rows) {
  if (!rows.length) return [];
  const headers = rows[0].map(h => h.trim());
  return rows.slice(1).map(r => {
    const obj = {};
    headers.forEach((h, i) => { obj[h] = (r[i] || '').trim(); });
    return obj;
  });
}

// Note: if a tab named `tabName` doesn't exist, Google's CSV export
// does NOT return an error — it silently falls back to a different tab
// in the sheet. `expectedHeaders` guards against that: if the columns
// that come back don't match what this tab is supposed to have, treat
// it as a failure (and fall back to the page's placeholder content)
// rather than rendering the wrong sheet's data under the wrong heading.
async function fetchTab(tabName, expectedHeaders) {
  const res = await fetch(sheetCsvUrl(tabName));
  if (!res.ok) throw new Error(`Could not load "${tabName}" tab (HTTP ${res.status})`);
  const text = await res.text();
  if (text.trim().startsWith('<')) throw new Error(`"${tabName}" tab isn't shared publicly yet`);
  const rows = parseCSV(text);
  if (expectedHeaders && rows.length) {
    const headers = rows[0].map(h => h.trim());
    const missing = expectedHeaders.filter(h => !headers.includes(h));
    if (missing.length) {
      throw new Error(`"${tabName}" tab is missing column(s) ${missing.join(', ')} — does a tab named exactly "${tabName}" exist?`);
    }
  }
  return rowsToObjects(rows);
}

function escapeHtml(str) {
  return String(str || '').replace(/[&<>"']/g, c => ({
    '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;'
  }[c]));
}

// Turns an ordinary Google Drive share link (whatever form Drive's
// "Copy link" button produces) into a URL that actually works as an
// <img src>. Anything that isn't a recognizable Drive link — e.g. an
// Imgur or other direct image URL — is passed through unchanged.
function toImageUrl(url) {
  url = String(url || '').trim();
  const patterns = [
    /drive\.google\.com\/file\/d\/([\w-]+)/,   // .../file/d/FILE_ID/view
    /drive\.google\.com\/open\?id=([\w-]+)/,    // .../open?id=FILE_ID
    /[?&]id=([\w-]+)/                           // .../uc?id=FILE_ID
  ];
  for (const re of patterns) {
    const m = url.match(re);
    if (m) return `https://lh3.googleusercontent.com/d/${m[1]}=w1200`;
  }
  return url;
}

// Turns a post Title into the URL-friendly slug used to link to it
// from the homepage and to find it again on post.html.
function slugify(str) {
  return String(str || '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/(^-+|-+$)/g, '');
}

// Very small Markdown-like formatter for News post bodies: bold,
// italic, links, and inline images. Deliberately not a full Markdown
// parser — just enough that a spreadsheet cell can produce a readable,
// nicely formatted post.
function renderInline(text) {
  let html = escapeHtml(text);
  html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, (m, label, url) =>
    `<a href="${escapeHtml(url)}" target="_blank" rel="noopener">${label}</a>`);
  html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
  return html;
}

function renderBodyHtml(body) {
  const blocks = String(body || '').trim().split(/\n\s*\n/);
  return blocks.map(block => {
    const trimmed = block.trim();
    const imgMatch = trimmed.match(/^!\[([^\]]*)\]\(([^)]+)\)$/);
    if (imgMatch) {
      const alt = escapeHtml(imgMatch[1]);
      const src = escapeHtml(toImageUrl(imgMatch[2]));
      return `<figure class="post-image"><img src="${src}" alt="${alt}" loading="lazy"></figure>`;
    }
    const withBreaks = trimmed.split('\n').map(renderInline).join('<br>');
    return `<p>${withBreaks}</p>`;
  }).join('\n');
}
