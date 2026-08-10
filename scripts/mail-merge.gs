/**
 * Final-call mail merge — Google Apps Script.
 *
 * Sends one personalised email per row from Ani's own Gmail, each carrying a
 * private /letter/<token> link. Never BCC: every link differs.
 *
 * SETUP
 *  1. Run `node scripts/generate-letter-invites.mjs --write --csv merge.csv`
 *  2. Upload merge.csv to Google Drive, open it as a Google Sheet
 *  3. Add a 6th column with the header `sent_at` (leave the cells empty)
 *  4. Extensions → Apps Script, paste this file, Save
 *  5. Run `sendTest` first. Authorise when prompted.
 *  6. Check the five test inboxes, then run `sendAll`.
 *
 * SAFETY
 *  - `sendTest` only mails addresses in TEST_RECIPIENTS, ignoring the sheet.
 *  - `sendAll` skips any row that already has a `sent_at`, so if it dies
 *    halfway you just run it again. Nobody gets two copies.
 *  - Consumer Gmail allows ~500 recipients/day. This send is 63.
 */

// ---------------------------------------------------------------- config ----

var CONFIG = {
  SUBJECT: "one last invitation",
  FROM_NAME: "Ani Nair",
  REPLY_TO: "anirudhnair42@gmail.com",

  /** Only used by sendTest(). Ani's five addresses go here. */
  TEST_RECIPIENTS: [
    // "someone@example.com",
  ],

  /** Pause between sends, milliseconds. Gentle on the quota, looks less bulk. */
  THROTTLE_MS: 1200,

  /** Column headers expected in row 1 of the sheet. */
  COL: {
    name: "name",
    firstName: "first_name",
    email: "email",
    variant: "variant",
    url: "letter_url",
    sentAt: "sent_at",
  },
};

// ------------------------------------------------------------------ copy ----

/**
 * The email is deliberately short. It is the knock on the door; the letter
 * behind the link carries the weight.
 */
function buildBody(firstName, letterUrl, variant) {
  var opening =
    variant === "unfinished"
      ? "You started an RSVP a few days ago and did not finish it, which we are choosing to read as a maybe. We wrote you a letter anyway. It has your name on it, and it is the last time we will ask."
      : "We wrote you a letter. It has your name on it, and it is the last time we will ask.";

  var text =
    "Dear " + firstName + ",\n\n" +
    opening + "\n\n" +
    letterUrl + "\n\n" +
    "RSVP closes tonight at 11:00 PM Pacific. Ani would like it noted that " +
    "ALF only counted an extension if you submitted after the 7th minute, so " +
    "in practice you have until 11:07. He knows this from experience.\n\n" +
    "Amal, Dulce, Ani, Nathan, Mau and Anna";

  // Inline styles only, and no background images: Gmail and Outlook strip
  // <style> blocks, and a letter that arrives unstyled should still read well.
  var html =
    '<div style="font-family:Georgia,\'Times New Roman\',serif;font-size:16px;' +
    'line-height:1.65;color:#1f1d1a;max-width:520px;">' +
    "<p>Dear " + escapeHtml(firstName) + ",</p>" +
    "<p>" + escapeHtml(opening) + "</p>" +
    '<p style="margin:26px 0;">' +
    '<a href="' + letterUrl + '" ' +
    'style="background:#f15923;color:#ffffff;text-decoration:none;' +
    'font-family:Helvetica,Arial,sans-serif;font-size:15px;font-weight:bold;' +
    'padding:13px 26px;border-radius:4px;display:inline-block;">' +
    "Read the letter &rarr;</a></p>" +
    '<p style="font-size:15px;color:#56514b;">' +
    "RSVP closes tonight at 11:00 PM Pacific. Ani would like it noted that ALF " +
    "only counted an extension if you submitted after the 7th minute, so in " +
    "practice you have until 11:07. He knows this from experience.</p>" +
    '<p style="margin-top:26px;">Amal, Dulce, Ani, Nathan, Mau and Anna</p>' +
    '<p style="font-size:12px;color:#8a837a;margin-top:22px;">' +
    "This link is yours. Please do not forward it.</p>" +
    "</div>";

  return { text: text, html: html };
}

function escapeHtml(s) {
  return String(s)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}

// ----------------------------------------------------------------- sends ----

/** Mails ONLY CONFIG.TEST_RECIPIENTS, using the first sheet row as sample data. */
function sendTest() {
  if (!CONFIG.TEST_RECIPIENTS.length) {
    throw new Error("Add addresses to CONFIG.TEST_RECIPIENTS first.");
  }
  var rows = readSheet();
  if (!rows.length) throw new Error("No rows found in the sheet.");
  var sample = rows[0];

  CONFIG.TEST_RECIPIENTS.forEach(function (address, i) {
    // Address the test to the tester, but keep a real letter link so the whole
    // path gets exercised: click through, sign in, reach the RSVP form.
    var body = buildBody(sample.firstName, sample.url, sample.variant);
    GmailApp.sendEmail(address, "[TEST] " + CONFIG.SUBJECT, body.text, {
      htmlBody: body.html,
      name: CONFIG.FROM_NAME,
      replyTo: CONFIG.REPLY_TO,
    });
    Logger.log("test sent to " + address);
    if (i < CONFIG.TEST_RECIPIENTS.length - 1) Utilities.sleep(CONFIG.THROTTLE_MS);
  });
  Logger.log("Done. " + CONFIG.TEST_RECIPIENTS.length + " test emails sent.");
}

/** The real send. Resumable: rows with a sent_at are skipped. */
function sendAll() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var rows = readSheet();
  var quota = MailApp.getRemainingDailyQuota();
  if (quota < rows.length) {
    throw new Error(
      "Daily quota is " + quota + " but there are " + rows.length + " rows.",
    );
  }

  var sent = 0;
  var skipped = 0;
  for (var i = 0; i < rows.length; i++) {
    var r = rows[i];
    if (r.sentAt) {
      skipped++;
      continue;
    }
    if (!r.email || r.email.indexOf("@") === -1) {
      Logger.log("row " + r.rowNumber + ": no email, skipping");
      continue;
    }
    var body = buildBody(r.firstName, r.url, r.variant);
    GmailApp.sendEmail(r.email, CONFIG.SUBJECT, body.text, {
      htmlBody: body.html,
      name: CONFIG.FROM_NAME,
      replyTo: CONFIG.REPLY_TO,
    });
    // Stamp immediately, so a crash on the next row can't cause a resend.
    sheet.getRange(r.rowNumber, r.sentAtCol).setValue(new Date());
    SpreadsheetApp.flush();
    sent++;
    Logger.log(sent + "/" + rows.length + "  " + r.email);
    Utilities.sleep(CONFIG.THROTTLE_MS);
  }
  Logger.log("Done. sent=" + sent + " already-sent=" + skipped);
}

// ----------------------------------------------------------------- sheet ----

function readSheet() {
  var sheet = SpreadsheetApp.getActiveSheet();
  var values = sheet.getDataRange().getValues();
  if (values.length < 2) return [];

  var header = values[0].map(function (h) {
    return String(h).trim().toLowerCase();
  });
  var idx = {};
  Object.keys(CONFIG.COL).forEach(function (key) {
    var col = header.indexOf(CONFIG.COL[key]);
    if (col === -1 && key !== "sentAt") {
      throw new Error("Missing column '" + CONFIG.COL[key] + "' in row 1.");
    }
    idx[key] = col;
  });
  if (idx.sentAt === -1) {
    throw new Error("Add a 'sent_at' column so the send can be resumed safely.");
  }

  var rows = [];
  for (var i = 1; i < values.length; i++) {
    var v = values[i];
    if (!String(v[idx.email] || "").trim()) continue;
    rows.push({
      rowNumber: i + 1,
      sentAtCol: idx.sentAt + 1,
      name: String(v[idx.name] || "").trim(),
      firstName: String(v[idx.firstName] || "").trim(),
      email: String(v[idx.email] || "").trim(),
      variant: String(v[idx.variant] || "default").trim(),
      url: String(v[idx.url] || "").trim(),
      sentAt: v[idx.sentAt],
    });
  }
  return rows;
}
