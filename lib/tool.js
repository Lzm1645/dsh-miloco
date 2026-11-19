/** 复用 DSH 的 defineTool；桌面宿主提供解析钩子，CLI profile 用 createRequire 兜底。 */
import { createRequire } from 'node:module'

export let defineTool = null

try {
  ({ defineTool } = await import('@deepseek-ai/dsh-tools'))
} catch {
  const anchors = [process.argv[1], process.argv[0], process.execPath].filter(Boolean)
  const fallbacks = ['/opt/homebrew/lib/node_modules/@deepseek-ai/dsh/lib/bin.js', '/usr/local/lib/node_modules/@deepseek-ai/dsh/lib/bin.js']
  for (const anchor of [...anchors, ...fallbacks]) {
    try {
      const require = createRequire(anchor)
      const resolved = require.resolve('@deepseek-ai/dsh-tools')
      ;({ defineTool } = await import(resolved))
      if (defineTool) break
    } catch {
      // try next anchor
    }
  }
}

if (typeof defineTool !== 'function') defineTool = null
