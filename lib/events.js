/**
 * 行为日志：轮询设备属性，记录变化；按小时统计，给出“每天几点开灯”这类模式与自动化建议。
 */
import { appendFile, mkdir, readFile } from 'node:fs/promises'
import { dirname } from 'node:path'

export const CONTROLLABLE = new Set(['light', 'outlet', 'air-purifier', 'television'])

export function makeEvent(prev, next, device) {
  return {
    ts: new Date().toISOString(),
    did: device.did,
    name: device.name,
    room: device.room,
    spec: 'on',
    value: next,
    prev,
  }
}

/** 从事件里算每个设备的开机时段分布与建议。 */
export function patterns(events) {
  const byDevice = new Map()
  for (const e of events) {
    if (e.spec !== 'on' || e.value !== true) continue
    const hour = new Date(e.ts).getHours()
    if (!byDevice.has(e.did)) byDevice.set(e.did, { did: e.did, name: e.name, room: e.room, hours: new Array(24).fill(0), days: new Set() })
    const item = byDevice.get(e.did)
    item.hours[hour] += 1
    item.days.add(new Date(e.ts).toISOString().slice(0, 10))
  }
  const out = []
  for (const item of byDevice.values()) {
    const total = item.hours.reduce((a, b) => a + b, 0)
    if (total < 2) continue
    let best = 0
    for (let i = 1; i < 24; i++) if (item.hours[i] > item.hours[best]) best = i
    out.push({
      did: item.did,
      name: item.name,
      room: item.room,
      total,
      days: item.days.size,
      peakHour: best,
      peakCount: item.hours[best],
      hours: item.hours,
      suggestion: `通常在 ${String(best).padStart(2, '0')}:00 左右开「${item.name}」（${item.days.size} 天里出现 ${total} 次），可以设成定时自动开。`,
    })
  }
  return out.sort((a, b) => b.total - a.total)
}

export async function readEvents(file, limit = 500) {
  try {
    const text = await readFile(file, 'utf8')
    const rows = text.split('\n').filter(Boolean).slice(-limit).map((line) => { try { return JSON.parse(line) } catch { return null } }).filter(Boolean)
    return rows
  } catch {
    return []
  }
}

export function startLogger({ listDevices, props, file, intervalMs = 30000, log = () => {} }) {
  let timer = null
  let failures = 0
  let stopped = false
  const last = new Map()
  async function tick() {
    if (stopped) return
    try {
      const { devices } = await listDevices()
      for (const d of devices) {
        if (!d.online || !CONTROLLABLE.has(d.category)) continue
        try {
          const ps = await props(d.did)
          const p = ps.find((x) => x.spec === 'on')
          if (!p) continue
          const prev = last.get(d.did)
          if (prev !== undefined && prev !== p.value) {
            await mkdir(dirname(file), { recursive: true })
            await appendFile(file, JSON.stringify(makeEvent(prev, p.value, d)) + '\n', 'utf8')
          }
          last.set(d.did, p.value)
        } catch {}
      }
    } catch (e) {
      failures += 1
      if (failures === 1 || failures % 20 === 0) log(`logger tick failed (${failures}): ${e?.message || e}`)
    }
    timer = setTimeout(tick, intervalMs)
    if (timer.unref) timer.unref()
  }
  tick()
  return () => { stopped = true; if (timer) clearTimeout(timer) }
}
