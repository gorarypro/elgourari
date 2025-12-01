/** ========================================================
 *  Multipurpose Website Builder – Backend (Code.gs)
 *  SAFE VERSION — JSONP + Base64 theme XML
 *  ========================================================
 *
 *  Frontend (runtime.js) calls this as JSONP:
 *    BASE_SCRIPT_URL?action=getSettings&callback=Runtime.__jsonp_cb_...
 *
 *  doGet() detects ?callback=... and wraps JSON as:
 *    callback({...});
 */

/* ========================================================
 *  GitHub Integration (optional)
 * ======================================================== */
// These constants are just defaults. In practice, we mainly
// read github_* settings from the Settings sheet.
const GITHUB_ENABLED = true;
const GITHUB_REPO = 'gorarypro/multipurpose-website-builder';
const GITHUB_BRANCH = 'main';

/* ========================================================
 *  Sheets & Blogger constants
 * ======================================================== */
const SPREADSHEET_ID    = '1JEqIVnhjDaz7otgNAikpQj7Trw1SRG_0-iSfYMLQwtA';
const SETTINGS_SHEET    = 'Settings';
const ENTRIES_SHEET     = 'Entries';
const TEXTMAPPING_SHEET = 'TextMapping';
const THEMES_SHEET      = 'Themes';

// Fallback Blogger feed URL if none set in the Settings sheet
const BLOG_FEED_URL     = 'https://eventsushi1.blogspot.com/feeds/posts/default?alt=json&max-results=50';

/* ========================================================
 * doGet — serves Builder UI or JSON/JSONP API
 * ======================================================== */
function doGet(e) {
  const params = e && e.parameter ? e.parameter : {};
  const action = params.action || '';

  // No action → serve the Builder UI
  if (!action) {
    return HtmlService
      .createTemplateFromFile('Builder')
      .evaluate()
      .setXFrameOptionsMode(HtmlService.XFrameOptionsMode.ALLOWALL);
  }

  // API actions
  switch (action) {
    case 'getSettings':
      return json(getSettings(), e);

    case 'saveSettings':
      return json(saveSettings(params.config), e);

    case 'getProducts':
      return json(getProducts(), e);

    case 'getTextMap':
      return json(getTextMapping(), e);

    case 'saveEntry':
      return json(saveEntry(params.entry), e);

    case 'generateTheme':
      return json(generateTheme(params.name), e);

    case 'saveThemeXml':
      return json(saveThemeXml(params.name, params.xml), e);

    case 'pushThemeToGitHub':
      return json(pushThemeToGitHub(params.name), e);

    default:
      return json(
        { status: 'error', message: 'Unknown action: ' + action },
        e
      );
  }
}

/**
 * json(obj, e)
 * - If e.parameter.callback exists → JSONP (callback(<json>);)
 * - Else → normal JSON
 */
function json(obj, e) {
  const callback =
    e && e.parameter && typeof e.parameter.callback === 'string'
      ? e.parameter.callback
      : null;

  const text = JSON.stringify(obj);

  if (callback) {
    // JSONP
    return ContentService
      .createTextOutput(callback + '(' + text + ');')
      .setMimeType(ContentService.MimeType.JAVASCRIPT);
  }

  // Plain JSON
  return ContentService
    .createTextOutput(text)
    .setMimeType(ContentService.MimeType.JSON);
}

/* ========================================================
 * SETTINGS
 * ======================================================== */
function getSettings() {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(SETTINGS_SHEET);

  const rows = sheet.getDataRange().getValues();
  const map = {};

  // Row 0 = header, start from 1
  for (let i = 1; i < rows.length; i++) {
    const key = rows[i][0];
    const value = rows[i][1];
    if (key) map[key] = value;
  }

  return { status: 'ok', settings: map };
}

function saveSettings(jsonConfig) {
  const config = JSON.parse(jsonConfig);
  const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
  const sheet = ss.getSheetByName(SETTINGS_SHEET);
  const rows = sheet.getDataRange().getValues();

  const indexMap = {};
  for (let i = 1; i < rows.length; i++) {
    const key = rows[i][0];
    if (key) indexMap[key] = i + 1; // 1-based
  }

  Object.keys(config).forEach(key => {
    if (indexMap[key]) {
      sheet.getRange(indexMap[key], 2).setValue(config[key]);
    } else {
      const last = sheet.getLastRow() + 1;
      sheet.getRange(last, 1).setValue(key);
      sheet.getRange(last, 2).setValue(config[key]);
    }
  });

  return { status: 'ok' };
}

/* ========================================================
 * PRODUCTS (Blogger / WordPress)
 * ======================================================== */
function getProducts() {
  const settings = getSettings().settings;
  const source = settings.product_source || 'blogger';

  if (source === 'wordpress' || source === 'woocommerce') {
    return { status: 'ok', items: fetchFromWordPress(settings) };
  }

  // Default: Blogger
  return { status: 'ok', items: fetchFromBlogger(settings) };
}

/* ===== Blogger ===== */
function fetchFromBlogger(settings) {
  // Prefer Settings sheet value, fallback to BLOG_FEED_URL constant
  const feedUrl = settings.blogger_feed_url || BLOG_FEED_URL;
  if (!feedUrl) return [];

  const resp = UrlFetchApp.fetch(feedUrl);
  const data = JSON.parse(resp.getContentText());

  const entries = (data.feed && data.feed.entry) || [];
  return entries.map(entry => normalizeBloggerEntry(entry));
}

function normalizeBloggerEntry(entry) {
  const title   = entry.title  && entry.title.$t  ? entry.title.$t  : '';
  const content = entry.content && entry.content.$t ? entry.content.$t : '';
  const labels  = (entry.category || []).map(c => c.term);

  return {
    id      : entry.id && entry.id.$t ? entry.id.$t : '',
    title   : title,
    content : content,
    labels  : labels,
    image   : extractImageFromHtml(content),
    price   : extractPrice(content, labels),
    variants: extractVariantsFromLabels(labels)
  };
}

function extractImageFromHtml(html) {
  const m = html.match(/<img[^>]+src=["']([^"']+)["']/i);
  return m ? m[1] : '';
}

function extractPrice(content, labels) {
  const m = content.match(/price[:=]\s*([\d.,]+)/i);
  if (m) return m[1];

  const label = labels.find(l => /^price[-:]/i.test(l));
  return label ? label.split(/[-:]/)[1] : '';
}

function extractVariantsFromLabels(labels) {
  const map = {};
  (labels || []).forEach(label => {
    const p = label.indexOf(':');
    if (p > 0) {
      const group  = label.slice(0, p).trim();
      const option = label.slice(p + 1).trim();
      if (!map[group]) map[group] = [];
      if (!map[group].includes(option)) map[group].push(option);
    }
  });
  return map;
}

/* ===== WordPress (placeholder) ===== */
function fetchFromWordPress(settings) {
  // Example:
  // const url  = settings.wp_api_url;
  // if (!url) return [];
  // const json = UrlFetchApp.fetch(url).getContentText();
  // return JSON.parse(json).map(item => normalizeWordPress(item));
  return [];
}

/* ========================================================
 * TEXT MAPPING
 * ======================================================== */
function getTextMapping() {
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(TEXTMAPPING_SHEET);

  const data = sheet.getDataRange().getValues();
  const headers = data.shift();  // first row = header
  const result = {};

  data.forEach(row => {
    const key = row[0];
    if (!key) return;

    result[key] = { default: row[1] };
    for (let i = 2; i < headers.length; i++) {
      const lang = headers[i];
      if (lang) {
        result[key][lang] = row[i];
      }
    }
  });

  return { status: 'ok', map: result };
}

/* ========================================================
 * SAVE ENTRIES (orders / forms)
 * ======================================================== */
function saveEntry(entryJson) {
  const entry = JSON.parse(entryJson);
  const sheet = SpreadsheetApp
    .openById(SPREADSHEET_ID)
    .getSheetByName(ENTRIES_SHEET);

  sheet.appendRow([
    new Date(),
    entry.type      || '',
    entry.productId || '',
    entry.title     || '',
    entry.variants  || '',
    entry.quantity  || '',
    entry.price     || '',
    entry.total     || '',
    entry.name      || '',
    entry.email     || '',
    entry.phone     || '',
    entry.message   || ''
  ]);

  return { status: 'ok' };
}

/* ========================================================
 * THEME GENERATION — SAFE BASE64 VERSION
 * ======================================================== */
function generateTheme(name) {
  try {
    const template = HtmlService.createTemplateFromFile('ThemeTemplate');
    template.settings = getSettings().settings;

    // Render full Blogger theme XML
    const xml = template.evaluate().getContent();

    // Encode before sending to frontend (IMPORTANT)
    const encoded = Utilities.base64Encode(xml);

    return {
      status: 'ok',
      xml   : encoded,
      name  : name
    };

  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/* ========================================================
 * SAVE THEME XML TO SHEET
 * ======================================================== */
function saveThemeXml(name, xmlPlain) {
  try {
    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    let sheet = ss.getSheetByName(THEMES_SHEET);

    if (!sheet) {
      sheet = ss.insertSheet(THEMES_SHEET);
      sheet.appendRow(['theme_name', 'xml', 'timestamp']);
    }

    sheet.appendRow([name, xmlPlain, new Date()]);
    return { status: 'ok' };

  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/* ========================================================
 * PUSH THEME TO GITHUB (optional)
 * ======================================================== */
function pushThemeToGitHub(name) {
  try {
    const settings = getSettings().settings;

    // Prefer sheet settings; fallback to constants
    const enabledFlag = (settings.github_enabled || '').toString().toLowerCase();
    const repo   = settings.github_repo   || GITHUB_REPO;
    const branch = settings.github_branch || GITHUB_BRANCH;
    const token  = settings.github_token  || null;

    if (!token || !repo || enabledFlag === 'no') {
      return { status: 'error', message: 'GitHub not configured' };
    }

    const ss = SpreadsheetApp.openById(SPREADSHEET_ID);
    const sheet = ss.getSheetByName(THEMES_SHEET);
    if (!sheet) {
      return { status: 'error', message: 'Themes sheet not found.' };
    }

    const rows = sheet.getDataRange().getValues();
    const row = rows.find(r => r[0] === name);
    if (!row) {
      return { status: 'error', message: 'Theme not found in sheet.' };
    }

    const xml  = row[1];
    const path = 'themes/' + name + '.xml';

    const url = 'https://api.github.com/repos/' + repo + '/contents/' + path;

    const body = {
      message: 'Upload Blogger theme XML',
      content: Utilities.base64Encode(xml),
      branch : branch
    };

    const options = {
      method : 'put',
      headers: {
        Authorization: 'token ' + token,
        Accept      : 'application/vnd.github+json'
      },
      payload           : JSON.stringify(body),
      muteHttpExceptions: true
    };

    const resp = UrlFetchApp.fetch(url, options);
    const jsonResp = JSON.parse(resp.getContentText());

    if (jsonResp.content && jsonResp.content.path) {
      return { status: 'ok', path: jsonResp.content.path };
    }

    return { status: 'error', message: JSON.stringify(jsonResp) };

  } catch (err) {
    return { status: 'error', message: err.toString() };
  }
}

/* ========================================================
 * HTML Includes for Template()
 * ======================================================== */
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

/* ========================================================
 * Helpers
 * ======================================================== */

/**
 * escapeXml(str)
 * Safely escape user / settings content before injecting into XML.
 * Use this INSIDE ThemeTemplate.html where needed via <?= escapeXml(...) ?>.
 */
function escapeXml(str) {
  if (!str) return '';
  return String(str)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

/**
 * manualGithubAuth()
 * - Run once from the Script Editor to force:
 *   - external_request scope
 *   - https://api.github.com URL whitelist
 */
function manualGithubAuth() {
  UrlFetchApp.fetch('https://api.github.com');
}

/**
 * testBloggerFetch()
 * - Optional helper to test BLOG_FEED_URL / settings.blogger_feed_url.
 * - Run manually from the Script Editor. Check the Logs for the status.
 */
function testBloggerFetch() {
  const settings = getSettings().settings;
  const feedUrl = settings.blogger_feed_url || BLOG_FEED_URL;
  const resp = UrlFetchApp.fetch(feedUrl);
  Logger.log(resp.getResponseCode());
}

function debugGithubSettings() {
  const s = getSettings().settings;
  Logger.log('github_repo = ' + s.github_repo);
  Logger.log('github_token = ' + (s.github_token ? 'present' : 'MISSING'));
  Logger.log('github_branch = ' + s.github_branch);
  Logger.log('github_enabled = ' + s.github_enabled);
}
