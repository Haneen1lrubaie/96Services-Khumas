// دالة خادم (Vercel Serverless Function) — الوحيدة المسموح لها بحمل توكن Airtable.
// الغرض: تُرجع للمتصفح "معرّفات الخدمات المحجوزة فقط" (claimedIds)، بدون أي اسم أو رقم
// جوال لأي مستفيد — حتى لا يقدر أي زائر للموقع يشوف بيانات بقية المستفيدين من الشبكة
// (Network tab)، كما كان يحصل سابقًا عندما كان المتصفح يجيب كل السجلات مباشرة من Airtable.

const FIELD_SERVICE_ID = 'معرف الخدمة';

async function fetchAllRecords(baseUrl, headers) {
  let records = [];
  let offset;
  do {
    const url = new URL(baseUrl);
    url.searchParams.set('pageSize', '100');
    if (offset) url.searchParams.set('offset', offset);
    const res = await fetch(url.toString(), { headers });
    if (!res.ok) throw new Error('airtable_error_' + res.status);
    const data = await res.json();
    records = records.concat(data.records || []);
    offset = data.offset;
  } while (offset);
  return records;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const BASE = process.env.AIRTABLE_BASE_ID;
  const TABLE = process.env.AIRTABLE_TABLE_NAME;
  const TOKEN = process.env.AIRTABLE_TOKEN;
  if (!BASE || !TABLE || !TOKEN) {
    res.status(500).json({ error: 'server_not_configured' });
    return;
  }

  const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`;
  const headers = { Authorization: 'Bearer ' + TOKEN };

  try {
    const records = await fetchAllRecords(url, headers);
    const claimedIds = records
      .map((r) => r.fields && r.fields[FIELD_SERVICE_ID])
      .filter(Boolean);

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ claimedIds });
  } catch (e) {
    res.status(502).json({ error: 'airtable_unreachable' });
  }
}
