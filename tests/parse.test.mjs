import test from 'node:test'
import assert from 'node:assert/strict'
import { parseDeviceList, parseProps, formatDevices } from '../lib/parse.js'
import { buildArgs, redact } from '../lib/cli.js'

test('parse device table', () => {
  const text = '# home=我的家\n# did|device_name|room|category|online\n117131735|台灯1|卧室|light|online\n2027403803|插座3|卧室|outlet|offline\n'
  const { home, devices } = parseDeviceList(text)
  assert.equal(home, '我的家')
  assert.equal(devices.length, 2)
  assert.equal(devices[0].name, '台灯1')
  assert.equal(devices[1].online, false)
  assert.match(formatDevices({ home, devices }), /共 2 台/)
})

test('parse props', () => {
  const json = { code: 0, data: { properties: [{ iid: 'prop.2.1', spec_name: 'on', value: false }] } }
  assert.deepEqual(parseProps(json), [{ iid: 'prop.2.1', spec: 'on', value: false, code: undefined }])
})

test('command allowlist', () => {
  assert.deepEqual(buildArgs(['device', 'list']), ['device', 'list'])
  assert.throws(() => buildArgs(['rm', '-rf', '/']), /not allowed/)
})

test('redact secrets', () => {
  assert.equal(redact('token=abc cookie=xyz'), '***=abc ***=xyz')
})

test('keeps escaped pipes in device names', () => {
  const { home, devices } = parseDeviceList('# home=我的家\n123|客厅\\|主卧灯|客厅|light|online\n')
  assert.equal(home, '我的家')
  assert.equal(devices.length, 1)
  assert.deepEqual(devices[0], { did: '123', name: '客厅|主卧灯', room: '客厅', category: 'light', online: true })
})

test('handles trailing backslash + separator without dropping the device', () => {
  const { devices } = parseDeviceList('d3|台灯\\\\|lobby|light|online\n')
  assert.equal(devices.length, 1)
  assert.equal(devices[0].name, '台灯\\')
  assert.equal(devices[0].room, 'lobby')
  assert.equal(devices[0].category, 'light')
})

test('reports skipped malformed rows via onSkip', () => {
  const skipped = []
  const { devices } = parseDeviceList('d5|坏行|light|online\n', { onSkip: (line) => skipped.push(line) })
  assert.equal(devices.length, 0)
  assert.deepEqual(skipped, ['d5|坏行|light|online'])
})
