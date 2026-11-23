/** dsh-miloco：把小米 Miloco（米家）设备接入 DeepSeek Harness。
 *  - 工具：miloco_status / miloco_devices / miloco_props / miloco_control / miloco_ui
 *  - UI：本地控制面板（127.0.0.1:5888），深色主题，列表/开关/亮度
 * 依赖：本机已安装并登录 miloco-cli（后端服务运行中）。
 */
import { defineTool } from './lib/tool.js'
import { runCli, parseJson, explainCliError, INSTALL_COMMAND } from './lib/cli.js'
import { parseDeviceList, parseProps, formatDevices, formatProps } from './lib/parse.js'
import { startUiServer, closeUiServer } from './ui/server.js'
import { startLogger, readEvents, patterns } from './lib/events.js'
import { homedir } from 'node:os'
import { join } from 'node:path'

export const name = 'dsh-miloco'
export const inject = []

const textOutput = {
  schema: { type: 'object', additionalProperties: false, properties: { ok: { type: 'boolean' }, text: { type: 'string' } } },
  render: (_args, value) => [{ type: 'text', text: value.text }],
}

function eventFile() {
  return process.env.DSH_MILOCO_EVENTS || join(homedir(), '.dsh', 'state', 'dsh-miloco', 'events.jsonl')
}

const BACKEND_URL = process.env.DSH_MILOCO_BACKEND || 'http://127.0.0.1:1810'

/** 直接探后端 /health，不依赖 `service status`（它看不见手工起的进程）。 */
async function backendHealth() {
  try {
    const response = await fetch(BACKEND_URL.replace(/\/$/, '') + '/health', { signal: AbortSignal.timeout(2000) })
    return response.ok
  } catch {
    return false
  }
}

async function isBound() {
  const account = parseJson((await runCli(['account', 'status'])).stdout)
  return account?.data?.is_bound === true
}

async function listDevices() {
  const result = await runCli(['device', 'list'])
  if (!result.ok) {
    const text = explainCliError(result.stderr || result.stdout, BACKEND_URL)
    return { ok: false, text: `设备列表获取失败：${text}` }
  }
  const skipped = []
  const parsed = parseDeviceList(result.stdout, { onSkip: (line) => skipped.push(line) })
  if (skipped.length) console.warn('[dsh-miloco] 跳过无法解析的设备行：' + skipped.join(' | '))
  if (parsed.devices.length === 0 && !(await isBound())) {
    return { ok: true, text: '账号未绑定，所以没有设备。运行 `miloco-cli account bind` 扫码绑定小米账号。', parsed }
  }
  const note = skipped.length ? `\n（另有 ${skipped.length} 行无法解析，已跳过）` : ''
  return { ok: true, text: formatDevices(parsed) + note, parsed }
}

async function props(did) {
  const result = await runCli(['device', 'props', String(did)])
  const json = parseJson(result.stdout)
  if (!result.ok || !json) return { ok: false, text: `属性读取失败：${result.stderr || result.stdout || '未知错误'}` }
  return { ok: true, text: formatProps(String(did), parseProps(json)), json }
}

export function apply(ctx) {
  const tools = ctx.get?.('tools') ?? ctx.tools
  if (!tools?.register) {
    console.warn('[dsh-miloco] tools service unavailable; plugin idle')
    return
  }
  if (typeof defineTool !== 'function') {
    console.warn('[dsh-miloco] defineTool unavailable; plugin idle')
    return
  }

  tools.register(defineTool({
    name: 'miloco_status',
    description: '查看小米 Miloco 的账号绑定与服务状态。',
    parameters: {},
    output: textOutput,
    async execute() {
      const version = await runCli(['version'])
      const installed = version.ok || !/ENOENT/.test(version.stderr || '')
      const health = installed ? await backendHealth() : false
      const account = await runCli(['account', 'status'])
      const accountJson = parseJson(account.stdout)
      const bound = accountJson?.data?.is_bound
      const lines = ['Miloco 状态']
      lines.push(`CLI：${installed ? '已安装' : '未安装'}`)
      lines.push(`后端：${health ? '运行中（/health 200）' : '未运行'}`)
      lines.push(`账号：${bound === true ? '已绑定' : bound === false ? '未绑定' : '未知'}`)
      if (!health) lines.push(`提示：启动后端 —— ${installed ? 'miloco-cli service start' : INSTALL_COMMAND}`)
      if (bound !== true) lines.push('提示：绑定账号 —— miloco-cli account bind')
      return { ok: true, text: lines.join('\n') }
    },
  }))

  tools.register(defineTool({
    name: 'miloco_devices',
    description: '列出米家设备（名称/房间/类别/在线状态）。',
    parameters: {},
    output: textOutput,
    async execute() {
      const result = await listDevices()
      return { ok: result.ok, text: result.text }
    },
  }))

  tools.register(defineTool({
    name: 'miloco_props',
    description: '读取一台设备的属性值（on/brightness/color-temperature 等）。',
    parameters: { did: { type: 'string', required: true, description: '设备 did' } },
    output: textOutput,
    async execute(args) {
      const result = await props(args.did)
      return { ok: result.ok, text: result.text }
    },
  }))

  tools.register(defineTool({
    name: 'miloco_control',
    description: '控制设备属性（需要 confirm=true 才执行；只允许 on/off/brightness/color-temperature/mode）。',
    parameters: {
      did: { type: 'string', required: true, description: '设备 did' },
      spec: { type: 'string', required: true, description: '属性名：on / brightness / color-temperature / mode / toggle' },
      value: { type: 'string', required: true, description: '目标值（true/false 或数字，如 "true"、"50"）' },
      confirm: { type: 'boolean', required: true, description: '必须为 true 才会真正下发' },
    },
    output: textOutput,
    async execute(args) {
      const allowed = new Set(['on', 'brightness', 'color-temperature', 'mode', 'toggle'])
      if (!allowed.has(String(args.spec))) return { ok: false, text: `不允许的属性：${args.spec}` }
      if (args.confirm !== true) return { ok: false, text: '需要 confirm=true 才会执行控制。' }
      const result = await runCli(['device', 'control', String(args.did), String(args.spec), String(args.value)])
      const json = parseJson(result.stdout)
      const ok = result.ok && (json?.code === 0 || json === null)
      return { ok, text: ok ? `已执行：${args.did} ${args.spec}=${args.value}` : `控制失败：${result.stderr || result.stdout || '未知错误'}` }
    },
  }))

  tools.register(defineTool({
    name: 'miloco_events',
    description: '读取最近的小米设备行为事件（开/关变化）。',
    parameters: { limit: { type: 'number', description: '最多返回多少条，默认 100' } },
    output: textOutput,
    async execute(args) {
      const rows = await readEvents(eventFile(), args?.limit || 100)
      if (!rows.length) return { ok: true, text: '还没有行为记录（后台每 30 秒采样一次，设备状态变化后才会写入）。' }
      return { ok: true, text: rows.map((e) => `${e.ts.slice(5, 16)} ${e.name}（${e.room}）${e.spec}: ${e.prev} → ${e.value}`).join('\n') }
    },
  }))

  tools.register(defineTool({
    name: 'miloco_patterns',
    description: '根据行为日志总结设备使用模式，并给出自动化建议（例如每天几点开灯）。',
    parameters: {},
    output: textOutput,
    async execute() {
      const items = patterns(await readEvents(eventFile(), 5000))
      if (!items.length) return { ok: true, text: '样本还不够（至少需要同一设备两次开机记录），再跑几天。' }
      return { ok: true, text: items.map((i) => `${i.name}（${i.room}）：${i.suggestion}`).join('\n') }
    },
  }))

  tools.register(defineTool({
    name: 'miloco_setup',
    description: '检查 miloco-cli / 后端 / 账号绑定，给出下一步准确命令。',
    parameters: {
      install: { type: 'boolean', description: '为 true 时给出安装命令（不会自动执行）' },
    },
    output: textOutput,
    async execute(args) {
      const version = await runCli(['version'])
      const installed = version.ok || !/ENOENT/.test(version.stderr || '')
      const health = installed ? await backendHealth() : false
      const bound = installed ? await isBound() : false
      const steps = [
        `1. miloco-cli：${installed ? '已安装' : '未安装'}`,
        `2. 后端（${BACKEND_URL}）：${health ? '运行中' : '未运行'}`,
        `3. 账号：${bound ? '已绑定' : '未绑定'}`,
      ]
      if (!installed) steps.push(`安装 CLI：\n  ${INSTALL_COMMAND}`)
      if (installed && !health) steps.push('启动后端：\n  miloco-cli service start')
      if (!bound) steps.push('绑定账号：\n  miloco-cli account bind（扫码，必须人工）')
      return { ok: installed && health && bound, text: steps.join('\n') }
    },
  }))

  tools.register(defineTool({
    name: 'miloco_ui',
    description: '启动/获取米家设备控制面板地址（本地 Web UI）。',
    parameters: { port: { type: 'number', description: '可选端口，默认 5888' } },
    output: textOutput,
    async execute(args) {
      const port = Number(args?.port) || Number(process.env.DSH_MILOCO_UI_PORT) || 5888
      const url = await startUiServer({
        port,
        listDevices,
        props,
        control: (payload) => controlDevice(payload),
        events: (limit) => readEvents(eventFile(), limit),
        patterns: async () => patterns(await readEvents(eventFile(), 5000)),
      })
      return { ok: true, text: `控制面板已启动：${url}` }
    },
  }))

  if (process.env.DSH_MILOCO_LOG !== '0') {
    const interval = Math.max(10000, Number(process.env.DSH_MILOCO_LOG_INTERVAL_MS || 30000))
    const dispose = startLogger({ listDevices: async () => (await listDevices()).parsed ?? { devices: [] }, props: async (did) => parseProps((await props(did)).json), file: eventFile(), intervalMs: interval,
      log: (m) => console.warn('[dsh-miloco] ' + m) })
    ctx.effect?.(() => dispose)
  }

  // 自动启动本地面板，避免用户先打开 tab 时拿到连接失败
  if (!['0', 'false', 'no', 'off'].includes(String(process.env.DSH_MILOCO_UI ?? '').toLowerCase())) {
    const port = Math.max(1024, Number(process.env.DSH_MILOCO_UI_PORT || 5888))
    ctx.effect?.(() => () => { closeUiServer(port).catch(() => {}) })
    startUiServer({
      port,
      listDevices: async () => listDevices(),
      props: async (did) => props(did),
      control: (payload) => controlDevice(payload),
      events: (limit) => readEvents(eventFile(), limit),
      patterns: async () => patterns(await readEvents(eventFile(), 5000)),
    }).catch((error) => console.warn('[dsh-miloco] 面板启动失败：' + (error?.message || error)))
  }

  console.log('[dsh-miloco] 已注册工具：miloco_status、miloco_setup、miloco_devices、miloco_props、miloco_control、miloco_ui、miloco_events、miloco_patterns')
}

async function controlDevice({ did, spec, value, confirm }) {
  const allowed = new Set(['on', 'brightness', 'color-temperature', 'mode', 'toggle'])
  if (!allowed.has(String(spec))) throw new Error(`不允许的属性：${spec}`)
  if (confirm !== true) throw new Error('需要 confirm=true')
  const result = await runCli(['device', 'control', String(did), String(spec), String(value)])
  const json = parseJson(result.stdout)
  if (!result.ok || (json && json.code !== 0)) throw new Error(result.stderr || result.stdout || '控制失败')
  return json ?? { code: 0 }
}

export { listDevices, props, controlDevice }
