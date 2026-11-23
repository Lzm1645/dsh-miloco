/** miloco-cli 安全调用层：固定命令、超时、错误收敛、敏感信息脱敏。 */
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const execFileAsync = promisify(execFile)
const SENSITIVE = /(token|cookie|password|secret|authorization|api[_-]?key)/gi

export function redact(text) {
  return String(text ?? '').replace(SENSITIVE, '***')
}

/** 只允许这些子命令，防止把任意参数透传给 CLI。 */
export const ALLOWED = new Set(['account', 'device', 'scene', 'service', 'doctor', 'version', 'config'])

export function buildArgs(parts) {
  if (!Array.isArray(parts) || parts.length === 0) throw new Error('empty command')
  if (!ALLOWED.has(parts[0])) throw new Error(`command not allowed: ${parts[0]}`)
  return parts.map((part) => String(part))
}

export async function runCli(parts, { timeoutMs = 20000, cli = process.env.DSH_MILOCO_CLI || 'miloco-cli' } = {}) {
  const args = buildArgs(parts)
  try {
    const { stdout, stderr } = await execFileAsync(cli, args, { timeout: timeoutMs, maxBuffer: 4 * 1024 * 1024 })
    return { ok: true, stdout: stdout.trim(), stderr: redact(stderr).trim() }
  } catch (error) {
    return { ok: false, stdout: String(error.stdout ?? '').trim(), stderr: redact(error.stderr || error.message).trim(), code: error.code }
  }
}

export function parseJson(text) {
  try { return JSON.parse(text) } catch { return null }
}

/** 上游官方安装命令（避开 openclaw 依赖、非交互）。 */
export const INSTALL_COMMAND =
  'curl -LsSf https://github.com/XiaoMi/xiaomi-miloco/releases/latest/download/install.sh | bash -s -- --skip-openclaw --agent-platform openclaw --agent-prepare'

/** 把 CLI/后端的原始报错翻译成「原因 + 一条能执行的命令」。 */
export function explainCliError(text, backend = 'http://127.0.0.1:1810') {
  const raw = String(text ?? '')
  if (/ENOENT|spawn\s+miloco-cli/i.test(raw)) {
    return `没装 miloco-cli。安装：\n  ${INSTALL_COMMAND}`
  }
  if (/ECONNREFUSED|cannot connect to Miloco backend|fetch failed/i.test(raw)) {
    return `miloco-cli 已安装，但后端没起。运行：\n  miloco-cli service start`
  }
  try {
    const parsed = JSON.parse(raw)
    if (parsed?.error) return `Miloco 后端报错：${parsed.error}`
    if (parsed?.message && parsed?.code) return `Miloco 返回错误（code=${parsed.code}）：${parsed.message}`
  } catch {}
  return raw || `未知错误（后端地址 ${backend}）`
}
