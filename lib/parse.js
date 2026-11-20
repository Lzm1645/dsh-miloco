/** 把 miloco-cli 的文本输出解析成结构化数据。 */

/**
 * 按未转义的 `|` 切分（miloco 设备名里可能出现 `\|`，例如「客厅\|主卧灯」）。
 *
 * miloco 只转义 `|`、不转义 `\`，所以字段必须以「反斜杠 + `|`」结尾才算转义：
 * 名字本身以 `\` 结尾时会连着分隔符出现两个反斜杠，若按「反斜杠 + 任意字符」吞字
 * 就会吃掉分隔符、把整行错位。这里只在反斜杠后面紧跟 `|` 时还原。
 * @param line - 一行设备表文本。
 * @returns 去掉转义后的字段数组。
 */
export function splitRow(line) {
  const out = []
  let cur = ''
  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '\\' && line[i + 1] === '|') { cur += '|'; i++; continue }
    if (ch === '\\' && line[i + 1] === '\\' && line[i + 2] === '|') {
      // 名字以反斜杠结尾：`\\|` 是「字面反斜杠 + 字段分隔符」。
      cur += '\\'
      out.push(cur)
      cur = ''
      i += 2
      continue
    }
    if (ch === '|') { out.push(cur); cur = ''; continue }
    cur += ch
  }
  out.push(cur)
  return out
}

/**
 * 解析 `miloco-cli device list` 的文本输出。
 *
 * 字段数不足的行会被跳过；调用方可通过 `onSkip` 得知（上游只转义 `|`，
 * 名字以 `\` 结尾的行无法无歧义还原）。
 * @param text - 命令的标准输出。
 * @param options - 可选钩子。
 * @param options.onSkip - 收到无法解析的行时调用，参数为该行原文。
 * @returns 家庭名与设备列表。
 */
export function parseDeviceList(text, { onSkip } = {}) {
  const devices = []
  let home = ''
  for (const raw of String(text ?? '').split('\n')) {
    const line = raw.trim()
    if (!line) continue
    if (line.startsWith('# home=')) { home = line.slice(7).trim(); continue }
    if (line.startsWith('#')) continue
    const parts = splitRow(line)
    if (parts.length < 5) { onSkip?.(line); continue }
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
