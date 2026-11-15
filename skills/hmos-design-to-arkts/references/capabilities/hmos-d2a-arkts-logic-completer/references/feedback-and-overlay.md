# 反馈与浮层（feedback-and-overlay）

按组件名 / 场景词检索本文件，每个组件一节：坑位 + 常用接口表 + 字段与枚举表。标题括号内是设计稿名 / 中文别名，不是 API 名——写代码只用反引号里的真实 API。

### Dialog（弹出框：AlertDialog / CustomDialog）

Dialog 是弹出框组件，用于在当前页面上方以模态窗口形式展示需要用户关注或确认的信息。

坑：没有在 aboutToDisappear 中置 null，可能导致内存泄漏；在页面构建过程中直接 open()，弹框位置和形状会异常；危险操作直接执行，没有弹出确认弹框；LoadingDialog 没有在 finally 中关闭，请求失败后弹框永远显示；CustomDialog 内使用 @Prop 监听数据变化，应使用 @Link 或 @Consume；在类属性初始化时用模板字符串引用 @State，content 永远是初始值。

| API | 说明 |
|-----|------|
| `CustomDialogController(options)` | 创建自定义弹窗控制器 |
| `.open()` | 显示弹窗 |
| `.close()` | 关闭弹窗 |
| `TipsDialog({...})` | 带图形的提示弹出框（API 10+） |
| `SelectDialog({...})` | 列表选择弹出框（API 10+） |
| `ConfirmDialog({...})` | 信息确认弹出框（API 10+） |
| `AlertDialog({...})` | 操作确认弹出框（API 10+） |
| `LoadingDialog({...})` | 进度加载弹出框（API 10+） |
| `CustomContentDialog({...})` | 自定义内容弹出框（API 12+） |
| `PopoverDialog({...})` | 跟手弹出框（API 14+） |
| `autoCancel: boolean` | 点击遮障层是否关闭弹窗，默认 true |
| `alignment: DialogAlignment` | 弹窗对齐方式，默认 DialogAlignment.Default |
| `offset: Offset` | 弹窗位置偏移 |
| `isModal: boolean` | 是否模态窗口，默认 true（API 11+） |
| `onWillDismiss: Callback<DismissDialogAction>` | 关闭拦截回调（API 12+） |
| `cornerRadius: Dimension \| BorderRadiuses` | 背板圆角，默认 32vp（API 10+） |
| `backgroundColor: ResourceColor` | 背板颜色（API 10+） |

> **注意**：高级 Dialog 组件（TipsDialog 等）需从 `@kit.ArkUI` 导入；CustomDialogController 仅在作为 @CustomDialog struct 的成员变量时有效；页面销毁时务必将 controller 置 null。

### Toast（轻提示，含 SnackBar 消息通知栏）

Toast 是轻量级提示组件，通过 promptAction.showToast() 在屏幕上短暂显示一段文字信息后自动消失。

坑：没有导入 promptAction，直接调用会报错；用 Toast 展示需要用户确认的重要信息；duration 设置过短，用户来不及阅读；连续快速弹出多个 Toast，信息被覆盖；在 showInSubWindow 为 true 的弹窗中使用 Toast。

| API | 说明 |
|-----|------|
| `import { promptAction } from '@kit.ArkUI'` | 导入模块 |
| `promptAction.showToast(options)` | 显示 Toast 提示 |
| `options.message: string \| Resource` | 提示文本内容（必填） |
| `options.duration: number` | 显示时长（ms），范围 [1500, 10000]，默认 1500 |
| `options.bottom: string \| number` | 距离屏幕底部的距离，默认系统自适应 |
| `options.showMode: ToastShowMode` | 显示模式（API 11+） |
| `ToastShowMode.DEFAULT` | 默认模式，显示在应用内 |
| `ToastShowMode.TOP_MOST` | 显示在应用之上 |
| `options.alignment: Alignment` | Toast 对齐方式（API 12+） |
| `options.offset: { dx, dy }` | Toast 位置偏移（API 12+） |
| `UIContext.getPromptAction().showToast(options)` | 推荐的调用方式，通过 UIContext 获取 |
| `options.backgroundColor: ResourceColor` | 背景颜色（API 12+） |
| `options.textColor: ResourceColor` | 文本颜色（API 12+） |
| `options.backgroundBlurStyle: BlurStyle` | 背景模糊效果（API 12+） |

> **注意**：Toast duration 范围为 [1500, 10000]ms，超出范围取边界值。Toast 是非阻塞的轻提示，不适合展示需要用户确认的重要信息。推荐使用 `this.getUIContext().getPromptAction().showToast()` 方式调用。

#### SnackBar（消息通知栏模式，promptAction 实现）

SnackBar 是轻量级消息提示模式，通过 promptAction 的 showToast/openCustomDialog 实现，用于在页面底部或顶部短暂展示操作反馈或提示信息。

坑：duration 设置为 0 或负数，Toast 不会显示或行为异常；在非 UI 线程调用 promptAction，导致崩溃；频繁调用 showToast 导致消息堆叠，用户无法阅读；使用 promptAction 但没有导入模块。

| API | 说明 |
|-----|------|
| `promptAction.showToast({ message, duration?, bottom? })` | 显示 Toast 提示 |
| `this.getUIContext().getPromptAction().showToast(...)` | 通过 UIContext 显示 Toast（推荐） |
| `message: string \| Resource` | 提示文本 |
| `duration: number` | 显示时长（ms），范围 1500-10000 |
| `bottom: number \| string` | 距底部距离 |
| `promptAction.showDialog({ title, message, buttons })` | 显示对话框 |
| `promptAction.openCustomDialog(builder, options)` | 打开自定义弹窗 |
| `DialogAlignment.Bottom / Top / Center` | 弹窗对齐方式 |
| `import { promptAction } from '@kit.ArkUI'` | 导入模块 |


### Menu（菜单，配 bindMenu / bindContextMenu）

Menu 是菜单组件，以垂直列表形式显示操作选项，需配合 bindMenu 或 bindContextMenu 使用。

坑：Menu 单独使用，没有配合 bindMenu / bindContextMenu；bindContextMenu 中嵌套 bindMenu，不支持多级嵌套弹出；菜单项没有 action 回调，点击无效果；在 CustomBuilder 中使用 bindMenu 弹出多级菜单。

| API | 说明 |
|-----|------|
| `Menu()` | 菜单容器，需配合 bindMenu/bindContextMenu |
| `MenuItem({ content, startIcon?, endIcon?, labelInfo?, builder? })` | 菜单项 |
| `MenuItemGroup({ header?, footer? })` | 菜单分组 |
| `.bindMenu(content, options?)` | 点击绑定菜单 |
| `.bindMenu(isShow, content, options?)` | 状态控制菜单显隐（API 11+） |
| `.bindContextMenu(builder, responseType, options?)` | 长按/右键绑定上下文菜单（API 8+） |
| `ResponseType.LongPress` | 长按触发 |
| `ResponseType.RightClick` | 右键触发 |
| `.font(Font)` | Menu 统一设置文本字体（API 10+） |
| `.fontColor(ResourceColor)` | Menu 统一设置文本颜色（API 10+） |
| `.radius(Dimension \| BorderRadiuses)` | Menu 圆角半径（API 10+） |
| `.subMenuExpandingMode(mode)` | 子菜单展开样式（API 12+） |
| `SubMenuExpandingMode.SIDE_EXPAND` | 侧边展开（默认） |
| `SubMenuExpandingMode.EMBEDDED_EXPAND` | 嵌入展开 |
| `SubMenuExpandingMode.STACK_EXPAND` | 堆叠展开 |
| `Placement` | 菜单弹出位置枚举 |

> **注意**：Menu 不支持单独使用，必须配合 bindMenu 或 bindContextMenu。bindContextMenu 仅在子窗中显示。菜单最大宽度受设备栅格限制。

### bindPopup（PopupTip / 气泡提示）

PopupTip 是气泡提示组件，包含通用属性 bindPopup（基础/自定义气泡）和高级组件 Popup（结构化气泡），用于在目标组件附近弹出提示信息或交互内容。

坑：在页面构建时 show 设为 true，气泡位置和形状会异常；没有在 onStateChange 中同步状态，导致状态不一致；CustomPopupOptions 的 builder 中直接使用 position 属性；showInSubWindow 为 true 的气泡中再弹出子窗气泡；高级 Popup 组件没有配合 bindPopup 使用。

| API | 说明 |
|-----|------|
| `.bindPopup(show, PopupOptions)` | 绑定基础文本气泡 |
| `.bindPopup(show, CustomPopupOptions)` | 绑定自定义内容气泡 |
| `PopupOptions.message` | 气泡文本内容 |
| `PopupOptions.primaryButton / secondaryButton` | 气泡按钮 |
| `PopupOptions.placement` | 显示位置（API 10+），默认 Placement.Bottom |
| `PopupOptions.enableArrow` | 是否显示箭头，默认 true（API 10+） |
| `PopupOptions.popupColor` | 气泡颜色（API 11+） |
| `PopupOptions.autoCancel` | 操作时是否自动关闭，默认 true（API 11+） |
| `PopupOptions.mask` | 是否显示遮罩层（API 10+） |
| `PopupOptions.targetSpace` | 气泡与宿主间距，默认 8vp（API 10+） |
| `PopupOptions.onWillDismiss` | 关闭拦截回调（API 12+） |
| `CustomPopupOptions.builder` | 自定义气泡内容 Builder |
| `CustomPopupOptions.focusable` | 气泡是否获焦（API 11+） |
| `Popup({ icon?, title?, message, showClose?, buttons? })` | 高级结构化气泡组件（API 11+） |
| `PopupIconOptions` | 图标配置：image, width, height |
| `PopupTextOptions` | 文本配置：text, fontSize, fontColor, fontWeight |
| `PopupButtonOptions` | 按钮配置：text, action, fontSize, fontColor |
| `onStateChange` | 气泡显隐状态回调 |
| `Placement` | 位置枚举：Top / Bottom / Left / Right 等 |

> **注意**：bindPopup 的 show 不能在页面构建时设为 true。必须在 onStateChange 中同步状态变量。高级 Popup 组件需从 `@kit.ArkUI` 导入，配合 bindPopup 的 builder 使用。

### bindSheet（ModelSheet / ModalSheet 半模态面板）

ModalSheet（半模态页面）通过 bindSheet 属性实现，从底部弹出覆盖部分页面的面板，用于展示详情、筛选表单或确认操作等不需要全屏跳转的场景。

坑：isShow 没用 $$ 双向绑定，拖拽关闭后状态不同步；builder 内容直接写 undefined，半模态无法显示；宿主节点还没挂载就设置 isShow = true，半模态不生效；detents 设置了 FIT_CONTENT 又同时设置了 detentSelection。

| API | 说明 |
|-----|------|
| `.bindSheet(isShow, builder, options?)` | 绑定半模态页面，isShow 支持 $$ 双向绑定 |
| `SheetSize.MEDIUM` | 高度为窗口 60% |
| `SheetSize.LARGE` | 高度接近窗口高度 |
| `SheetSize.FIT_CONTENT` | 高度自适应内容 |
| `options.height` | 半模态高度 |
| `options.detents` | 多挡位高度，最多 3 个 |
| `options.dragBar` | 是否显示拖拽条 |
| `options.showClose` | 是否显示关闭按钮 |
| `options.title` | 标题 `{ title, subtitle? }` |
| `options.preferType` | 弹窗样式：SheetType.BOTTOM / CENTER / POPUP |
| `options.onWillDismiss` | 关闭前拦截回调 |
| `options.onAppear / onDisappear` | 显示/消失回调 |
| `options.maskColor` | 背景蒙层颜色 |
| `options.backgroundColor` | 面板背景色 |

### ToolBar（Toolbar 工具栏 / ActionBar 底部操作栏模式）

本文的 ToolBar = **@ohos.arkui.advanced.ToolBar**（ArkUI 高级组件，从 @kit.ArkUI 导入），对应官方文档 docs/zh-cn/applicatio。

坑：直接用数组字面量而非 new ToolBarOptions()；忘记在 aboutToAppear 中初始化 toolBarList；没有传 controller 参数；禁用态子项设置了 action 但期望能点击；工具栏上设置通用属性；toolBarSymbolOptions 和 icon 同时设置，icon 不生效。

| API | 说明 |
|-----|------|
| `ToolBar({ toolBarList, activateIndex?, controller, dividerModifier?, toolBarModifier? })` | 创建底部工具栏 |
| `ToolBarOptions` | 工具栏选项数组（@Observed，继承 Array），需 `new` 创建后 `push` |
| `ToolBarOption.content` | 子项文本（必填） |
| `ToolBarOption.icon` | 子项图标 |
| `ToolBarOption.action` | 子项点击事件 |
| `ToolBarOption.state` | 子项状态：ItemState.ENABLE / DISABLE / ACTIVATE |
| `ToolBarOption.iconColor` | 图标颜色（API 13+） |
| `ToolBarOption.activatedIconColor` | 激活态图标颜色（API 13+） |
| `ToolBarOption.textColor` | 文本颜色（API 13+） |
| `ToolBarOption.activatedTextColor` | 激活态文本颜色（API 13+） |
| `ToolBarOption.toolBarSymbolOptions` | Symbol 图标配置（API 13+） |
| `activateIndex` | 激活态子项索引，-1 表示无激活 |
| `ToolBarModifier.height(LengthMetrics)` | 工具栏高度，默认 56vp（API 13+） |
| `ToolBarModifier.backgroundColor(ResourceColor)` | 工具栏背景色（API 13+） |
| `ToolBarModifier.padding(LengthMetrics)` | 左右内边距，仅 item < 5 时生效（API 13+） |
| `ToolBarModifier.stateEffect(boolean)` | 是否显示按压态效果（API 13+） |
| `DividerModifier` | 分割线样式修饰器（API 13+） |

> **注意**：ToolBar 底部最多显示 5 个入口，超过自动收纳。ToolBarOptions 需通过 `new ToolBarOptions()` 创建并在 `aboutToAppear` 中 `push` 初始化。不支持通用属性和通用事件，样式通过 ToolBarModifier 定制。该组件仅可在 Stage 模型下使用，需从 `'@kit.ArkUI'` 导入。

#### ActionBar（底部操作栏模式，基于 ToolBar 高级组件）

ActionBar 是底部操作栏模式，基于 ToolBar 高级组件实现，用于在页面底部展示针对当前内容的操作按钮（如确认、取消、删除等），适合需要主/次操作按钮的场景。

坑：直接修改 ToolBarOptions 数组元素而不重建，UI 不刷新；action 回调没有判断 state，禁用按钮仍可执行操作；超过 5 个按钮未做收纳处理，导致"更多"子项自动出现但逻辑未覆盖；使用对象展开运算符（ArkTS 不支持）。

| API | 说明 |
|-----|------|
| `ToolBar({ toolBarList, activateIndex?, controller? })` | 创建底部工具栏，最多显示 5 个按钮 |
| `ToolBarOptions` | 工具栏列表，继承 Array\<ToolBarOption\>，@Observed |
| `ToolBarOption.content` | 按钮文本（ResourceStr） |
| `ToolBarOption.icon` | 按钮图标（Resource） |
| `ToolBarOption.action` | 点击回调 `() => void` |
| `ToolBarOption.state` | 按钮状态：ItemState.ENABLE / DISABLE / ACTIVATE |
| `ToolBarModifier.height(LengthMetrics)` | 自定义工具栏高度（默认 56vp） |
| `ToolBarModifier.backgroundColor(ResourceColor)` | 自定义背景色 |
| `ToolBarModifier.stateEffect(boolean)` | 是否显示按压态效果 |
| `import { ToolBar, ToolBarOptions, ItemState } from '@kit.ArkUI'` | 导入模块 |


### TitleBar（标题栏系列）

TitleBar 是标题栏系列组件，包含三种变体。

坑：ComposeTitleBar 入参传 undefined 会崩溃；EditableTitleBar 没有设置 onSave，点击保存无响应；SelectTitleBar 未设置 options，下拉菜单无内容；在标题栏上设置通用属性，可能不生效；menuItems 的 isEnabled 为 false 却期望点击有响应；SelectTitleBar badgeValue 传负数，标记不显示。

#### ComposeTitleBar

| API | 说明 |
|-----|------|
| `ComposeTitleBar({ title, subtitle?, item?, menuItems? })` | 创建普通标题栏 |
| `title` | 标题（必填） |
| `subtitle` | 副标题 |
| `item` | 左侧头像配置 |
| `menuItems` | 右侧菜单项目数组，每项含 value/isEnabled/action |

#### EditableTitleBar

| API | 说明 |
|-----|------|
| `EditableTitleBar({ leftIconStyle, title, ... })` | 创建编辑型标题栏 |
| `leftIconStyle` | 左侧按钮类型：EditableLeftIconType.Back / Cancel |
| `title` | 标题（必填） |
| `subtitle` | 副标题（API 12+） |
| `imageItem` | 左侧头像（API 12+） |
| `menuItems` | 右侧自定义菜单项 |
| `isSaveIconRequired` | 是否显示右侧保存按钮，默认 true（API 12+） |
| `onSave` | 保存按钮回调 |
| `onCancel` | 左侧按钮（返回/取消）回调 |
| `options` | 标题栏样式（背景色/模糊/安全区域，API 12+） |
| `contentMargin` | 外边距（API 12+） |

#### SelectTitleBar

| API | 说明 |
|-----|------|
| `SelectTitleBar({ selected, options, ... })` | 创建下拉菜单标题栏 |
| `selected` | 当前选中项索引（@Prop） |
| `options` | 下拉菜单项数组 |
| `menuItems` | 右侧菜单项目数组 |
| `subtitle` | 子标题 |
| `badgeValue` | 消息标记数字，≤0 不显示，最大 99 |
| `hidesBackButton` | 是否隐藏返回箭头，默认 false |
| `onSelected` | 选中项回调 |

> **注意**：三种标题栏都不支持通用属性和通用事件。入参不可为 undefined。所有标题栏组件仅可在 Stage 模型下使用，需从 `'@kit.ArkUI'` 导入。

### SubHeader（子标题栏）

SubHeader 是子标题组件，用于列表项或内容项顶部，将列表或内容划分为一个区块，子标题名称用来概括该区块内容。

坑：同时设置 primaryTitle、secondaryTitle、icon，primaryTitle 不生效；没有 secondaryTitle 时设置 icon，icon 不会显示；operationType 为 ICON_GROUP 却配了超过 3 个图标；在 SubHeader 上设置通用属性，可能不生效；没有设置 operationItem 的 action 回调，点击无反应。

| API | 说明 |
|-----|------|
| `SubHeader({ ... })` | 创建子标题组件，需从 `'@kit.ArkUI'` 导入 |
| `primaryTitle` | 主标题文本 |
| `secondaryTitle` | 副标题文本 |
| `icon` | 左侧图标（需配合 secondaryTitle 使用） |
| `iconSymbolOptions` | icon 为 SymbolGlyph 时的样式设置（API 12+） |
| `select` | 左侧下拉选择器配置 |
| `operationType` | 右侧操作区类型：TEXT_ARROW / BUTTON / ICON_GROUP / LOADING |
| `operationItem` | 右侧操作区配置数组 |
| `operationSymbolOptions` | 右侧图标为 SymbolGlyph 时的样式（API 12+） |
| `primaryTitleModifier` | 主标题文本修饰器（API 12+） |
| `secondaryTitleModifier` | 副标题文本修饰器（API 12+） |
| `titleBuilder` | 自定义标题区内容 @Builder（API 12+） |
| `contentMargin` | 子标题外边距（API 12+） |
| `contentPadding` | 子标题内边距（API 12+） |

> **注意**：SubHeader 不支持通用属性和通用事件。当同时使用 primaryTitle + secondaryTitle + icon 时，primaryTitle 不生效。ICON_GROUP 最多支持 3 个图标。该组件仅可在 Stage 模型下使用。
