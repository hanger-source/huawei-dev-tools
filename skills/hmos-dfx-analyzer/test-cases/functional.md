# 功能性测试用例

---

### 测试用例：FUNC-001

**skill**：hmos-dfx-analyzer
**类型**：functional（功能验证）

#### 输入

帮我分析这个崩溃日志 /data/log/faultlog/faultlogger/cppcrash-com.example.app-10217-12345

#### 预期输出

**验证标准**：

- 先运行 identify_fault_log.py 完成确定性分诊，不得按文件名或口述预设类型
- 分诊判为 cpp_crash 后仅加载 cppcrash analyzer
- 会话内只输出简洁摘要（分诊结论、根因 1~3 句、修复方向、报告路径），不输出报告正文
- 完整报告经 export_report.py 写入 dfx-reports/ 下的 HTML，摘要中的报告路径为绝对路径

**应包含**：分诊结论, dfx-reports

---

### 测试用例：FUNC-002

**skill**：hmos-dfx-analyzer
**类型**：functional（功能验证）

#### 输入

这是 jscrash 日志片段：
Reason: TypeError
at loadUserConfig (entry/src/main/ets/view/Setting.ets:34:42)
at buildSettingPage (entry/src/main/ets/view/Setting.ets:52:10)
帮我分析

#### 预期输出

**验证标准**：

- 片段输入经 --stdin 走同一套分诊判别
- 分诊为 js_crash 后加载 jscrash analyzer，按故障模式库匹配三级根因
- 分析结论置信度不高于分诊置信度（片段通常为 medium 及以下），摘要中显式标注

**应包含**：js_crash, 置信度

---

### 测试用例：FUNC-003

**skill**：hmos-dfx-analyzer
**类型**：functional（功能验证）

#### 输入

请修复当前 HarmonyOS 应用在运行时发生的崩溃（JSCrash），并完成编译。

#### 预期输出

**验证标准**：

- 诊断与修复分工：子会话只产出诊断报告，不直接修改业务源码
- 会话摘要附带诊断状态与"源码修改状态：未执行，由主 Agent 承接"及固定承接语句
- 不得声称修复已经开始或完成

**应包含**：主 Agent 承接

---

### 测试用例：FUNC-004

**skill**：hmos-dfx-analyzer
**类型**：functional（功能验证）

#### 输入

帮我分析这个目录下的所有故障日志 /data/log/faultlog/faultlogger/

#### 预期输出

**验证标准**：

- 批量场景确认全量后逐份分诊，每份独立走决策表
- 合并报告每份日志以 `### 日志 N：<文件名>` 起节，分节首行为该份的分诊结论行
- 每份分节完整遵循对应 Analyzer 输出格式章节，不得自创压缩结构
- 分诊摘要表逐份携带 类型 / 输入完整度 / 置信度 三字段

**应包含**：分诊摘要, 日志 1

---

### 测试用例：FUNC-005

**skill**：hmos-dfx-analyzer
**类型**：functional（功能验证）

#### 输入

工程能构建也不会崩溃，但冷启动一直白屏，应用没退出，不要先复现，直接定位并修复。

#### 预期输出

**验证标准**：

- 白屏存活判定后直接 source-first 分析，不索要日志、不要求连接设备
- 按聚焦检视顺序检查 main_pages.json / EntryAbility.loadContent / 入口页 Navigation / hideNavBar / navDestination
- 修复遵循最小改动约束；报告按三档验证契约区分根因匹配 / 构建验证 / 运行时间验证

**应包含**：loadContent, 白屏
