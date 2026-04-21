import { request } from 'node:https';

export function hasCredentials() {
  return Boolean(process.env.JIRA_API_TOKEN && process.env.JIRA_EMAIL);
}

export async function transitionIssue({ domain, issueKey, targetStatus, comment }) {
  if (!hasCredentials()) {
    return { ok: false, reason: 'missing-credentials', noop: true };
  }
  try {
    const available = await getAvailableTransitions(domain, issueKey);
    const match = available.transitions?.find(t => t.to?.name?.toLowerCase() === targetStatus.toLowerCase());
    if (!match) {
      return {
        ok: false,
        reason: 'no-matching-transition',
        targetStatus,
        available: available.transitions?.map(t => t.to?.name) || [],
      };
    }
    await executeTransition(domain, issueKey, match.id);
    if (comment) {
      await postComment(domain, issueKey, comment);
    }
    return { ok: true, transitionId: match.id, toStatus: match.to?.name };
  } catch (e) {
    return { ok: false, reason: 'api-error', error: e.message, noop: false };
  }
}

export async function postComment(domain, issueKey, bodyText) {
  if (!hasCredentials()) return { ok: false, reason: 'missing-credentials', noop: true };
  try {
    const adfBody = {
      body: {
        type: 'doc',
        version: 1,
        content: [{ type: 'paragraph', content: [{ type: 'text', text: bodyText }] }],
      },
    };
    await jiraPost(domain, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/comment`, adfBody);
    return { ok: true };
  } catch (e) {
    return { ok: false, reason: 'api-error', error: e.message };
  }
}

async function getAvailableTransitions(domain, issueKey) {
  const body = await jiraGet(domain, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`);
  return JSON.parse(body);
}

async function executeTransition(domain, issueKey, transitionId) {
  await jiraPost(domain, `/rest/api/3/issue/${encodeURIComponent(issueKey)}/transitions`, {
    transition: { id: transitionId },
  });
}

function authHeader() {
  const auth = Buffer.from(`${process.env.JIRA_EMAIL}:${process.env.JIRA_API_TOKEN}`).toString('base64');
  return `Basic ${auth}`;
}

function jiraGet(domain, path) {
  return httpsRequest({
    hostname: domain,
    path,
    method: 'GET',
    headers: { Authorization: authHeader(), Accept: 'application/json' },
  });
}

function jiraPost(domain, path, body) {
  const json = JSON.stringify(body);
  return httpsRequest({
    hostname: domain,
    path,
    method: 'POST',
    headers: {
      Authorization: authHeader(),
      Accept: 'application/json',
      'Content-Type': 'application/json',
      'Content-Length': Buffer.byteLength(json),
    },
  }, json);
}

function httpsRequest(opts, payload) {
  return new Promise((resolve, reject) => {
    const req = request({ ...opts, timeout: 10000 }, (res) => {
      const chunks = [];
      res.on('data', c => chunks.push(c));
      res.on('end', () => {
        const body = Buffer.concat(chunks).toString('utf-8');
        if (res.statusCode >= 200 && res.statusCode < 300) resolve(body);
        else reject(new Error(`HTTP ${res.statusCode}: ${body.slice(0, 300)}`));
      });
    });
    req.on('error', reject);
    req.on('timeout', () => { req.destroy(new Error('timeout')); });
    if (payload) req.write(payload);
    req.end();
  });
}
