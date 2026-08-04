import { json } from '@vercel/node'

const BLOB_URL = `https://${process.env.BLOB_STORE_ID || 'hermes-dashboard'}.public.blob.vercel-storage.com`

export default async function handler(req) {
  // CORS
  if (req.method === 'OPTIONS') {
    return new Response(null, {
      headers: {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'POST, GET',
        'Access-Control-Allow-Headers': 'Content-Type',
      }
    })
  }

  // GET: serve unified topics
  if (req.method === 'GET') {
    const userId = new URL(req.url).searchParams.get('user') || 'default'
    const url = `${BLOB_URL}/${userId}/unified_topics.json`
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) return json({ topics: [], platforms: [] })
      const data = await res.json()
      return json(data, {
        headers: { 'Access-Control-Allow-Origin': '*', 'Cache-Control': 'public, max-age=60' }
      })
    } catch {
      return json({ topics: [], platforms: [] }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    }
  }

  // POST: upload platform sessions
  if (req.method === 'POST') {
    try {
      const { userId, platform, sessions } = req.body
      if (!userId || !sessions) {
        return json({ error: 'Missing userId or sessions' }, { status: 400, headers: { 'Access-Control-Allow-Origin': '*' } })
      }

      const key = `${userId}/${platform}_sessions.json`
      const putUrl = `${BLOB_URL}/${key}`

      // Check if blob exists to get ETag for optimistic locking
      let etag = null
      try {
        const head = await fetch(putUrl, { method: 'HEAD' })
        etag = head.headers.get('etag')
      } catch {}

      const putRes = await fetch(putUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': 'application/json',
          'x-vercel-blob-access': 'public',
          ...(etag ? { 'if-match': etag } : {}),
        },
        body: JSON.stringify(sessions)
      })

      if (!putRes.ok) {
        const err = await putRes.text()
        return json({ error: `Upload failed: ${err}` }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
      }

      // Trigger rebuild by calling the merge function
      const rebuildUrl = new URL(req.url)
      rebuildUrl.pathname = '/api/rebuild'
      rebuildUrl.searchParams.set('userId', userId)
      
      // Fire and forget rebuild
      fetch(rebuildUrl.toString(), { method: 'POST' }).catch(() => {})

      return json({ ok: true, sessions: sessions.length }, {
        headers: { 'Access-Control-Allow-Origin': '*' }
      })
    } catch (e) {
      return json({ error: e.message }, { status: 500, headers: { 'Access-Control-Allow-Origin': '*' } })
    }
  }

  return json({ error: 'Method not allowed' }, { status: 405, headers: { 'Access-Control-Allow-Origin': '*' } })
}
