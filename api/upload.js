import { put, list, del } from '@vercel/blob'
import { json } from '@vercel/node'

export default async function handler(req) {
  const headers = { 'Access-Control-Allow-Origin': '*' }

  if (req.method === 'OPTIONS') {
    return new Response(null, { status: 204, headers })
  }

  // GET: serve unified topics
  if (req.method === 'GET') {
    try {
      const url = new URL(req.url)
      const userId = url.searchParams.get('user') || 'default'
      const prefix = `${userId}/unified_topics`
      
      const { blobs } = await list({ prefix, limit: 1 })
      
      if (blobs.length === 0) {
        return json({ topics: [], platforms: [], generated_at: new Date().toISOString() }, { headers })
      }

      const blob = blobs[0]
      const res = await fetch(blob.url)
      const data = await res.json()
      
      return json(data, { headers: { ...headers, 'Cache-Control': 'public, max-age=60' } })
    } catch (e) {
      return json({ topics: [], platforms: [], error: e.message }, { headers })
    }
  }

  // POST: upload platform sessions
  if (req.method === 'POST') {
    try {
      const { userId, platform, sessions } = req.body
      if (!userId || !sessions) {
        return json({ error: 'Missing userId or sessions' }, { status: 400, headers })
      }

      // Delete old file if exists, then upload new
      const key = `${userId}/${platform}_sessions.json`
      
      try {
        const { blobs } = await list({ prefix: key, limit: 1 })
        for (const b of blobs) {
          await del(b.url)
        }
      } catch {}

      await put(key, JSON.stringify(sessions), {
        access: 'public',
        contentType: 'application/json',
      })

      // Trigger rebuild asynchronously
      const rebuildUrl = new URL(req.url)
      rebuildUrl.pathname = '/api/rebuild'
      rebuildUrl.searchParams.set('userId', userId)
      fetch(rebuildUrl.toString(), { method: 'POST' }).catch(() => {})

      return json({ ok: true, sessions: sessions.length }, { headers })
    } catch (e) {
      return json({ error: e.message }, { status: 500, headers })
    }
  }

  return json({ error: 'Method not allowed' }, { status: 405, headers })
}
