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
