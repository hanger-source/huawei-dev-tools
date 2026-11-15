# 响应式布局模式识别规则

4 种核心布局类型的 DSL 模板与最小示例。识别条件见 `rules.md`；字段定义见 `dsl-schema.md`；断点取值见 `breakpoints.md`。

## 4种核心布局模式

### 1. flex（线性布局）

**适用场景**：单行/单列的有序排列

```json
{
  "layoutStrategy": {
    "type": "flex",
    "direction": "row",
    "alignment": {
      "horizontal": "start | center | end | space-between | space-around | space-evenly",
      "vertical": "top | center | bottom | space-between | space-around"
    },
    "wrap": false,
    "gap": 8
  }
}
```

`direction` 取 `row | column`；`wrap` 控制是否换行。

### 2. grid（网格布局）

**适用场景**：等分规则排列，组件严格对齐

```json
{
  "layoutStrategy": {
    "type": "grid",
    "gridConfig": {
      "columns": "repeat(N, 1fr)",
      "rows": "auto",
      "columnGap": 4,
      "rowGap": 4
    }
  }
}
```

`columns` 也可用 `repeat(auto-fill, minmax(100px, 1fr))`，`rows` 也可用 `repeat(N, 1fr)`。

### 3. stack（堆叠布局）

**适用场景**：组件重叠，需要z轴层级控制

```json
{
  "layoutStrategy": {
    "type": "stack",
    "stackConfig": {
      "zIndex": [2, 1, 3],
      "alignment": {
        "horizontal": "center",
        "vertical": "top"
      }
    }
  }
}
```

`zIndex` 数组按叠放顺序列出各子组件的层级；`alignment` 取 `start | center | end`（横向）与 `top | center | bottom`（纵向）。

### 4. mixed（混合布局）

**适用场景**：同一容器内存在多种布局模式

```json
{
  "layoutStrategy": {
    "type": "mixed",
    "groups": [
      {
        "yRange": [0, 100],
        "strategy": { "type": "flex", "direction": "row" }
      }
    ]
  }
}
```

`groups` 的 `strategy` 是 flex / grid / stack 之一的 `LayoutStrategy`。

## 组件尺寸策略

| 策略类型 | 含义 | DSL模板 |
|---------|------|--------|
| fixed | 固定值 | `{ "type": "fixed", "value": number }` |
| percentage | 百分比 | `{ "type": "percentage", "value": "N%" }` |
| flex | 弹性增长 | `{ "type": "flex", "value": number }` |
| auto | 自动尺寸 | `{ "type": "auto" }` |
| minmax | 最小-最大约束 | `{ "type": "minmax", "min": N, "max": M }` |

## 断点适配策略

| 策略 | 适用场景 |
|------|---------|
| 布局方向切换 | 小屏幕column，大屏幕row |
| 网格列数变化 | sm单列，md双列，lg三列+ |
| 组件尺寸调整 | 图标/字号/间距随断点缩放 |
| 内容显隐控制 | 小屏幕隐藏非核心组件 |

断点区间的取值、方向切换与列数映射以 `breakpoints.md` 为唯一来源。

## 最小示例：输入 → 推断 → 输出

**输入片段**（5 个等宽等间距 Column；`page.width: 375` 为设计稿宽度，不是断点值）：

```json
[
  { "id": "item_0", "componentName": "Column", "meta": { "bbox": [16, 16, 84.6, 191.2] }, "children": [] },
  { "id": "item_1", "componentName": "Column", "meta": { "bbox": [88.6, 16, 157.2, 191.2] }, "children": [] }
]
```

**推断**：grid，5 列等宽等间距；输出片段（其余节点同构，断点条目为完整 `BreakpointConfig`）：

```json
{
  "layoutStrategy": {
    "type": "grid",
    "gridConfig": { "columns": "repeat(5, 1fr)", "columnGap": 4, "rowGap": 4 }
  },
  "ui": {
    "children": [
      {
        "id": "item_0",
        "componentName": "Column",
        "meta": { "bbox": [16, 16, 84.6, 191.2] },
        "responsive": { "width": { "type": "flex", "value": 1 } },
        "children": []
      }
    ]
  },
  "breakpoints": [
    { "name": "xs", "minWidth": 0, "maxWidth": 320, "layoutAdjustments": { "columns": 2 } },
    { "name": "lg", "minWidth": 840, "maxWidth": 1440, "layoutAdjustments": { "columns": 5 } }
  ]
}
```

**按钮组变体**：2 个 Button 两端对齐（如取消/确认）推断为 `flex` + `direction: "row"` + `alignment: { "horizontal": "space-between", "vertical": "center" }`，每个按钮 `responsive.width: { "type": "percentage", "value": "45%" }`。
