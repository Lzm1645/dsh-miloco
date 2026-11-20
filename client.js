/**
 * DSH 客户端半侧：在右侧栏注册「米家」标签类型 + 面板内容。
 *
 * 关键：DSH 的 sidebar.right.pane.tab 只渲染「已注册类型」的 tab。
 *   - 类型用 ctx.sidebarRightTabs.register({ id, kind, title, ... })；
 *   - 内容用 ctx.slots.register({ name: 'sidebar.right.pane.tab', key: id })，
 *     entryKey 是类型的 id（不是 kind）；
 *   - 打开用 ctx.sidebarRight.openTab(kind)。
 * 只注册 slot 内容而不注册类型，右侧栏会显示「这类内容还没有可用的查看方式」。
 */
;(() => {
  window.__ModuleLoader__.load({
    id: 'dsh-miloco',
    factory: (require) => {
      const module = { exports: {} }
      const React = require('react')
      const { jsx: h } = require('react/jsx-runtime')

      const name = 'dsh-miloco'
      const inject = ['slots', 'sidebarRight', 'sidebarRightTabs']
      const TAB_ID = 'miloco'
      const KIND = 'miloco'
      const PANEL_URL = (typeof window !== 'undefined' && window.__DSH_MILOCO_UI__) || 'http://127.0.0.1:5888/'

      function Panel() {
        const [url, setUrl] = React.useState(PANEL_URL)
        return h(
          'div',
          { style: { display: 'flex', flexDirection: 'column', height: '100%', background: '#0b1220' } },
          h(
            'div',
            { style: { display: 'flex', alignItems: 'center', gap: 8, padding: '8px 12px', borderBottom: '1px solid #22314d', color: '#8ea2bd', fontSize: 12 } },
            h('span', null, '米家设备'),
            h('span', { style: { flex: 1 } }),
            h('button', { onClick: () => setUrl(PANEL_URL + '?t=' + Date.now()), style: { background: 'transparent', border: '1px solid #22314d', color: '#8ea2bd', borderRadius: 8, padding: '3px 9px', cursor: 'pointer' } }, '刷新'),
            h('a', { href: PANEL_URL, target: '_blank', rel: 'noreferrer', style: { color: '#4da3ff', fontSize: 12 } }, '独立打开')
          ),
          h('iframe', { src: url, title: '米家设备', style: { flex: 1, width: '100%', border: 0, background: '#0b1220' } })
        )
      }

      function apply(ctx) {
        // 1) 注册 tab 类型（标题、图标位、打开入口都来自这里）
        ctx.effect(
          () =>
            ctx.sidebarRightTabs.register({
              id: TAB_ID,
              kind: KIND,
              multiple: false,
              priority: 'extension',
              title: () => '米家',
              guide: [{ id: 'open', order: 80, title: () => '米家', description: () => '小米 Miloco 设备控制面板' }],
            }),
          'dsh-miloco.type'
        )

        // 2) 注册 tab 内容，key 必须是类型 id
        ctx.effect(
          () =>
            ctx.slots.inject('sidebar.right.pane.tab', () =>
              ctx.slots.register({ name: 'sidebar.right.pane.tab', key: TAB_ID }, Panel)
            ),
          'dsh-miloco.body'
        )

        // 3) 首次加载自动打开一次；用户手动关掉后不再打扰
        try {
          const key = 'dsh-miloco:auto-opened'
          if (window.localStorage?.getItem(key) !== '1') {
            window.localStorage?.setItem(key, '1')
            ctx.sidebarRight.openTab(KIND, { replaceTab: false })
          }
        } catch {}
      }

      module.exports = { apply, inject, name }
      return module.exports
    },
  })
})()
