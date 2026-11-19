import { test } from 'node:test'
import assert from 'node:assert/strict'
import { makeEvent, patterns } from '../lib/events.js'

test('makeEvent keeps prev/value and device identity', () => {
  const e = makeEvent(false, true, { did: 'x', name: '台灯1', room: '卧室' })
  assert.equal(e.did, 'x'); assert.equal(e.prev, false); assert.equal(e.value, true); assert.ok(e.ts)
})

test('patterns finds peak hour and suggests an automation', () => {
  const base = Date.now()
  const at = (hour, day) => new Date(base - day * 86400000 + 0, 0, 0, 0)
  const ev = []
  for (let d = 0; d < 5; d++) {
    const t = new Date(base - d * 86400000)
    t.setHours(19, 30, 0, 0)
    ev.push({ ts: t.toISOString(), did: 'x', name: '台灯1', room: '卧室', spec: 'on', value: true, prev: false })
  }
  const [p] = patterns(ev)
  assert.equal(p.did, 'x'); assert.equal(p.peakHour, 19); assert.equal(p.total, 5)
  assert.match(p.suggestion, /19:00/)
})

test('patterns ignores thin samples', () => {
  const ev = [{ ts: new Date().toISOString(), did: 'y', name: 'x', room: 'r', spec: 'on', value: true, prev: false }]
  assert.equal(patterns(ev).length, 0)
})
