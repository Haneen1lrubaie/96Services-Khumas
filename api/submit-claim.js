// دالة خادم: تستقبل طلب الحجز من المتصفح، تتحقق منه، وتكتبه في Airtable. هذه الدالة هي
// المكان الوحيد اللي يحمل توكن Airtable (من متغيّرات البيئة على الخادم) — المتصفح لا يرى
// التوكن ولا باقي سجلات المستفيدين إطلاقًا.

const FIELD_NAME = 'الاسم';
const FIELD_SERVICE = 'الخدمة';
const FIELD_PHONE = 'رقم العميل';
const FIELD_EMAIL = 'البريد الإلكتروني';
const FIELD_PROVIDER_ACCOUNT = 'حساب مقدم الخدمة';
const FIELD_SERVICE_ID = 'معرف الخدمة';
const FIELD_PROVIDER_NAME = 'مقدم الخدمة';
const FIELD_REASON = 'سبب اختيار الهدية';

function escapeFormulaValue(v) {
  return String(v).replace(/'/g, "\\'");
}

async function findByFormula(baseUrl, headers, formula) {
  const url = new URL(baseUrl);
  url.searchParams.set('filterByFormula', formula);
  url.searchParams.set('maxRecords', '1');
  const res = await fetch(url.toString(), { headers });
  if (!res.ok) throw new Error('airtable_list_failed');
  const data = await res.json();
  return (data.records || []).length > 0;
}

module.exports = async function handler(req, res) {
  if (req.method !== 'POST') {
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

  let body = req.body;
  if (typeof body === 'string') {
    try { body = JSON.parse(body); } catch (e) { body = {}; }
  }
  body = body || {};

  const service_id = String(body.service_id || '').trim();
  const service_name = String(body.service_name || '').trim();
  const name = String(body.name || '').trim();
  const phone = String(body.phone || '').replace(/\D/g, '');
  const email = String(body.email || '').trim();
  const reason = String(body.reason || '').trim();
  const provider_account = String(body.provider_account || '').trim();
  const provider_name = String(body.provider_name || '').trim();

  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  if (!service_id || name.length < 2 || phone.length < 9 || !emailOk || reason.length < 5) {
    res.status(400).json({ error: 'invalid_input' });
    return;
  }

  const baseUrl = `https://api.airtable.com/v0/${BASE}/${encodeURIComponent(TABLE)}`;
  const headers = { Authorization: 'Bearer ' + TOKEN, 'Content-Type': 'application/json' };

  try {
    const phoneTaken = await findByFormula(
      baseUrl,
      headers,
      `{${FIELD_PHONE}}='${escapeFormulaValue(phone)}'`
    );
    if (phoneTaken) {
      res.status(200).json({ error: 'already_claimed_by_phone' });
      return;
    }

    // ملاحظة: لا يوجد تحقق من تكرار "معرف الخدمة" هنا عن قصد — الخدمة الواحدة مفتوحة
    // لعدد غير محدود من الأشخاص المختلفين (فريق خماس يراجع الطلبات لاحقًا ويحدد
    // المستحق بناءً على السبب). القيد الوحيد هو رقم الجوال أعلاه.

    const createRes = await fetch(baseUrl, {
      method: 'POST',
      headers,
      body: JSON.stringify({
        records: [
          {
            fields: {
              [FIELD_NAME]: name,
              [FIELD_SERVICE]: service_name,
              [FIELD_PHONE]: phone,
              [FIELD_EMAIL]: email,
              [FIELD_PROVIDER_ACCOUNT]: provider_account,
              [FIELD_SERVICE_ID]: service_id,
              [FIELD_PROVIDER_NAME]: provider_name,
              [FIELD_REASON]: reason,
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
}
