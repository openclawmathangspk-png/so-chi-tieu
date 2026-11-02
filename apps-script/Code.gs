/**
 * API lưu chi tiêu lên Google Sheet
 * Sheet: Data
 * Cột: id, amount, category, date, note, updatedAt, deleted
 */

const SHEET_NAME = 'Data';
const SECRET_PROP = 'SECRET';
const HEADERS = ['id', 'amount', 'category', 'date', 'note', 'updatedAt', 'deleted'];

function getSheet() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  let sheet = ss.getSheetByName(SHEET_NAME);
  if (!sheet) {
    sheet = ss.insertSheet(SHEET_NAME);
    sheet.appendRow(HEADERS);
    sheet.setFrozenRows(1);
  }
  return sheet;
}

function getSecret() {
  const props = PropertiesService.getScriptProperties();
  return props.getProperty(SECRET_PROP) || '';
}

function jsonResponse(obj) {
  const output = ContentService.createTextOutput(JSON.stringify(obj));
  output.setMimeType(ContentService.MimeType.JSON);
  return output;
}

function unauthorized() {
  return jsonResponse({ ok: false, error: 'unauthorized' }, 401);
}

function parseJsonBody(e) {
  try {
    if (!e) {
      return {};
    }
    if (e.postData && e.postData.contents) {
      const c = e.postData.contents;
      if (c.indexOf('data=') === 0) {
        return JSON.parse(decodeURIComponent(c.substring(5)));
      }
      return JSON.parse(c);
    }
    if (e.parameter && e.parameter.data) {
      return JSON.parse(e.parameter.data);
    }
  } catch (err) {}
  return {};
}

function readAllFromSheet() {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow < 2) {
    return [];
  }
  const values = sheet.getRange(2, 1, lastRow - 1, HEADERS.length).getValues();
  const result = [];
  for (let i = 0; i < values.length; i++) {
    const row = values[i];
    const id = row[0];
    if (id === '' || id === null || id === undefined) {
      continue;
    }
    result.push({
      id: String(id),
      amount: row[1] === '' || row[1] === null ? '' : row[1],
      category: row[2] || '',
      date: row[3] || '',
      note: row[4] || '',
      updatedAt: row[5] === '' || row[5] === null ? '' : row[5],
      deleted: row[6] === true || row[6] === 'true' || row[6] === 1 ? true : false
    });
  }
  return result;
}

function writeAllToSheet(items) {
  const sheet = getSheet();
  const lastRow = sheet.getLastRow();
  if (lastRow >= 2) {
    sheet.getRange(2, 1, lastRow - 1, HEADERS.length).clearContent();
  }
  if (!items || items.length === 0) {
    return;
  }
  const rows = [];
  for (let i = 0; i < items.length; i++) {
    const it = items[i];
    rows.push([
      it.id !== undefined && it.id !== null ? String(it.id) : '',
      it.amount !== undefined && it.amount !== null ? it.amount : '',
      it.category || '',
      it.date || '',
      it.note || '',
      it.updatedAt !== undefined && it.updatedAt !== null ? it.updatedAt : '',
      it.deleted === true ? true : false
    ]);
  }
  sheet.getRange(2, 1, rows.length, HEADERS.length).setValues(rows);
}

function mergeItems(existing, incoming) {
  const map = {};
  for (let i = 0; i < existing.length; i++) {
    const e = existing[i];
    if (e && e.id !== undefined && e.id !== null) {
      map[String(e.id)] = e;
    }
  }
  for (let i = 0; i < incoming.length; i++) {
    const inc = incoming[i];
    if (!inc || inc.id === undefined || inc.id === null) {
      continue;
    }
    const id = String(inc.id);
    const cur = map[id];
    if (!cur) {
      map[id] = {
        id: id,
        amount: inc.amount !== undefined ? inc.amount : '',
        category: inc.category || '',
        date: inc.date || '',
        note: inc.note || '',
        updatedAt: inc.updatedAt !== undefined ? inc.updatedAt : '',
        deleted: inc.deleted === true
      };
      continue;
    }
    const curT = cur.updatedAt ? new Date(cur.updatedAt).getTime() : 0;
    const incT = inc.updatedAt ? new Date(inc.updatedAt).getTime() : 0;
    if (incT > curT) {
      map[id] = {
        id: id,
        amount: inc.amount !== undefined ? inc.amount : cur.amount,
        category: inc.category !== undefined ? inc.category : cur.category,
        date: inc.date !== undefined ? inc.date : cur.date,
        note: inc.note !== undefined ? inc.note : cur.note,
        updatedAt: inc.updatedAt !== undefined ? inc.updatedAt : cur.updatedAt,
        deleted: inc.deleted !== undefined ? inc.deleted === true : cur.deleted
      };
    } else {
      map[id] = cur;
    }
  }
  const out = [];
  for (const k in map) {
    if (map.hasOwnProperty(k)) {
      out.push(map[k]);
    }
  }
  return out;
}

function doGet(e) {
  try {
    const secret = getSecret();
    const provided = e && e.parameter ? e.parameter.secret : '';
    if (!secret || provided !== secret) {
      return jsonResponse({ ok: false, error: 'unauthorized' });
    }
    const all = readAllFromSheet();
    return jsonResponse({ ok: true, data: all });
  } catch (err) {
    return jsonResponse({ ok: false, error: String(err) });
  }
}

function doPost(e) {
  const output = ContentService.createTextOutput();
  output.setMimeType(ContentService.MimeType.JSON);
  try {
    const secret = getSecret();
    let body = {};
    if (e && e.postData && e.postData.contents) {
      body = JSON.parse(e.postData.contents);
    }
    if (!body || typeof body !== 'object') body = {};
    const provided = body.secret !== undefined && body.secret !== null ? String(body.secret) : '';
    if (!secret || provided !== String(secret)) {
      output.setContent(JSON.stringify({ ok: false, error: 'unauthorized' }));
      return output;
    }
    const incoming = Array.isArray(body.items) ? body.items : [];
    const existing = readAllFromSheet();
    const merged = mergeItems(existing, incoming);
    writeAllToSheet(merged);
    const all = readAllFromSheet();
    output.setContent(JSON.stringify({ ok: true, data: all }));
    return output;
  } catch (err) {
    output.setContent(JSON.stringify({ ok: false, error: String(err) }));
    return output;
  }
}

function doOptions() {
  return ContentService.createTextOutput('').setMimeType(ContentService.MimeType.TEXT);
}
