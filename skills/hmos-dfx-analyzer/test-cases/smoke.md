# 冒烟测试用例（分诊路由）

---

### 测试用例：SMOKE-001

**skill**：hmos-dfx-analyzer
**类型**：smoke（路由冒烟）
**阶段**：分诊

#### 输入

这是 jscrash 日志：Reason: TypeError ... Stacktrace: at loadUserConfig entry (entry/src/main/ets/view/Setting.ets:34:42)，帮我分析

#### 预期输出

**应命中场景**：识别脚本判定 js_crash，按固定路由加载 references/jscrash/analyzer.md
**禁止命中场景**：app_freeze / cpp_crash / white_screen 路由

---

### 测试用例：SMOKE-002

**skill**：hmos-dfx-analyzer
**类型**：smoke（路由冒烟）
**阶段**：分诊

#### 输入

帮我分析这个冻屏日志 /data/log/faultlog/faultlogger/appfreeze-sample.log

#### 预期输出

**应命中场景**：识别脚本判定 app_freeze，加载 references/appfreeze/analyzer.md
**禁止命中场景**：js_crash / cpp_crash 路由

---

### 测试用例：SMOKE-003

**skill**：hmos-dfx-analyzer
**类型**：smoke（路由冒烟）
**阶段**：分诊

#### 输入

请修复当前 HarmonyOS 应用在运行时发生的崩溃（疑似 Native/C++ 崩溃），并完成编译。日志：/data/log/faultlog/faultlogger/cppcrash-sample.log

#### 预期输出

**应命中场景**：识别脚本判定 cpp_crash，加载 references/cppcrash/analyzer.md；修复意图场景诊断后交主 Agent 承接
**禁止命中场景**：js_crash / app_freeze 路由

---

### 测试用例：SMOKE-004

**skill**：hmos-dfx-analyzer
**类型**：smoke（路由冒烟）
**阶段**：症状入口

#### 输入

首页能显示，点击卡片 pushPathByName 后目标页白屏，应用没退。

#### 预期输出

**应命中场景**：白屏存活判定通过，走 references/white-screen/analyzer.md source-first 路径，不做设备侧采集
**禁止命中场景**：进入采集死循环；按三类故障勉强分析

---

### 测试用例：SMOKE-005

**skill**：hmos-dfx-analyzer
**类型**：smoke（路由冒烟）
**阶段**：分诊

#### 输入

帮我分析这个空文件 /tmp/empty.log

#### 预期输出

**应命中场景**：识别脚本判定 unknown / 范围外，输出无法判定结论块，不加载任何 Analyzer
**禁止命中场景**：猜测类型强行加载 Analyzer
