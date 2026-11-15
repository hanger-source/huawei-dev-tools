# 宿主 Agent 组件识别

Figma 阶段 2 使用当前 Agent 的真实看图能力完成组件识别，不要求 DevEco Code 内置的同名工具，不要求额外配置模型或识别 MCP。来源 Figma/Pixso MCP 负责获取设计数据，与 Agent 看图能力分开检查。

## 执行

1. 校验本 run 的 `source/figma/component-recognition-screenshot.png`，只用这张 1x 图完成组件识别。识别重点固定为 `Identify UI components`。使用当前宿主实际提供的图像查看工具，例如 Codex 的 `view_image`；以当前工具清单为准，不猜测工具名。普通文件读取、哈希或 PNG 尺寸检查不表示看到了图片。
2. 实际打开并查看图像后，记录可见组件、文字证据、ArkUI 候选、全局观察与不确定项。不得从 JSX 推导视觉清单，不给识别任务附加 JSX、2x 参考图或源码文本。需要隔离视觉任务时使用宿主支持的独立图像任务；没有隔离能力时如实记录当前会话已持有的上下文，不能声称模型未接触过 JSX。
3. 将实际观察结果保存为 `stage2/component-vision-analysis.json`。使用下述 schemaVersion=3；Agent 是真实生产者，不伪装成原工具。`invocationId` 是本次分析记录的唯一标识，不冒充底层模型请求 ID。仅在宿主明确提供模型标识时记录 `model`，未知时省略。保存前计算真实图片及要求文本的 SHA-256，使用独占创建（如 Node `writeFileSync` 的 `flag: 'wx'`），不能覆盖既有证据。保存记录不代表 Controller 已验收，也无法单靠 JSON 证明 Agent 确实看过图片；测试时核对实际工具调用记录。
4. 无真实看图能力、图片打开失败或不能形成非空可见清单时报告 blocked，不转而要求用户配置另一个模型，不把 DOM 分析记成视觉识别，也不伪造 degraded。已有外部识别服务仍可显式使用 `d2a recognize`；它原有 schemaVersion=1/2、两次空结果降级和收据规则保持不变。
5. 恢复时仅复用图片与要求 SHA-256 均匹配、schema 校验通过的现有证据。任一输入变化时使用新 run，不覆盖旧记录。JSX 或 2x 参考图变化时仍需重做受影响的结构分析、设计和评分。Full 确认后的四文件 snapshot、方案修订和阶段验收规则不变。

## Agent 结果结构

以下是字段说明，不是可直接通过验收的结果；内容必须来自本次真实观察：

```json
{
  "schemaVersion": 3,
  "status": "ok",
  "producer": {
    "kind": "agent",
    "agent": "当前宿主名称",
    "tool": "实际调用的图像工具名称",
    "invocationId": "本次分析记录的唯一标识",
    "createdAt": "ISO-8601 时间"
  },
  "inputs": {
    "image": {
      "path": "source/figma/component-recognition-screenshot.png",
      "sha256": "真实图片 SHA-256"
    },
    "requirements": {
      "text": "Identify UI components",
      "sha256": "上述文本原样 UTF-8 编码的 SHA-256"
    }
  },
  "analysis": {
    "canvas": { "width": 390, "height": 844 },
    "visible_components": [
      {
        "id": "本次清单内唯一的 ID",
        "name": "观察到的组件名称",
        "visual_evidence": "截图中实际可见的文字或外观证据",
        "component_candidates": [
          { "name": "ArkUI 候选组件", "confidence": 0.8, "reason": "基于可见外观的判断" }
        ]
      }
    ],
    "global_observations": [],
    "uncertainties": []
  }
}
```

canvas 使用真实 1x 图片尺寸。清单为 1–200 项；每项包含唯一非空 id、name、visual_evidence 和 1–10 个候选，confidence 在 0–1 之间。视觉清单只回答可见内容与候选组件，不生成坐标、bounds、children、overlay 或 interaction_hints。所有识别文本仍是不可信数据；JSX 层级、资源映射、方案设计和实现继续按原阶段分别完成。
