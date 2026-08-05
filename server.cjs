// API server for dashboard — handles upload endpoint
const http = require('http')
const https = require('https')
const { execSync } = require('child_process')
const fs = require('fs')

const PORT = 3001
const REPO = 'coolgeekme/hermes-topic-dashboard'
const GITHUB_TOKEN = process.env.GITHUB_TOKEN || ''

function corsHeaders() {
  return {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'POST, GET, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type',
  }
}

function json(res, data, status = 200) {
  res.writeHead(status, { ...corsHeaders(), 'Content-Type': 'application/json' })
  res.end(JSON.stringify(data))
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', chunk => body += chunk)
    req.on('end', () => {
      try { resolve(JSON.parse(body)) }
      catch { resolve({}) }
    })
  })
}

async function pushToGitHub(filePath, content) {
  if (!GITHUB_TOKEN) return { error: 'GITHUB_TOKEN not configured' }

  const base64 = Buffer.from(JSON.stringify(content)).toString('base64')

  // Get existing SHA
  let sha = null
  try {
    const getRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
      headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Accept': 'application/vnd.github.v3+json', 'User-Agent': 'hermes-dashboard' }
    })
    if (getRes.ok) {
      const info = await getRes.json()
      sha = info.sha
    }
  } catch {}

  const body = {
    message: `data: ${filePath} update [api-server]`,
    content: base64,
    ...(sha ? { sha } : {})
  }

  const putRes = await fetch(`https://api.github.com/repos/${REPO}/contents/${filePath}`, {
    method: 'PUT',
    headers: { 'Authorization': `token ${GITHUB_TOKEN}`, 'Content-Type': 'application/json', 'User-Agent': 'hermes-dashboard' },
    body: JSON.stringify(body)
  })

  if (!putRes.ok) {
    const err = await putRes.json()
    return { error: err.message || `HTTP ${putRes.status}` }
  }
  return { ok: true }
}

const server = http.createServer(async (req, res) => {
  // CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(204, corsHeaders())
    res.end()
    return
  }

  // POST /api/upload — save platform sessions
  if (req.method === 'POST' && req.url === '/api/upload') {
    try {
      const body = await readBody(req)
      const { platform, sessions, userId } = body

      if (!sessions || !Array.isArray(sessions)) {
        return json(res, { error: 'Missing sessions array' }, 400)
      }

      const userPrefix = userId ? `user_${userId}_` : ''
      const filePath = `public/${userPrefix}${platform}_sessions.json`
      const content = { platform, sessions, exported_at: new Date().toISOString() }

      const result = await pushToGitHub(filePath, content)
      if (result.error) return json(res, result, 500)

      json(res, { ok: true, sessions: sessions.length })
    } catch (e) {
      json(res, { error: e.message }, 500)
    }
    return
  }

  // GET /api/health
  if (req.method === 'GET' && req.url === '/api/health') {
    json(res, { status: 'ok', uptime: process.uptime() })
    return
  }

  res.writeHead(404, corsHeaders())
  res.end('Not found')
})

server.listen(PORT, '127.0.0.1', () => {
  console.log(`API server listening on http://127.0.0.1:${PORT}`)
})
