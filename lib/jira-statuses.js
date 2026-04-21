import { request } from 'node:https';

export async function fetchProjectStatuses({ domain, projectKey, email, apiToken }) {
  if (!domain || !projectKey) {
    throw new Error('fetchProjectStatuses: domain and projectKey required');
  }
  if (!email || !apiToken) {
    return { ok: false, reason: 'missing-credentials', statuses: [] };
  }
  const path = `/rest/api/3/project/${encodeURIComponent(projectKey)}/statuses`;
  const auth = Buffer.from(`${email}:${apiToken}`).toString('base64');
  const body = await httpsGet({ hostname: domain, path, headers: { Authorization: `Basic ${auth}`, Accept: 'application/json' } });
  const parsed = JSON.parse(body);
  const statuses = flattenStatuses(parsed);
  return { ok: true, statuses, raw: parsed };
}

function flattenStatuses(apiResponse) {
  const seen = new Set();
  const out = [];
  if (!Array.isArray(apiResponse)) return out;
  for (const issueType of apiResponse) {
    if (!Array.isArray(issueType.statuses)) continue;
    for (const s of issueType.statuses) {
      if (!s?.name || seen.has(s.name)) continue;
      seen.add(s.name);
      out.push({ name: s.name, category: s.statusCategory?.key || null, id: s.id });
    }
  }
  return out;
}

function httpsGet(opts) {
  return new Promise((resolve, reject) => {
    const req = request({ ...opts, method: 'GET', timeout: 10000 }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 200)}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    req.end();
  });
}
