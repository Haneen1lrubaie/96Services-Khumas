// دالة خادم: تستقبل موافقة مزوّد الخدمة (اسمه + اسم الكيان/الفرد) وتكتبها في جدول منفصل
// بنفس base "96 هدية". التوكن يبقى فقط كمتغيّر بيئة على الخادم، ولا يظهر للمتصفح إطلاقًا.

const FIELD_PROVIDER_NAME = 'اسم مسؤول التواصل';
const FIELD_ENTITY_NAME = 'اسم الكيان/الفرد';

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'method_not_allowed' });
    return;
  }

  const BASE = process.env.AIRTABLE_BASE_ID;
  // جدول منفصل عن جدول الحجوزات — أضيفي اسمه هنا كمتغيّر بيئة جديد في Vercel
  const TABLE = process.env.AIRTABLE_PROVIDERS_TABLE;
  const TOKEN = process.env.AIRTABLE_TOKEN;
  if (!BASE || !TABLE || !TOKEN) {
    res.status(500).json({ error: 'server_not_configured' });
    return;
  }

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const name = String(body.name || '').trim();
  const entity = String(body.entity || '').trim();

  if (name.length < 2 || entity.length < 2) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }

  const url = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`;
  const headers = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

  try {
    const createRes = await fetch(url, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        records: [
          {
            fields: {
              [FIELD_PROVIDER_NAME]: name,
              [FIELD_ENTITY_NAME]: entity,
            },
          },
        ],
      }),
    });
    if (!createRes.ok) throw new Error('airtable_create_failed');

    res.status(200).json({ success: true });
  } catch (e) {
    res.status(502).json({ error: 'airtable_unreachable' });
  }
};
