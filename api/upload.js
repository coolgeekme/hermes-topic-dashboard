import { json } from '@vercel/node'

const GITHUB_TOKEN = process.env.GITHUB_TOKEN
const REPO = 'coolgeekme/hermes-topic-dashboard'

export default async function handler(req) {
  const headers = { 'Access-Control-Allow-Origin': '*' }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  if (req.method !== 'POST') {
    return json({ error: 'POST only' }, { status: 405, headers })
  }

  if (!GITHUB_TOKEN) {
    return json({ error: 'Server not configured' }, { status: 500, headers })
  }

  try {
    const { platform, sessions } = req.body
    if (!sessions || !Array.isArray(sessions)) {
      return json({ error: 'Missing sessions array' }, { status: 400, headers })
    }

    const filePath = `public/${platform}_sessions.json`
    const content = JSON.stringify({ platform, sessions, exported_at: new Date().toISOString() })
    const base64 = Buffer.from(content).toString('base64')

    // Get existing file SHA if it exists
    let sha = null
    try {
      const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
        headers: { Authorization: `token ${GITHUB_TOKEN}`, Accept: 'application/vnd.github.v3+json' }
      })
      if (getRes.ok) {
        const info = await getRes.json()
        sha = info.sha
      }
    } catch {}

    // Push to GitHub
    const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
      method: 'PUT',
      headers: {
        Authorization: `token ${GITHUB_TOKEN}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        message: `data: ${platform} web sessions`,
        content: base64,
        ...(sha ? { sha } : {})
      })
    })

    if (!putRes.ok) {
      const err = await putRes.json()
      return json({ error: err.message }, { status: 500, headers })
    }

    return json({ ok: true, sessions: sessions.length }, { headers })
  } catch (e) {
    return json({ error: e.message }, { status: 500, headers })
  }
}
