/**
 * DSH 客户端半侧：在右侧栏注册「米家」标签页，内嵌本地面板。
 * 面板由宿主半侧启动（默认 http://127.0.0.1:5888/）。
 */
;(() => {
  window.__ModuleLoader__.load({
    id: 'dsh-miloco',
    factory: (require) => {
      const module = { exports: {} }
      const React = require('react')
      const { jsx: h } = require('react/jsx-runtime')

      const name = 'dsh-miloco'
      const inject = ['@deepseek-ai/dsh-client-connection']
      const PANEL_URL = 'http://127.0.0.1:5888/'

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
        ctx.slots.inject('sidebar.right.pane.tab', function* () {
          yield ctx.slots.register(
            { name: 'sidebar.right.pane.tab', key: 'miloco', order: 95, label: () => '米家' },
            () => h(Panel, {})
          )
        })
      }

      module.exports = { apply, inject, name }
      return module.exports
    },
  })
})()
