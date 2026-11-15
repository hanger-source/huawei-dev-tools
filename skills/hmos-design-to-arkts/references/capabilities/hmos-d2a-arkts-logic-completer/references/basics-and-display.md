# 基础与展示（basics-and-display）

按组件名 / 场景词检索本文件，每个组件一节：坑位 + 常用接口表 + 字段与枚举表。标题括号内是设计稿名 / 中文别名，不是 API 名——写代码只用反引号里的真实 API。

### Button（按钮）

Button 是按钮组件，用于响应用户的点击操作并触发相应业务逻辑。

坑：按钮没有 onClick，点了没反应；没有防重复点击，用户连点会多次提交；没有 loading 状态反馈，用户不知道是否在处理；表单没校验就能提交；危险操作没有二次确认。

| API | 说明 |
|-----|------|
| `Button(label, options?)` | 创建文本按钮 |
| `Button()` / `Button(options?)` + 子组件 | 创建自定义内容按钮 |
| `ButtonType.ROUNDED_RECTANGLE` | 圆角矩形（API 15+，**API 18 起为默认值**） |
| `ButtonType.Capsule` | 胶囊型（API 18 前的默认值） |
| `ButtonType.Circle` | 圆形按钮 |
| `ButtonType.Normal` | 普通按钮（无圆角） |
| `.buttonStyle(ButtonStyleMode)` | 按钮重要程度：EMPHASIZED（强调）/ NORMAL（普通）/ TEXTUAL（文字）（API 11+） |
| `.controlSize(ControlSize)` | 按钮尺寸：SMALL / NORMAL（API 11+） |
| `.role(ButtonRole)` | 按钮角色：NORMAL / ERROR（警示红色）（API 12+） |
| `.labelStyle(LabelStyle)` | label 文本样式（overflow/maxLines/minFontSize 等）（API 10+） |
| `.stateEffect(boolean)` | 按压态效果，默认 true |
| `.enabled(boolean)` | 是否可点击 |
| `.onClick(() => void)` | 点击事件 |

> **注意**：API 18 起 ButtonType 默认值从 Capsule 变为 ROUNDED_RECTANGLE。使用 `ButtonStyleMode` 代替手动设置背景色/文字色，系统会自动适配深浅色模式。

### Text（文本显示）

Text 是文本显示组件，用于展示一段静态或动态文本内容。

坑：maxLines 和 textOverflow 只设了一个，省略号不生效；使用 textOverflow 的 MARQUEE 但没限制 maxLines 为 1；动态文本为空时没有占位处理；将业务逻辑放在 Text 的 content 拼接中，不好维护；copyOption 设置了但 textSelectable 没设置，长按无法选中。

| API | 说明 |
|-----|------|
| `Text(content?)` | 创建文本组件，支持 string / Resource |
| `Span(text)` | 文本子组件，用于图文混排和富文本 |
| `ImageSpan(src)` | 图片子组件，行内图片 |
| `.fontSize(number \| string \| Resource)` | 字体大小 |
| `.fontColor(ResourceColor)` | 字体颜色 |
| `.fontWeight(FontWeight \| number)` | 字体粗细 |
| `.fontStyle(FontStyle)` | 字体样式：Normal / Italic |
| `.fontFamily(string \| Resource)` | 字体族 |
| `.textAlign(TextAlign)` | 水平对齐：Start / Center / End |
| `.lineHeight(number \| string \| Resource)` | 行高 |
| `.letterSpacing(number \| string)` | 字间距 |
| `.maxLines(number)` | 最大行数 |
| `.textOverflow(options)` | 溢出方式：Ellipsis / Clip / MARQUEE / None |
| `.ellipsisMode(EllipsisMode)` | 省略位置：START / CENTER / END（API 11+） |
| `.wordBreak(WordBreak)` | 断行规则：NORMAL / BREAK_ALL / BREAK_WORD |
| `.decoration(TextDecorationOptions)` | 装饰线：Underline / LineThrough / Overline |
| `.textShadow(ShadowOptions)` | 文字阴影 |
| `.textCase(TextCase)` | 大小写转换：Normal / LowerCase / UpperCase |
| `.baselineOffset(number)` | 基线偏移 |
| `.textIndent(Dimension)` | 首行缩进 |
| `.copyOption(CopyOptions)` | 复制模式：None / InApp / LocalDevice / CROSS_DEVICE |
| `.textSelectable(TextSelectableMode)` | 文本选择模式（API 12+） |
| `.selection(start, end)` | 设置选中区域 |
| `.selectedBackgroundColor(color)` | 选中底板颜色 |
| `.minFontSize / .maxFontSize` | 自适应字号范围（需配合 maxLines 或布局限制） |
| `.heightAdaptivePolicy(policy)` | 自适应方式：MAX_LINES_FIRST / MIN_FONT_SIZE_FIRST |
| `.lineSpacing(LengthMetrics)` | 行间距（API 12+） |
| `.marqueeOptions(options)` | 跑马灯配置（API 18+） |
| `.enableDataDetector(boolean)` | 文本实体识别（API 11+） |
| `.editMenuOptions(EditMenuOptions)` | 自定义菜单扩展 |
| `.onClick(callback)` | 点击事件 |

> **注意**：`maxLines` 需要配合 `textOverflow` 使用，否则文字虽不显示超出部分但无省略号提示。MARQUEE 模式要求 `maxLines(1)` 且组件宽度有限制。

### TextClock（文本时钟）

TextClock 是文本时钟组件，通过文本将当前系统时间显示在设备上。

坑：没有绑定 controller，无法控制启停；format 设了无效字母，显示会回退到系统默认格式；timeZoneOffset 超出范围 [-14, 12]，会使用系统当前时区；在卡片中使用秒级格式，卡片最小单位为分钟，秒会被忽略；onDateChange 中没有更新 @State，UI 不会刷新。

| API | 说明 |
|-----|------|
| `TextClock({ timeZoneOffset?: number, controller?: TextClockController })` | 创建文本时钟，timeZoneOffset 设置时区偏移 |
| `.format(value: string)` | 设置时间显示格式，如 'HH:mm:ss'、'aa hh:mm:ss' |
| `.onDateChange((value: number) => void)` | 时间变化回调，参数为 Unix 时间戳（秒） |
| `.fontColor(color)` | 设置字体颜色 |
| `.fontSize(size)` | 设置字体大小 |
| `.fontWeight(weight)` | 设置字体粗细 |
| `.fontStyle(style)` | 设置字体样式（Normal / Italic） |
| `.fontFamily(family)` | 设置字体列表 |
| `.textShadow(shadow)` | 设置文字阴影效果（API 11+） |
| `.fontFeature(feature)` | 设置文字特性，如等宽数字 `"ss01" on`（API 11+） |
| `.dateTimeOptions({ hour: '2-digit' \| 'numeric' })` | 设置小时是否显示前导 0（API 12+） |
| `TextClockController.start()` | 启动文本时钟 |
| `TextClockController.stop()` | 停止文本时钟 |

### QRCode（二维码）

QRCode 是二维码组件，用于显示单个二维码图案。

坑：传入空字符串，生成无效二维码；内容超过 512 字符会被截取，长文本应使用短链；没有设置宽高，二维码可能太小无法扫描；二维码颜色和背景色太接近，无法识别。

| API | 说明 |
|-----|------|
| `QRCode(value: string)` | 创建二维码，最大支持 512 字符 |
| `.color(ResourceColor)` | 二维码前景色，默认黑色 |
| `.backgroundColor(ResourceColor)` | 背景色，默认白色 |
| `.contentOpacity(number \| Resource)` | 内容不透明度，范围 [0, 1]（API 11+） |

### Progress（进度条）

Progress 是进度条组件，用于显示内容加载或操作处理的进度。

坑：value 超出 total 范围，不会报错但会被截断；进度没有用 @State 管理，更新后不刷新；Ring 类型设置了 LOADING 状态却还设置 value（value 不生效）；type 和 style 不匹配。

| API | 说明 |
|-----|------|
| `Progress({ value, total?, type? })` | 创建进度条，type 默认 Linear |
| `ProgressType.Linear` | 线性进度条 |
| `ProgressType.Ring` | 环形无刻度 |
| `ProgressType.Eclipse` | 圆形（月相效果） |
| `ProgressType.ScaleRing` | 环形有刻度 |
| `ProgressType.Capsule` | 胶囊形（可带文字） |
| `.value(number)` | 动态更新进度值 |
| `.color(ResourceColor \| LinearGradient)` | 前景色，Ring 支持渐变（API 10+） |
| `.style(options)` | 样式设置，根据 type 使用对应 Options |
| `ProgressStatus.LOADING` | Ring 类型检查更新动效 |
| `.style({ enableSmoothEffect: true })` | 进度平滑动效（API 10+） |
| `.style({ content, showDefaultPercentage })` | Capsule 类型文字内容 |

### Badge（信息标记 / 红点角标）

Badge 是信息标记组件，用于在单个组件上附加小红点或数字/文本提醒。

坑：style 中 badgeSize 设为 0，Badge 不显示；没有给子组件设置宽高，Badge 标记不显示；count 写死为字面量，没有绑定 @State，无法动态更新；使用 position 的 Position 类型设置百分比（不支持百分比）。

| API | 说明 |
|-----|------|
| `Badge({ count: number, maxCount?: number, position?, style })` | 根据数字创建标记，count <= 0 时隐藏 |
| `Badge({ value: string, position?, style })` | 根据字符串创建标记，如 'New'、'Hot' |
| `BadgePosition.RightTop` | 标记显示在右上角（默认值） |
| `BadgePosition.Right` | 标记显示在右侧纵向居中 |
| `BadgePosition.Left` | 标记显示在左侧纵向居中 |
| `style.color` | 文本颜色，默认 Color.White |
| `style.fontSize` | 文本大小，默认 10vp |
| `style.badgeSize` | Badge 大小，默认 16vp |
| `style.badgeColor` | Badge 背景色，默认 Color.Red |
| `style.fontWeight` | 文本字体粗细（API 10+） |
| `style.borderColor` | 底板描边颜色（API 10+） |
| `style.borderWidth` | 底板描边粗细（API 10+） |
