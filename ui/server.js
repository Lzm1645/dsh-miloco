/** 本地控制面板：静态页 + JSON API。只监听 127.0.0.1。 */
import { createServer } from 'node:http'
import { readFile } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import { dirname, join } from 'node:path'

const HERE = dirname(fileURLToPath(import.meta.url))
const servers = new Map()

function json(res, status, body) {
  const data = JSON.stringify(body)
  res.writeHead(status, { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' })
  res.end(data)
}

class BadRequest extends Error {}

async function readBody(req) {
  let raw = ''
  for await (const chunk of req) raw += chunk
  if (raw.length > 32 * 1024) throw new BadRequest('body too large')
  if (!raw) return {}
  try { return JSON.parse(raw) } catch { throw new BadRequest('invalid JSON body') }
}

export async function startUiServer({ port = 5888, listDevices, props, control, events, patterns }) {
  const running = servers.get(port)
  if (running) return running.url
  const server = createServer(async (req, res) => {
    try {
      const url = new URL(req.url ?? '/', 'http://127.0.0.1')
      if (req.method === 'GET' && (url.pathname === '/' || url.pathname === '/index.html')) {
        const html = await readFile(join(HERE, 'index.html'), 'utf8')
        res.writeHead(200, { 'content-type': 'text/html; charset=utf-8', 'cache-control': 'no-store' })
        res.end(html)
        return
      }
      if (req.method === 'GET' && url.pathname === '/api/devices') {
        const result = await listDevices()
        if (!result.ok) return json(res, 502, { ok: false, error: result.text })
        return json(res, 200, { ok: true, home: result.parsed.home, devices: result.parsed.devices })
      }
      if (req.method === 'GET' && url.pathname === '/api/props') {
        const did = url.searchParams.get('did') || ''
        const result = await props(did)
        return json(res, result.ok ? 200 : 502, { ok: result.ok, text: result.text, props: result.json?.data?.properties ?? [] })
      }
      if (req.method === 'GET' && url.pathname === '/api/events') {
        const limit = Number(url.searchParams.get('limit') || 200)
        return json(res, 200, { ok: true, events: events ? await events(limit) : [] })
      }
      if (req.method === 'GET' && url.pathname === '/api/patterns') {
        return json(res, 200, { ok: true, patterns: patterns ? await patterns() : [] })
      }
      if (req.method === 'POST' && url.pathname === '/api/control') {
        const body = await readBody(req)
        try {
          const result = await control({ did: body.did, spec: body.spec, value: body.value, confirm: body.confirm === true })
          return json(res, 200, { ok: true, result })
        } catch (error) {
          return json(res, 400, { ok: false, error: String(error.message || error) })
        }
      }
      json(res, 404, { ok: false, error: 'not found' })
    } catch (error) {
      json(res, error instanceof BadRequest ? 400 : 500, { ok: false, error: String(error.message || error) })
    }
  })
  await new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', resolve)
  })
  const url = `http://127.0.0.1:${port}/`
  servers.set(port, { server, url })
  server.once('close', () => servers.delete(port))
  console.log(`[dsh-miloco] UI: ${url}`)
  return url
}
