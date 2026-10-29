// API de la revista: lee y guarda los textos y fotos en Upstash Redis.
// Variables que usa: KV_REST_API_URL y KV_REST_API_TOKEN, o UPSTASH_REDIS_REST_URL y UPSTASH_REDIS_REST_TOKEN,
// más EDIT_KEY, que es la clave del equipo para poder escribir.
const URL_ = process.env.KV_REST_API_URL || process.env.UPSTASH_REDIS_REST_URL;
const TOKEN = process.env.KV_REST_API_TOKEN || process.env.UPSTASH_REDIS_REST_TOKEN;

async function cmd(...args) {
  const r = await fetch(URL_, {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + TOKEN, 'content-type': 'application/json' },
    body: JSON.stringify(args)
  });
  const j = await r.json();
  if (j.error) throw new Error(j.error);
  return j.result;
}
function pairs(arr) { const o = {}; for (let i = 0; i < arr.length; i += 2) o[arr[i]] = arr[i + 1]; return o; }

module.exports = async (req, res) => {
  res.setHeader('Cache-Control', 'no-store');
  if (!URL_ || !TOKEN) return res.status(500).json({ error: 'Falta conectar la base de datos Upstash' });
  try {
    if (req.method === 'GET') {
      if (req.query.img) {
        const v = await cmd('HGET', 'voces:img', String(req.query.img));
        return res.status(200).json({ v: v || '' });
      }
      const [t, it] = await Promise.all([cmd('HGETALL', 'voces:campos'), cmd('HGETALL', 'voces:imgt')]);
      return res.status(200).json({ campos: pairs(t || []), imgs: pairs(it || []) });
    }
    if (req.method === 'POST') {
      const clave = process.env.EDIT_KEY;
      if (!clave || req.headers['x-clave'] !== clave) return res.status(401).json({ error: 'clave' });
      const body = typeof req.body === 'string' ? JSON.parse(req.body) : (req.body || {});
      if (body.check) return res.status(200).json({ ok: true });
      const { key, v } = body;
      if (typeof key !== 'string' || !/^p\d{1,2}__[a-z0-9_]{1,30}$/.test(key) || typeof v !== 'string' || v.length > 300000) {
        return res.status(400).json({ error: 'datos' });
      }
      if (key.endsWith('__img')) {
        await cmd('HSET', 'voces:img', key, v);
        await cmd('HSET', 'voces:imgt', key, String(Date.now()));
      } else {
        await cmd('HSET', 'voces:campos', key, v);
      }
      return res.status(200).json({ ok: true });
    }
    return res.status(405).end();
  } catch (e) {
    return res.status(500).json({ error: 'servidor' });
  }
};
