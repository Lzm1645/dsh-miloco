# Roadmap / 持续运营

## 优化方向（按优先级）

1. **原生面板**：现在是 iframe 内嵌；改成 DSH client primitives 的原生 React 面板（设备卡、详情抽屉、场景）。
2. **设备详情**：色温/模式/动作（`toggle`）、按型号显示能力，而不是只显示开关和亮度。
3. **自动化引擎**：把 `miloco_patterns` 的建议变成规则（cron/触发），执行前 dry-run + 确认，保留审计日志。
4. **事件存储**：JSONL → SQLite，加保留策略、导出、异常检测（如整夜未关灯）。
5. **多家庭/多账号**、设备收藏、搜索优化、品牌图标。
6. **发布**：dshmarket 上架、npm publish、GitHub Releases（语义化版本）、中文/英文 README。
7. **质量**：CI（GitHub Actions 跑 7 个测试）、更多单测、E2E 脚本参数化。

## 持续运营

- 每周：看 issues/PR、上游 `miloco-cli` 版本变化（`miloco-cli --version`）、DSH 版本兼容性；
- 每月：一个 release（CHANGELOG + tag），回顾 roadmap；
- 合规：每次发布检查 NOTICE 与上游许可/条款变化，不复制上游代码、不使用官方标识误导。

## 已知边界

- 依赖本机 Miloco 后端与账号绑定；
- 只覆盖设备开关/亮度等基础能力，摄像头/感知/身份库未接；
- UI 只监听 127.0.0.1。
