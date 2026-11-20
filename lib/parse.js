/** 把 miloco-cli 的文本输出解析成结构化数据。 */

/**
 * 按未转义的 `|` 切分（miloco 设备名里可能出现 `\|`，例如「客厅\|主卧灯」）。
 * 反斜杠后跟 `|` 时还原成字面 `|`，不作为分隔符。
 */
export function splitRow(line) {
  const out = []
  let cur = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\' && line[i + 1] === '|') { cur += '|'; i++; continue }
    if (ch === '|') { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

export function parseDeviceList(text) {
  const devices = []
  let home = ''
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('# home=')) { home = line.slice(7).trim(); continue }
    if (line.startsWith('#')) continue
    const parts = splitRow(line)
    if (parts.length < 5) continue
    const [did, name, room, category, online] = parts
    devices.push({ did: did.trim(), name: name.trim(), room: room.trim(), category: category.trim(), online: online.trim() === 'online' })
  }
  return { home, devices }
}

export function parseProps(json) {
  const data = json?.data
  if (!data || !Array.isArray(data.properties)) return []
  return data.properties.map((row) => ({ iid: row.iid, spec: row.spec_name, value: row.value, code: row.code }))
}

export function formatDevices({ home, devices }) {
  const lines = [`家庭：${home || '（未知）'}，共 ${devices.length} 台`]
  for (const device of devices) {
    lines.push(`- ${device.name}（${device.room}｜${device.category}｜${device.online ? '在线' : '离线'}）did=${device.did}`)
  }
  return lines.join('\n')
}

export function formatProps(name, props) {
  if (!props.length) return `${name}：没有可读属性`
  return `${name}：` + props.map((p) => `${p.spec}=${JSON.stringify(p.value)}`).join('，')
}
