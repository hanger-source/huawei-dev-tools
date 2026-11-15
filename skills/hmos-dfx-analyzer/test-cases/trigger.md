# 触发验证测试用例

---

### 测试用例：TRIGGER-001

**skill**：hmos-dfx-analyzer
**类型**：trigger（触发验证）

#### 输入

帮我分析这个崩溃日志 /data/log/faultlog/faultlogger/cppcrash-com.example.app-10217-12345

#### 预期输出

**应触发**：是

---

### 测试用例：TRIGGER-002

**skill**：hmos-dfx-analyzer
**类型**：trigger（触发验证）

#### 输入

我的应用卡死没响应，这是冻屏日志 /data/log/faultlog/faultlogger/appfreeze-com.example.app-5678

#### 预期输出

**应触发**：是

---

### 测试用例：TRIGGER-003

**skill**：hmos-dfx-analyzer
**类型**：trigger（触发验证）

#### 输入

点击应用就闪退，没有日志

#### 预期输出

**应触发**：是（症状口述入口，进入采集流程）

---

### 测试用例：TRIGGER-004

**skill**：hmos-dfx-analyzer
**类型**：trigger（触发验证）

#### 输入

工程能构建也不会崩溃，但冷启动一直白屏，应用没退出。不要先复现，直接定位。

#### 预期输出

**应触发**：是（非崩溃型白屏 source-first 路径）

---

### 测试用例：TRIGGER-005

**skill**：hmos-dfx-analyzer
**类型**：trigger（触发验证）

#### 输入

DevEco 里我的 ArkTS 代码编译报错了：Property 'name' does not exist on type，帮我修一下

#### 预期输出

**应触发**：否（一般编译错误，不属故障分析）

---

### 测试用例：TRIGGER-006

**skill**：hmos-dfx-analyzer
**类型**：trigger（触发验证）

#### 输入

我的应用内存泄漏越来越严重，帮忙分析一下

#### 预期输出

**应触发**：否（内存泄漏/OOM 性能问题，不属三类故障）

---

### 测试用例：TRIGGER-007

**skill**：hmos-dfx-analyzer
**类型**：trigger（触发验证）

#### 输入

分析下这段日志：09-21 14:23:31.831 14337 14363 I A0fefe/JSAPP hilog 流水内容

#### 预期输出

**应触发**：是（故障日志分析请求；技能加载后由识别脚本判 out_of_scope 拒答，触发层面仍为"是"）

---

### 测试用例：TRIGGER-008

**skill**：hmos-dfx-analyzer
**类型**：trigger（触发验证）

#### 输入

帮我在设置页面加一个深色模式开关

#### 预期输出

**应触发**：否（常规功能开发）
