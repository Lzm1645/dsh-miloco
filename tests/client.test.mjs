import test from 'node:test'
import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'

/** 用假的 React 跑一遍客户端模块，确保 Panel 能渲染、不会因 jsx 签名崩溃。 */
function loadClientModule() {
  const created = []
  const fakeReact = {
    createElement(type, props, ...children) {
      // React.createElement 允许 props 为 null；jsx() 不允许。这里模拟 createElement。
      created.push(type)
      return { type, props: props ?? {}, children }
    },
    useState(initial) {
      return [initial, () => {}]
    },
  }
  let moduleExports
  const window = {
    __ModuleLoader__: {
      load({ factory }) {
        moduleExports = factory((name) => {
          if (name === 'react') return fakeReact
          throw new Error('unexpected require: ' + name)
        })
      },
    },
    localStorage: { getItem: () => '1', setItem: () => {} },
  }
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  const fn = new Function('window', 'require', source)
  fn(window, (name) => (name === 'react' ? fakeReact : {}))
  return { moduleExports, created, fakeReact }
}

test('client module inlines createElement without crashing', () => {
  const { moduleExports } = loadClientModule()
  assert.equal(typeof moduleExports.apply, 'function')
  const source = readFileSync(new URL('../client.js', import.meta.url), 'utf8')
  assert.ok(!source.includes("jsx: h"), '不得再把 jsx runtime 当 createElement 用')
  assert.ok(source.includes('React.createElement'))
})

test('Panel renders children with createElement signature', async () => {
  const { moduleExports } = loadClientModule()
  const registered = []
  const ctx = {
    effect: (fn) => fn(),
    sidebarRightTabs: { register: (def) => (registered.push(def), () => {}) },
    slots: { inject: (name, fn) => fn(), register: (def, component) => (registered.push(component), () => {}) },
    sidebarRight: { openTab: () => {} },
  }
  moduleExports.apply(ctx)
  const panel = registered.find((item) => typeof item === 'function')
  assert.equal(typeof panel, 'function')
  const tree = panel()
  assert.equal(tree.type, 'div')
  const text = JSON.stringify(tree)
  assert.match(text, /米家设备/)
  assert.match(text, /iframe/)
})
