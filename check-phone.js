// دالة خادم: تتحقق فقط من رقم الجوال اللي يرسله متصفح المستخدم نفسه (رقمه هو)، وترجع
// true/false بدون كشف أي بيانات عن أي رقم آخر. تُستخدم فقط لتصحيح القفل المحلي (localStorage)
// إذا حذفت الإدارة حجز الشخص من Airtable يدويًا.

const FIELD_PHONE = 'رقم العميل';

function escapeFormulaValue(v) {
  return String(v).replace(/'/g, "\\'");
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

  const phone = String(req.query.phone || '').replace(/\D/g, '');
  if (!phone) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }

  const formula = `{${FIELD_PHONE}}='${escapeFormulaValue(phone)}'`;
  const url = new URL(`https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`);
  url.searchParams.set('filterByFormula', formula);
  url.searchParams.set('maxRecords', '1');

  try {
    const airtableRes = await fetch(url.toString(), {
      headers: { Authorization: 'Bearer ' + TOKEN },
    });
    if (!airtableRes.ok) throw new Error('airtable_error');
    const data = await airtableRes.json();

    res.setHeader('Cache-Control', 'no-store');
    res.status(200).json({ stillClaimed: (data.records || []).length > 0 });
  } catch (e) {
    res.status(502).json({ error: 'airtable_unreachable' });
  }
}
