/**
 * Aanganova contact enquiries → Google Sheet + email.
 *
 * Paste this into the sheet's Extensions → Apps Script editor, replacing what is there.
 * Setup steps: docs/CONTACT-GOOGLE-SHEETS.md in the project.
 *
 * The shared secret is NOT written here: it lives in Project Settings → Script properties
 * as WEBHOOK_SECRET, and must match CONTACT_WEBHOOK_SECRET in the app's server/.env.
 */

// Who is emailed about each new enquiry. Change it here (several: "a@x.com,b@y.com").
const NOTIFY_TO = "jyothikaks023@gmail.com";
const SHEET_NAME = "Enquiries";
const HEADERS = ["Received", "Reference", "Name", "Email", "Phone", "Topic", "Message", "Signed in"];

/** Called by the app's server for every enquiry. */
function doPost(e) {
  try {
    const data = JSON.parse((e && e.postData && e.postData.contents) || "{}");
    const secret = PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET");
    if (!secret || data.secret !== secret) return reply({ ok: false, error: "unauthorised" });

    const row = {
      received: new Date(data.receivedAt || Date.now()),
      reference: text(data.reference, 20),
      name: text(data.name, 80),
      email: text(data.email, 254),
      phone: text(data.phone, 20),
      topic: text(data.topicLabel || data.topic, 60),
      message: text(data.message, 4000),
      signedIn: data.signedIn ? "Yes" : "No",
    };

    // One writer at a time, so two enquiries arriving together both get their own row.
    const lock = LockService.getScriptLock();
    lock.waitLock(20000);
    try {
      const sheet = enquiriesSheet();
      // The server may retry; never record the same reference twice.
      const refs = sheet.getLastRow() > 1 ? sheet.getRange(2, 2, sheet.getLastRow() - 1, 1).getValues().flat() : [];
      if (refs.indexOf(row.reference) === -1) {
        sheet.appendRow([row.received, row.reference, row.name, row.email, row.phone, row.topic, row.message, row.signedIn].map(safe));
      }
    } finally {
      lock.releaseLock();
    }

    MailApp.sendEmail({
      to: NOTIFY_TO,
      replyTo: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(row.email) ? row.email : undefined,
      subject: "New enquiry " + row.reference + ": " + row.topic,
      body: [
        "A new enquiry came in through the Aanganova contact form.",
        "",
        "Reference: " + row.reference,
        "Received:  " + row.received.toLocaleString("en-IN", { timeZone: "Asia/Kolkata" }),
        "Name:      " + row.name,
        "Email:     " + row.email,
        "Phone:     " + (row.phone || "—"),
        "Topic:     " + row.topic,
        "Signed in: " + row.signedIn,
        "",
        row.message,
        "",
        "— Reply to this email to answer " + row.name + " directly.",
        "All enquiries: " + SpreadsheetApp.getActiveSpreadsheet().getUrl(),
      ].join("\n"),
    });
    return reply({ ok: true });
  } catch (err) {
    return reply({ ok: false, error: String(err && err.message ? err.message : err) });
  }
}

/** Run this ONCE from the editor: it asks for permission, makes the tab, and emails a test. */
function setup() {
  if (!PropertiesService.getScriptProperties().getProperty("WEBHOOK_SECRET")) {
    throw new Error("Add the script property WEBHOOK_SECRET first (Project Settings → Script properties).");
  }
  enquiriesSheet();
  MailApp.sendEmail(NOTIFY_TO, "Aanganova enquiries are connected", "This sheet will now receive contact enquiries:\n" + SpreadsheetApp.getActiveSpreadsheet().getUrl());
  Logger.log("Done. Check " + NOTIFY_TO + " for a test email, then deploy as a web app.");
}

function enquiriesSheet() {
  const book = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = book.getSheetByName(SHEET_NAME);
  if (!sheet) sheet = book.insertSheet(SHEET_NAME);
  if (sheet.getLastRow() === 0) {
    sheet.appendRow(HEADERS);
    sheet.getRange(1, 1, 1, HEADERS.length).setFontWeight("bold");
    sheet.setFrozenRows(1);
    sheet.setColumnWidth(7, 420);
  }
  return sheet;
}

function text(v, max) {
  return String(v == null ? "" : v).slice(0, max);
}
/** A cell starting with = + - @ would run as a formula; a leading ' keeps it as plain text. */
function safe(v) {
  return typeof v === "string" && /^[=+\-@]/.test(v) ? "'" + v : v;
}
function reply(obj) {
  return ContentService.createTextOutput(JSON.stringify(obj)).setMimeType(ContentService.MimeType.JSON);
}
