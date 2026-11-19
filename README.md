# dsh-miloco

[![ci](https://github.com/Lzm1645/dsh-miloco/actions/workflows/ci.yml/badge.svg)](https://github.com/Lzm1645/dsh-miloco/actions/workflows/ci.yml) [![release](https://img.shields.io/github/v/release/Lzm1645/dsh-miloco)](https://github.com/Lzm1645/dsh-miloco/releases) [![license](https://img.shields.io/github/license/Lzm1645/dsh-miloco)](LICENSE)


> 第三方集成：本项目通过本机 `miloco-cli` 调用 **Xiaomi Miloco（米家）**，与小米集团无隶属或官方背书关系；Miloco/米家名称与标识归小米所有。详见 [NOTICE](NOTICE)。

![控制面板](docs/screenshot.png)

把小米 **Miloco（米家）** 设备接入 **DeepSeek Harness**：一组 DSH 工具 + 一个本地控制面板。

- 工具：`miloco_status` / `miloco_devices` / `miloco_props` / `miloco_control` / `miloco_ui`
- UI：`http://127.0.0.1:5888/`（深色主题，按房间分组，灯/插座/净化器支持开关与亮度）
- 后端：复用本机 `miloco-cli`（不实现小米登录、不保存凭据）

## 依赖

1. 安装并登录 `miloco-cli`（`miloco-cli account bind`），后端服务在跑（`miloco-cli service status` 返回 `running: true`）；
2. Node.js ≥ 20；
3. DSH 桌面版（web profile）。

## 安装

```bash
# 1) 链接到 desktop profile
cd ~/.dsh/profiles/desktop
python3 - <<'PY'
import json
p='package.json'; d=json.load(open(p))
d.setdefault('dependencies',{})['dsh-miloco']='link:/path/to/dsh-miloco'
if 'dsh-miloco' not in d['dsh']['profile']['bundles']:
    d['dsh']['profile']['bundles'].append('dsh-miloco')
open(p,'w').write(json.dumps(d,ensure_ascii=False,indent=2))
PY
ln -sfn /path/to/dsh-miloco node_modules/dsh-miloco

# 2) ⌘Q 重启 DSH（插件只在启动时加载）
```

安装后在 DSH 里可以直接说「列出我的米家设备」「把台灯1打开」，或调用 `miloco_ui` 拿到面板地址。

## 工具

| 工具 | 作用 |
|---|---|
| `miloco_status` | 账号绑定与后端服务状态 |
| `miloco_devices` | 设备列表（名称/房间/类别/在线） |
| `miloco_props` | 读取设备属性（on/brightness/color-temperature） |
| `miloco_control` | 控制属性，**必须 `confirm=true`**，只允许 on/brightness/color-temperature/mode/toggle |
| `miloco_ui` | 启动/获取本地控制面板 URL |
| `miloco_events` | 最近的行为事件（开/关变化） |
| `miloco_patterns` | 使用模式与自动化建议（如「每天 19:00 开灯」） |

## 安全边界

- 不实现小米登录协议、不保存凭据、不打印 token；
- 只允许白名单子命令与属性；
- 控制必须显式 `confirm=true`；
- UI 只监听 `127.0.0.1`，不对外暴露。

## 行为日志与智能建议

- 后台每 30 秒采样一次在线可控设备（灯/插座/净化器/电视）的 `on` 状态，状态变化写入 `~/.dsh/state/dsh-miloco/events.jsonl`；
- `miloco_patterns` 按小时统计开机时间，给出「通常 19:00 开灯，可以设成定时自动开」这类建议；
- 面板底部有「智能建议 / 最近行为」区块；
- 环境变量：`DSH_MILOCO_LOG=0` 关闭采样，`DSH_MILOCO_LOG_INTERVAL_MS` 调整间隔，`DSH_MILOCO_EVENTS` 改事件文件路径。

## DSH 客户端集成

- 插件同时提供客户端半侧（`client.js`）：在 DSH 右侧栏注册「米家」标签页，内嵌本地面板；
- `package.json` 已声明 `exports['./client']` 与 `dsh.client`（web 平台）；
- 安装并重启 DSH 后，右侧栏会出现「米家」标签。

## UI 设计

- 参考 Home Assistant 的 dashboard 原则：卡片按状态着色、一个操作一个结果、只显示设备真正支持的控制、状态不对时如实变灰；
- 参考 NN/g 的智能设备可用性建议：打开即见所有设备状态、操作后立即反馈；
- 按房间分组、顶部搜索、在线计数、深色主题、移动端适配；
- **演示模式**：`http://127.0.0.1:5888/?demo=1` 用内置示例设备渲染（不含任何真实设备名/家庭信息），截图与文档统一用这个模式。

## 验证

```bash
npm test          # 4 个单测（解析/白名单/脱敏）
node scripts/verify-ui.mjs   # 起本地面板（127.0.0.1:5889）用真实设备验证
```

E2E 已在本机验证：读取 11 台设备、台灯1 `on=false→true→false` 往返、UI 渲染与开关/亮度。

## 边界

- 目前只做设备控制与状态读取；场景（scene）为空时不展示；
- 设备能力（亮度/色温）因型号而异，UI 只对 light/air-purifier 显示亮度；
- 不做摄像头/感知/身份库等 Miloco 高级能力（后续可扩展）。

## License

MIT
