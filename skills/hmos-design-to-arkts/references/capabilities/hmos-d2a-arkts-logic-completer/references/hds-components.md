# HDS 组件（hds-components）

按组件名 / 场景词检索本文件，每个组件一节：坑位 + 常用接口表 + 字段与枚举表。标题括号内是设计稿名 / 中文别名，不是 API 名——写代码只用反引号里的真实 API。

> **迁移纪律（先读，5 条）**
> 1. **只改主组件**：`Tabs` → `HdsTabs`、`TabsController` → `HdsTabsController`、`Navigation` → `HdsNavigation`；`TabContent` / `SubTabBarStyle` / `BottomTabBarStyle` / `NavPathStack` 等子组件与类型**永远保持原名**（不存在 `HdsTabContent` / `HdsBottomTabBarStyle` / `HdsNavPathStack`）。
> 2. **导入要跟上**：`HdsXxx` + `HdsXxxController` + `DividerMode` / `ScrollEffectType` 视需求一起从 `@kit.UIDesignKit` import。
> 3. **6.1 新特性默认配**：HdsTabs 三件套（`barOverlap` + `divider(DividerMode.FOLLOW_SCROLL)` + `barFloatingStyle`）、HdsNavigation 双样式（`scrollEffectOpts` + `originalStyle` / `scrollEffectStyle`）是标配，不要让用户自己翻文档。
> 4. **材质 API 归 `hmos-d2a-arkui2hds`**：`systemMaterialEffect` / `hdsMaterial.*` 由该能力统一管理（见 `../hmos-d2a-arkui2hds/references/migration-patterns.md`），本能力不自行生成；官方对外文档没有的 API 一律不输出。
> 5. **重构用开关**：迁移期保留 `USE_HDS_COMPONENTS` 开关走两个 `@Builder`，先 A/B 再收敛。

> **HdsX vs X 选型**：`HdsTabs` / `HdsNavigation` 继承自原生组件，原生 API 全部生效，问题是"要不要 HDS 6.1 新能力"而不是二选一。**P0 硬约束**：设备最低 API < 20 或要适配 TV → 只能原生（HDS 组件起始 API 20 / HarmonyOS 6.0，不支持 TV）。**P1 视觉**：分割线跟手渐变（`DividerMode.FOLLOW_SCROLL` + `HdsTabsController.bindScroller`）、TabBar 渐变模糊 / 半屏居中 / 出血图标 → `HdsTabs`；动态模糊标题栏、双样式切换 → `HdsNavigation`（配 `HdsNavDestination` 的 `titleBar` / `toolBar` 精细控制）。其余（默认、简单业务页、不引 Kit 依赖）选原生，零依赖最稳。

### HdsNavigation（HDS 路由导航根容器）

HdsNavigation 是 HDS 路由导航的根视图容器，一般作为 Page 页面的根容器使用，内部默认包含**标题栏 + 内容区 + 工具栏**三段区域。

坑：缺少 NavPathStack，路由能力失效；@State 用联合字面量而非枚举（编译报错）；直接对 menu 对象展开（arkts-no-spread）；bindToScrollable 的 scroller 必须与内部 Scroll 实际控制器一致，否则动效不生效；titleMode 为 MODAL 时还配 dynamicHideTitleBar（配置被静默忽略）；menu.badge.count 为负数（不显示标记，容易让调用方误以为功能坏了）。

#### 构造与基础属性

| API | 说明 |
|-----|------|
| `HdsNavigation(pathInfos?: NavPathStack)` | 创建导航根容器，`pathInfos` 为路由栈；不传则无法使用声明式路由 |
| `.titleBar(options?: HdsNavigationTitleBarOptions)` | 配置标题栏的 padding / style / content |
| `.titleMode(value: HdsNavigationTitleMode)` | 标题模式：FREE / FULL / MINI / MODAL，默认 FREE |
| `.toolbarConfiguration(value, options?)` | 底部工具栏（ToolbarItem 数组或 CustomBuilder）|
| `.hideTitleBar(hide, animated?)` | 隐藏标题栏，可配动画 |
| `.hideToolBar(hide, animated?)` | 隐藏工具栏 |
| `.hideBackButton(value)` | 仅 `HdsNavigationTitleMode.MINI` 下生效 |
| `.hideNavBar(value)` | 隐藏整个导航栏（连同内容区占位）|
| `.mode(value: NavigationMode)` | Stack / Split / Auto；默认 Auto |
| `.navBarWidth(value)` / `.navBarWidthRange(...)` / `.minContentWidth(...)` | 分栏布局相关（API 18）|

#### 滚动联动与样式（API 20+）

| API | 说明 |
|-----|------|
| `.bindToScrollable(scrollers: Array<Scroller>)` | 绑定内容滚动容器，标题栏联动显隐与模糊（API 20）|
| `.bindToNestedScrollable(scrollers: Array<NestedScrollInfo>)` | 嵌套滚动场景下的绑定（API 20）|
| `.dynamicHideTitleBar(value: DynamicHideParams)` | 标题栏动态隐藏，支持 SCROLL_UP / SCROLL_UP_TO / SCROLL_DOWN 等模式（API 20）|
| `.enableDragBar(isEnabled)` | 分栏场景拖拽条开关（API 20）|
| `.enableModeChangeAnimation(isEnabled)` | 单双栏切换动效开关（API 20）|
| `.systemBarStyle(original, scrollEffect)` | 配合滚动的状态栏样式（API 18）|
| `.recoverable(value)` | 页面栈可恢复（需配合 `.id()`）（API 18）|
| `.customNavContentTransition(delegate)` | 自定义转场动画（API 20）|
| `.navDestination(builder)` | 根据 name 构造 HdsNavDestination（API 18）|

#### 事件

| API | 说明 |
|-----|------|
| `.onNavBarStateChange(callback: Callback<boolean>)` | 导航栏显隐回调 |
| `.onNavigationModeChange(callback: Callback<NavigationMode>)` | 单双栏切换回调 |
| `.onTitleModeChange(callback: Callback<HdsNavigationTitleMode>)` | 仅在 FREE 模式下，标题从 FULL→MINI 的回调（API 20）|

#### 关键枚举

| 枚举 | 取值 | 典型场景 |
|------|------|--------|
| `HdsNavigationTitleMode` | FREE / FULL / MINI / MODAL | 列表页用 FREE；一级页面用 FULL；子页用 MINI；卡片浮层用 MODAL |
| `ScrollEffectType` | COMMON_BLUR / GRADUAL_BLUR / GRADIENT_BLUR / IMMERSIVE_GRADIENT_BLUR | 通用 / 过渡 / 渐变 / 沉浸式渐变模糊；跨能力统一用 IMMERSIVE_GRADIENT_BLUR |
| `HideMode` | SCROLL_UP / SCROLL_UP_TO / SCROLL_DOWN / SCROLL_UP_TO_BLEND_SCROLL_UP | 动态隐藏策略 |

> **迁移提示**：从 `Navigation` 平替到 `HdsNavigation` 通常只需换组件名和导入源（`@kit.UIDesignKit`），路由栈、NavPathStack、子组件 HdsNavDestination 的用法保持一致；但要注意 `toolbarConfiguration` 下 `SymbolGlyphModifier` 不支持 `fontSize` / `effectStrategy` / `symbolEffect` 属性修改图标大小/动效。

### HdsNavDestination（HDS 子页根容器）

HdsNavDestination 是子页面的根容器,承担"页面级"职责。

坑：在 HdsNavDestination 上直接设置布局属性(会让动态模糊/标题栏高度异常)；在 onShown 里做重初始化 —— onShown 每次 push/pop 回到页面都会触发；用联合字面量当 titleMode —— ArkTS @State 不支持联合字面量；直接在 @Entry 页面里写 HdsNavDestination —— 会报"必须作为 HdsNavigation 的；systemBarStyle 只传一个参数(滚动生效后状态栏会看不清)。

| 属性/事件 | 类型签名 | 起始版本 | 说明 |
|----------|---------|---------|------|
| `titleBar` | `(options?: HdsNavigationTitleBarOptions)` | 5.1.0 | 页面级标题栏(完整选项见本文件 HdsNavigation 节) |
| `hideTitleBar` | `(hide: boolean, animated?: boolean)` | 5.1.0 | 显隐标题栏 |
| `hideBackButton` | `(value: boolean)` | 5.1.0 | 返回键显隐 |
| `mode` | `(value: NavDestinationMode)` | 5.1.0 | STANDARD / DIALOG |
| `titleMode` | `(value: HdsNavDestinationTitleMode)` | 6.0.0 | MINI(100) / MODAL(101) |
| `toolbarConfiguration` | `(items: Array<ToolbarItem> \| CustomBuilder, opts?)` | 5.1.0 | 底部工具栏 |
| `hideToolBar` | `(hide: boolean, animated?: boolean)` | 5.1.0 | 显隐工具栏 |
| `ignoreLayoutSafeArea` | `(types?: Array<LayoutSafeAreaType>, edges?: Array<LayoutSafeAreaEdge>)` | 5.1.0 | 扩展到非安全区 |
| `systemBarStyle` | `(originalStyle, scrollEffectStyle)` | 5.1.0 | 状态栏样式,两参必填 |
| `recoverable` | `(recoverable: Optional<boolean>)` | 5.1.0 | 冷启动恢复 |
| `dynamicHideTitleBar` | `(value: DynamicHideParams)` | 6.0.0 | 滚动动态显隐,需配 bindToScrollable |
| `bindToScrollable` | `(scrollers: Array<Scroller>)` | 6.0.0 | 绑定可滚动容器 |
| `bindToNestedScrollable` | `(scrollers: Array<NestedScrollInfo>)` | 6.0.0 | 绑定嵌套滚动 |
| `systemTransition` | `(type: NavigationSystemTransitionType)` | 6.0.0 | 系统转场 |
| `customTransition` | `(delegate: NavDestinationTransitionDelegate)` | 6.0.0 | 自定义转场 |
| `onShown` / `onHidden` | `Callback<void>` | 5.1.0 | 显/隐回调(会多次触发) |
| `onReady` | `Callback<NavDestinationContext>` | 5.1.0 | 构建前,只触发一次,读路由参数用 |
| `onWillAppear` / `onWillDisappear` | `Callback<void>` | 5.1.0 | 挂载/卸载前 |
| `onWillShow` / `onWillHide` | `Callback<void>` | 5.1.0 | 显隐前 |
| `onBackPressed` | `Callback<void, boolean>` | 6.0.0 | 返回 true 拦截 |
| `onActive` / `onInactive` | `Optional<Callback<NavDestinationActiveReason>>` | 6.0.1 | 激活/失活(弹窗遮挡触发 inactive) |

#### 字段与枚举（含默认值）

- `HdsNavigationTitleBarOptions`:和 HdsNavigation 的 `titleBar` 同一类型,见本文件 HdsNavigation 节的"字段与枚举"表。
- `NavDestinationMode`(枚举,来自 `@ohos.arkui`):
  - `STANDARD`(默认):标准模式。
  - `DIALOG`:对话框模式,透明背景,不压栈。
- `HdsNavDestinationTitleMode`(枚举,API 20+):
  - `MINI = 100`:标题栏 56vp,动态显隐生效。
  - `MODAL = 101`:半模态,背板 64vp,上 padding 8vp,**不支持动态显隐**。
- `NavDestinationActiveReason`:`TRANSITION` / `CONTENT_COVER` / `SHEET` / `DIALOG` / 等,用于区分是"切页"导致的 inactive 还是"弹窗遮挡"。
- `NavigationSystemTransitionType`:`DEFAULT` / `NONE` / `TITLE` / `CONTENT` / `FADE` / `EXPLODE` / `SLIDE_RIGHT` / `SLIDE_BOTTOM`。

### HdsTabs（HDS 页签容器：跟手分割线 / 动态模糊）

HdsTabs 是 HDS 版本的 Tabs 容器，通常作为 Page 根容器或大区块容器使用。

坑：仍在用原生 TabsController（和 HdsTabs 不兼容，编译报错或运行时异常）；把 TabContent 改成 "HdsTabContent"（没有这个组件）；@State 用联合字面量；忘了 bindScroller，导致分割线 FOLLOW_SCROLL 不跟手；barOverlap 未开就想看渐变模糊（barBackgroundStyle 不生效）；HALF_SCREEN_FIXED 用在横向 Tabs（规则要求 vertical(true) 且 BottomTabB。

#### 构造与控制器

| API | 说明 |
|-----|------|
| `HdsTabs(options?: HdsTabsOptions)` | 创建容器；`options.controller` 传 `HdsTabsController` |
| `HdsTabsController()` | 控制器，继承自 `TabsController`，`.changeIndex(i)` 切换页签 |
| `controller.bindScroller(index, scroller, parentScroller?)` | 绑定内容区滚动器，让 TabBar 感知滚动（API 20）|
| `controller.unbindScroller(scroller)` | 解绑（一般在 `aboutToDisappear`）|

#### 布局与样式

| API | 说明 |
|-----|------|
| `.vertical(boolean)` | 横向/纵向 TabBar，默认 false |
| `.barPosition(BarPosition)` | `Start` 顶部（默认）/ `End` 底部 |
| `.scrollable(boolean)` | 是否允许滑动切换，默认 true |
| `.barWidth(Length)` / `.barHeight(Length)` | TabBar 尺寸 |
| `.animationDuration(number)` | 切换动画时长 ms，`BottomTabBarStyle` 下默认 0 |
| `.barOverlap(boolean)` | TabBar 是否浮在 TabContent 之上并模糊 |
| `.barBackgroundColor(ResourceColor)` | TabBar 底色 |
| `.barBackgroundBlurStyle(BlurStyle, options?)` | TabBar 背景模糊 |
| `.barBackgroundEffect(BackgroundEffectOptions)` | 更精细的背景效果（模糊半径/亮度/饱和度）|
| `.barMode(HdsBarMode, options?)` | `BarMode.Fixed / Scrollable` 或 `ExtendBarMode.HALF_SCREEN_FIXED` |
| `.divider(Optional<HdsDividerStyle>)` | 分割线样式 `{ mode, style }` |
| `.barBackgroundStyle(Optional<HdsTabsBackgroundStyle>)` | 渐变模糊 `{ maskColor, maskHeight }`（需配合 barOverlap + barPosition.End）|
| `.blurStrategy(BlurStrategy)` | 模糊策略 ADAPTIVE/ENABLE/DISABLE |

#### 事件

| API | 说明 |
|-----|------|
| `.onChange(Callback<number>)` | 切换后触发，参数为新 index |
| `.onTabBarClick(Callback<number>)` | TabBar 点击（不含滑动）|
| `.onAnimationStart(OnTabsAnimationStartCallback)` | 切换动画开始 |
| `.onAnimationEnd(...)` | 结束回调（继承自 Tabs）|
| `.onContentWillChange(OnTabsContentWillChangeCallback)` | 即将切换，返回 false 可拦截 |

#### 关键枚举

| 枚举 | 取值 | 典型场景 |
|------|------|--------|
| `DividerMode` | VISIBLE / NONE / FOLLOW_SCROLL | 分割线三种行为，默认 FOLLOW_SCROLL |
| `ExtendBarMode` | HALF_SCREEN_FIXED (100) | 侧边栏半屏居中（需 vertical + BottomTabBarStyle）|
| `HdsBarMode` | `ExtendBarMode \| BarMode` | `barMode` 参数类型 |

#### 出血图标与自定义 TabBar

| API | 说明 |
|-----|------|
| `.tabBar(new BottomTabBarStyle(icon, text))` | 官方底部样式，无需自写 @Builder |
| `.tabBar(new SubTabBarStyle(text))` | 顶部样式 |
| `.tabBar(bleedIconStyle((): void => this.builder()))` | 出血图标（@Builder 出血效果）|

> **迁移要点**：
> 1. `Tabs` → `HdsTabs`、`TabsController` → `HdsTabsController`、子组件 `TabContent` 保持不变；
> 2. 导入改为 `'@kit.UIDesignKit'`；使用图标必须额外从 `'@kit.ArkUI'` 导入 `SymbolGlyphModifier`；
> 3. `BottomTabBarStyle` / `SubTabBarStyle` 不要改名；
> 4. 如果用到分割线跟手或渐变模糊，必须在 `aboutToAppear` 里 `bindScroller`。

### HdsActionBar（HDS 圆形按钮操作栏）

一组圆形按钮的操作区容器,由 4 部分组成。

坑：`primaryButtonBuilder` 与 `primaryButton` 二选一，同设时 builder 优先级更高，但必须同步给 `primaryButtonBuilderWidth`，否则布局异常；`$isExpand` 仅做回写（命名以 `$` 开头、与 `isExpand` 成对），业务逻辑写在 `onClick` 里。

#### HdsActionBar 构造参数

| 参数 | 类型 | 装饰器 | 默认 | 说明 |
|------|------|--------|------|------|
| `primaryButton` | `ActionBarButton` | `@Param` | — | 主按钮 |
| `primaryButtonBuilder` | `CustomBuilder` | `@BuilderParam` | — | 自定义主按钮,优先级高于 primaryButton |
| `primaryButtonBuilderWidth` | `LengthMetrics` | `@Param` | — | primaryButtonBuilder 启用时必填 |
| `startButtons` | `Array<ActionBarButton>` | `@Param` | — | 起始位置按钮组 |
| `endButtons` | `Array<ActionBarButton>` | `@Param` | — | 终止位置按钮组 |
| `actionBarStyle` | `ActionBarStyle` | `@Param` | — | 样式对象 |
| `isExpand` | `boolean` | `@Param` | `false` | 展开状态 |
| `$isExpand` | `Callback<boolean>` | `@Event` | — | 展开状态回写 |
| `blurStrategy` | `BlurStrategy` | `@Param` | `ADAPTIVE` | 模糊策略 |

#### ActionBarButton 构造器（字段见下方"字段与枚举"表）

#### ActionBarStyle 构造器（字段见下方"字段与枚举"表）

**快速记忆**:`new ActionBarButton({...})` + `new ActionBarStyle({...})` + `@ComponentV2` + `@Local` + `$isExpand` 双向 = 跑通 HdsActionBar 的 5 件事。

#### 字段与枚举（含默认值）

##### ActionBarButton 核心字段

| 字段 | 类型 | 说明 |
|------|------|------|
| `baseIcon` | `ResourceStr` | 初始图标(非主按钮时,即它的固定图标) |
| `altIcon` | `ResourceStr` | 切换后图标,**仅主按钮生效** |
| `width` | `LengthMetrics` | 圆形按钮宽度,不支持 percent |
| `backgroundColor` | `ColorMetrics` | 按钮背景 |
| `iconFillColor` | `ColorMetrics` | 图标颜色 |
| `iconSize` | `LengthMetrics` | 图标大小 |
| `shadowStyle` | `ShadowOptions \| ShadowStyle` | 默认 `ShadowStyle.OUTER_DEFAULT_LG` |
| `enabled` | `boolean` | 单按钮是否可用 |
| `onClick` | `Callback<void>` | 点击回调 |
| `hoverTips` | `ResourceStr` | 鼠标悬浮提示文字(PC/平板) |
| `accessibilityText` / `accessibilityDescription` / `accessibilityLevel` | — | 无障碍三件套 |
| `id` | `string` | 走焦 id,也用于 `promptAction.openPopup` 绑定 |

##### ActionBarStyle 核心字段

| 字段 | 默认值 | 说明 |
|------|-------|------|
| `height` | — | 背板高度 |
| `backgroundColor` | — | 背板背景色 |
| `backgroundBlurStyle` | `BlurStyle.COMPONENT_REGULAR` | 背板模糊 |
| `innerSpace` | — | 主按钮与 start/end 按钮间距 |
| `startSpace` / `endSpace` | — | start/end 按钮到背板边框的距离 |
| `enabled` | `true` | false 会让**所有**按钮禁用 |
| `isHorizontal` | `true` | false 竖排 |
| `isPrimaryIconChanged` | `false` | true 显示 altIcon |

##### BlurStrategy(来自 HdsNavigation)

`ADAPTIVE`(默认,根据系统主题自适应) / `ALWAYS_ON` / `ALWAYS_OFF`。

### HdsSideBar（HDS 侧边栏，含 HdsSideMenu 菜单栏）

支持显示/隐藏的侧边栏容器,**左右分栏**。

坑：`autoHide = true`（默认）时分割线拖到 `minSideBarWidth` 以下会自动隐藏并触发 `onChange(false)`；`sideBarContainerType = Overlay` + `contentAreaMask = true` 时点击蒙层触发收起。

> 下列参数 / 事件完全对齐华为官方原文参数表(`华为官方文档` 第 28-45 行),**没有额外接口**。完整默认值和说明见下方"字段与枚举"表。

#### 构造 & 高频参数

| API / 参数 | 类型 / 默认值 | 说明 |
|-----------|--------------|------|
| `HdsSideBar({ ... })` | 构造接口,返回值 `void` | 必须是 `@ComponentV2` 里调用,15 个参数见官方接口签名 |
| `isShowSideBar` | `boolean`,默认 `true` | 是否显示侧边栏(`@Param`,常与 `$isShowSideBar` 组成双向绑定) |
| `$isShowSideBar` | `Callback<boolean>`(`@Event`) | 内置控制按钮点击后的回写回调,**官方示例用 `!v` 取反回写** |
| `sideBarContainerType` | `SideBarContainerType`,默认 `AUTO` | 显示类型:`AUTO` / `Embed` / `Overlay`(参数名与类型名都要写对) |
| `sideBarPosition` | `SideBarPosition`,默认 `Start` | 侧边栏位置:`Start`(左) / `End`(右) |

#### Builder 插槽(必填)

| 构造器属性 | 类型 | 必填 | 说明 |
|-----------|------|:---:|------|
| `sideBarPanelBuilder` | `CustomBuilder` (`@Require @BuilderParam`) | ✅ | 侧栏内容构造器,通常放 `HdsSideMenu` / `List` |
| `contentPanelBuilder` | `CustomBuilder` (`@Require @BuilderParam`) | ✅ | 主内容构造器,通常放 `Navigation + NavPathStack` |

#### 事件 / 回调

| 事件 | 类型 | 触发时机 |
|------|------|--------|
| `onChange` | `Callback<boolean>`(`@Param`) | 显/隐切换时触发,三种来源:属性值变化 / 自适应行为 / 拖拽触发 autoHide |
| `$isShowSideBar` | `Callback<boolean>`(`@Event`) | 组件自带控制按钮点击后回调,示例用 `!v` 回写以维持双向绑定 |

#### 字段与枚举（含默认值）

| 参数 | 类型 | 默认 | 必填 | 说明 |
|------|------|-----|------|-----|
| `minSideBarWidth` | `Length` | `200vp` | 否 | 侧边栏最小宽度 |
| `maxSideBarWidth` | `Length` | `280vp` | 否 | 侧边栏最大宽度 |
| `sideBarWidth` | `Length` | `240vp` | 否 | 初始宽度 |
| `minContentWidth` | `Length` | `360vp` | 否 | 内容区最小显示宽度 |
| `sideBarColor` | `ResourceColor` | `Transparent` | 否 | 侧边栏背景色 |
| `contentColor` | `ResourceColor` | `Transparent` | 否 | 内容区背景色 |
| `autoHide` | `boolean` | `true` | 否 | 拖到最小宽度以下自动隐藏 |
| `isSideBarBlur` | `boolean` | `true` | 否 | 获焦时侧边栏是否模糊 |
| `contentAreaMask` | `boolean` | `true` | 否 | 悬浮场景下内容区是否加蒙层 |

**要点**：
- V2 组件 → `@ComponentV2` + `@Local`(不是 `@State`)
- 两个 Panel → 都走 `@BuilderParam` 中转
- 参数名是 `sideBarContainerType`(小驼峰),类型名是 `SideBarContainerType`(大驼峰),**都不叫 `type` / `HdsSideBarContainerType`**
- 只有一个事件叫 `onChange`,**没有 `onDragStart` / `onDragReleased`;没有 `barMaxNum`**(这些在上一轮补表时被误加,已删除)

#### HdsSideMenu（HDS 侧边菜单栏，两级菜单 + 角标）

菜单栏样式组件,支持两级菜单 + 角标。

| 名称 | 类型 | 说明 |
|------|------|------|
| `HdsSideMenu` | `@ComponentV2` | 根组件 |
| `HdsSideMenuMainItem` | `@ObservedV2` class | 一级菜单实例,`new HdsSideMenuMainItem(param)` |
| `HdsSideMenuSubItem` | `@ObservedV2` class | 二级菜单实例 |
| `HdsSideMenuMainItem.getSideMenuSubItem()` | `(): HdsSideMenuSubItem[]` | 获取当前项下二级菜单 |
| `HdsSideMenuMainItem.updateBadge(badge?)` | `(b?: HdsSideMenuBadgeParam): HdsSideMenuMainItem` | 动态更新角标 |
| `HdsSideMenuSubItem.updateBadge(badge?)` | 同上 | 二级角标动态更新 |
| `HdsSideMenuBadgeParam` | `{ count?: number; value?: string }` | count=0 不显示;1 小红点;>99 显示 "99+" |
| `OnSelectedIndexChange` | `(selectedIndex: number) => void` | 选中回调 |
| `selectedIndex` | `number` | 必填,>= -1 |
| `maxItemTextLines` | `number` | 默认 1 |

##### 字段与枚举（含默认值）

###### HdsSideMenu 构造参数

| 参数 | 类型 | 装饰器 | 必填 | 说明 |
|------|------|--------|------|------|
| `items` | `HdsSideMenuMainItem[]` | `@Param` | 否 | 最多 5 项 |
| `$selectedIndex` | `OnSelectedIndexChange` | `@Event` | 否 | 选中变化回调 |

###### HdsSideMenuMainItemParam(一级菜单构造参数)

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `itemId` | `string` | 否 | 菜单 id(无障碍用) |
| `label` | `ResourceStr` | 否 | 菜单文字 |
| `action` | `Callback<void>` | 否 | 点击回调 |
| `icon` | `ResourceStr` | 否 | 一级图标(**优先级高于 symbol**) |
| `symbol` | `SymbolGlyphModifier` | 否 | 一级图标(SymbolGlyph 方式) |
| `hdsSideMenuSubItem` | `HdsSideMenuSubItem[]` | 否 | 二级菜单,最多 5 项 |
| `badge` | `HdsSideMenuBadgeParam` | 否 | 角标 |

###### HdsSideMenuSubItemParam(二级菜单)

继承 `HdsSideMenuBaseItemParam`(itemId/label/action) + `badge`。二级菜单**没有图标**。

###### HdsSideMenuBadgeParam

| 字段 | 类型 | 说明 |
|------|------|------|
| `count` | `number` | 0 不显示;1 显示小圆点("·");>99 显示 "99+";负数不支持 |
| `value` | `string` | 文本角标,超长换行 |

###### OnSelectedIndexChange

`type OnSelectedIndexChange = (selectedIndex: number) => void`



### HdsSnackBar（HDS 简短通知）

简短通知的**非模态**弹窗。

坑：`duration` 默认 5000ms，≤ 0 常驻、必须用户点击或 `dismiss()` 才关闭；多个 SnackBar 不要同时弹，`show()` 前先 `dismiss()` 上一个；`show()` 是命令式 API，不要放 `build()` / `@Builder` 里；`TEXT_WITH_ARROW` 点击热区是整个 SnackBar，不要再设 `onContentClick`。

| 符号 | 签名/类型 | 说明 |
|------|----------|------|
| `HdsSnackBar` | `class` | 通过 `new HdsSnackBar(uiContext)` 构造 |
| `.show(icon, message, operation, style?)` | `void` | 弹出 |
| `.dismiss()` | `void` | 主动关闭 |
| `SnackBarOperationType` | enum | TEXT_ONLY(0) / CLOSE_BUTTON_ONLY(1) / TEXT_WITH_ARROW(2) / TEXT_WITH_CLOSE(3) / HIGHLIGHT_TEXT_WITH_CLOSE(4) |
| `SnackBarIconType` | enum | SMALL(0) / NORMAL(1) |
| `duration` | `number` | ms,<=0 常驻,默认 5000 |
| `pressBackCallback` | `Callback<void>` | 左滑/返回拦截 |
| `textButtonId / cancelButtonId / arrowButtonId` | `string` | 走焦 id |

#### 字段与枚举（含默认值）

##### SnackBarIconOptions

| 字段 | 类型 | 说明 |
|------|------|------|
| `icon` | `ResourceStr` | 图标资源,支持 SymbolGlyph 和 Image |
| `iconType` | `SnackBarIconType` | `SMALL=0`(默认) / `NORMAL=1` |
| `iconModifier` | `ImageModifier` | Image 样式修饰 |
| `iconSymbolModifier` | `SymbolGlyphModifier` | SymbolGlyph 样式修饰(示例见下) |

**`iconSymbolModifier` 典型构造**(链式调用,**同一个** `SymbolGlyphModifier` 实例上可叠加 `fontSize` / `fontColor` / `renderingStrategy` 等):

> 构造样板来源:`华为官方文档` 第 172-176 行(HDS 开发人员版)。`SymbolGlyphModifier` **不是**从 `@kit.UIDesignKit` 导入,而是从 `@kit.ArkUI`。

##### SnackBarMessageOptions

| 字段 | 类型 | 说明 |
|------|------|------|
| `title` | `ResourceStr` | 标题 |
| `titleColor` | `ColorMetrics` | 标题色 |
| `content` | `ResourceStr` | 内容文本 |
| `contentColor` | `ColorMetrics` | 内容色 |

##### SnackBarOperationOptions(根据 operationType 选择字段)

| 字段 | 类型 | 生效条件 |
|------|------|---------|
| `operationType` | `SnackBarOperationType` | 必填 |
| `content` | `ResourceStr` | `TEXT_*`、`HIGHLIGHT_*`  时用作按钮文字 |
| `contentColor` | `ColorMetrics` | 同上 |
| `onContentClick` | `Callback<void>` | `TEXT_WITH_ARROW` 时热区是整个 SnackBar，无需另设 |
| `onCloseButtonClick` | `Callback<void>` | `CLOSE_*`、`TEXT_WITH_CLOSE`、`HIGHLIGHT_*` |
| `onArrowClick` | `Callback<void>` | `TEXT_WITH_ARROW` 专用 |
| `arrowColor` | `ColorMetrics[]` | 仅 `TEXT_WITH_ARROW` |
| `highlightBackBoardColor` | `ColorMetrics` | 仅 `HIGHLIGHT_TEXT_WITH_CLOSE` |
| `textButtonId` / `cancelButtonId` / `arrowButtonId` | `string` | 走焦 id |
| `contentAccessibilityText` / `closeButtonAccessibilityText` + Description | — | 无障碍 |

##### SnackBarStyleOptions

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `width` | `LengthMetrics` | — | — |
| `backgroundColor` | `ColorMetrics` | — | — |
| `backgroundBlurStyle` | `BlurStyle` | — | 背板模糊 |
| `keyboardUpAvoidHeight` / `keyboardDownAvoidHeight` | `LengthMetrics` | — | 键盘避让 |
| `nextFocusId` | `string` | — | 走焦 |
| `theme` / `themeColorMode` | `Theme \| CustomTheme` / `ThemeColorMode` | — | 主题 |
| `blurStrategy` | `BlurStrategy` | `ADAPTIVE` | 模糊策略(见 HdsNavigation) |

##### 枚举

- `SnackBarOperationType`:`TEXT_ONLY=0` / `CLOSE_BUTTON_ONLY=1` / `TEXT_WITH_ARROW=2` / `TEXT_WITH_CLOSE=3` / `HIGHLIGHT_TEXT_WITH_CLOSE=4`
- `SnackBarIconType`:`SMALL=0` / `NORMAL=1`

### HdsListItem（HDS 列表单项，含 HdsListItemCard 卡片模式）

列表单项容器。

坑：必须在 `List` 内使用，通常配 `LazyForEach` + `IDataSource`；同时做纵向滚动 + 横滑注意手势冲突（默认已处理）。

| 符号 | 类型/签名 | 说明 |
|------|---------|------|
| `HdsListItem` | `@Component` | V1 装饰器,必须在 List 内 |
| `customItemBuilder` | `CustomBuilder` | 自定义项,优先级最高 |
| `hdsListItemCard` | `HdsListItemCardOptions` | HDS 规范三区,见下方 HdsListItemCard 节 |
| `swipeActionOptions` | `HdsSwipeActionOptions \| SwipeActionOptions` | 横滑操作 |
| `listItemModifier` | `ListItemModifier` | API 21+ |
| `SwipeActionCallback` | `() => void` | 横滑回调签名 |
| `SwipeIconType` | `SymbolGlyphModifier \| ImageOptions` | 图标类型联合 |
| `icons.length` | `<= 3` | 普通按钮数量上限 |
| `fullDeleteOptions.isFullDelete` | `boolean` | 默认 false |

#### 字段与枚举（含默认值）

##### HdsListItem 构造参数

| 参数 | 类型 | 装饰器 | 必填 | 说明 |
|------|------|--------|------|------|

##### HdsSwipeActionOptions

| 字段 | 类型 | 说明 |
|------|------|------|
| `icons` | `Array<SwipeIconConfigurations>` | 普通按钮,最多 3 个 |
| `deleteIconOptions` | `DeleteIconOptions` | 删除按钮 |
| `fullDeleteOptions` | `FullDeleteOptions` | 全删配置 |

##### SwipeIconConfigurations

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `icon` | `SwipeIconType` | **是** | `SymbolGlyphModifier \| ImageOptions` |
| `iconOptions` | `IconOptions` | 否 | 可用性/无障碍 |
| `backgroundColor` | `ResourceColor` | 否 | 背景 |
| `onAction` | `SwipeActionCallback` | 否 | 点击回调 |

##### DeleteIconOptions

| 字段 | 类型 | 说明 |
|------|------|------|
| `backgroundColor` | `ResourceColor` | 按钮背景 |
| `iconColor` | `ResourceColor` | 图标颜色 |
| `iconOptions` | `IconOptions` | 可用性/无障碍 |
| `onAction` | `SwipeActionCallback` | 手动点击回调 |

##### FullDeleteOptions

| 字段 | 类型 | 默认 | 说明 |
|------|------|-----|------|
| `isFullDelete` | `boolean` | `false` | 是否启用"滑过阈值自动删除" |
| `onFullDeleteAction` | `SwipeActionCallback` | — | 自动删除时触发 |

##### IconOptions

| 字段 | 类型 | 默认 | 说明 |
|------|------|-----|------|
| `enable` | `boolean` | `true` | 是否可点击 |
| `accessibilityText` / `accessibilityDescription` / `accessibilityLevel` | — | — | 无障碍三件套 |

#### HdsListItemCard（HDS 规范列表卡片，三区结构）

HDS 规范的列表卡片。

| 符号 | 说明 |
|------|------|
| `HdsListItemCard(options: HdsListItemCardOptions)` | 根组件 |
| `HdsListItemCardOptions` | 顶层配置(三区 + 布局 + 点击 + 无障碍) |
| `PrefixItem` 子类 | PrefixImage / PrefixIcon / PrefixBadge / PrefixSwitch / PrefixToggleButton / PrefixRadio / PrefixCheckbox / PrefixCustom |
| `SuffixItem` 子类 | SuffixIcon / SuffixArrow / SuffixSwitch / SuffixToggleButton / SuffixRadio / SuffixCheckbox / SuffixTextAndArrow / SuffixBadgeAndArrow / SuffixCustom |
| `TextItemOptions` | B 区对象,含 `primary/secondary/description` 三行文本 + 每行 4 个 Symbol + `customBuilder` |
| `IconSize` | `PrefixIcon.iconSize` 用枚举 |
| `ImageClickOptions` | A/C 区可点击 Image/Icon 通用参数 |
| `AccessibilityOptions` | 行级无障碍 |
| 点击优先级 | Prefix/Suffix 自身 onClick > 整行 onClick |
| customBuilder 优先级(B区) | customBuilder > primary/secondary/description + 图标 |

##### 字段与枚举（含默认值）

###### HdsListItemCardOptions(**最核心**)

| 字段 | 类型 | 说明 |
|------|------|------|
| `prefixItem` | `PrefixItem` | A 区元素(见下方类列表) |
| `textItem` | `TextItemOptions` | B 区对象(见下方) |
| `suffixItem` | `SuffixItem` | C 区元素(见下方类列表) |
| `onClick` | `OnClickCallback` | 整行点击 |
| `cardHeight` / `cardWidth` | `Dimension` | 不支持 Percentage |
| `cardBackgroundColor` | `ResourceColor` | — |
| `cardBorderRadius` | `Dimension` | — |
| `cardPrefixMargin` / `cardSuffixMargin` | `Dimension` | 距屏幕左/右的边距 |
| `hoverBorderRadius` | `Dimension` | 悬浮态圆角 |
| `enable` | `boolean` | 默认 true |
| `cardId` | `string` | — |
| `accessibilityOptions` | `AccessibilityOptions` | 无障碍 |

###### A 区类(`PrefixItem` 的子类)

| 类 | 构造参数 | 说明 |
|----|---------|------|
| `PrefixImage` | `ImageClickOptions` | 可点击 Image |
| `PrefixIcon` | `PrefixIconOptions` | Icon(支持 IconSize 枚举) |
| `PrefixBadge` | `BadgeOptions` | 徽标 |
| `PrefixSwitch` | `CheckOptions` | 开关 |
| `PrefixToggleButton` | `ToggleButtonOptions` | 切换按钮 |
| `PrefixRadio` | `RadioOptions` | 单选 |
| `PrefixCheckbox` | `CheckboxOptions` | 勾选 |
| `PrefixCustom` | `{ customBuilder: CustomBuilder }` | 完全自定义 |

###### B 区 `TextItemOptions`

`TextOptions` 通常是 `{ text: ResourceStr, modifier?: TextModifier }`。

###### C 区类(`SuffixItem` 的子类)

| 类 | 构造参数 | 说明 |
|----|---------|------|
| `SuffixIcon` | `ImageClickOptions` | 右侧可点 Icon |
| `SuffixArrow` | `ArrowOptions` | 右箭头 |
| `SuffixSwitch` | `CheckOptions` | 开关 |
| `SuffixToggleButton` | `ToggleButtonOptions` | 切换按钮 |
| `SuffixRadio` | `RadioOptions` | 单选 |
| `SuffixCheckbox` | `CheckboxOptions` | 勾选 |
| `SuffixTextAndArrow` | `{ text, arrow }` | 文本 + 箭头 |
| `SuffixBadgeAndArrow` | `BadgeOptions`, `ArrowOptions` | 角标 + 箭头 |
| `SuffixCustom` | `{ customBuilder: CustomBuilder }` | 完全自定义 |

###### 枚举 `IconSize`

用于 `PrefixIcon` 的 `iconSize`,语义化尺寸:`SYSTEM_ICON`、`SMALL_ICON`、`DEFAULT_ICON` 等(具体枚举值请参照官方原文)。



### HdsVisualComponent（HDS 视效组件：双边流光 + 蒙层）

把复杂视效(目前官方只有 1 种场景:"双边流光 + 背景蒙层")封装成一个组件,通过**场景类型枚举 + 控制器**驱动。

坑：`start()` / `stop()` 放 `aboutToAppear` / `aboutToDisappear`，在 `build()` 里 `start()` 会渲染时反复调用；controller 用 `@State` 持有，设成 const 成员会失去响应性（`setSceneParams` 后依赖 `@State` 的重建不生效）。

| 符号 | 签名 | 说明 |
|------|------|------|
| `HdsVisualComponent()` | 构造 | 无参 |
| `.scene(sceneType, controller, cb?, fpsRange?)` | — | 设置视效场景 |
| `HdsSceneController` | class | 控制器 |
| `.start() / .pause() / .resume() / .stop()` | `(): void` | 生命周期 |
| `.setSceneParams(params)` | `(p: SceneParams): HdsSceneController` | 动态更新参数,链式返回自身 |
| `HdsSceneType` | enum | `DUAL_EDGE_FLOW_LIGHT_WITH_BACKGROUND_MASK = 0` |
| `HdsSceneFinishCallback` | `() => void` | 场景结束回调 |
| `SceneParams` | `DualEdgeFlowLightWithMaskParam` | 当前只有 1 种 |
| `DualEdgeFlowLightWithMaskParam` | `{ backgroundMaskColors[], firstEdgeFlowLight, secondEdgeFlowLight }` | 均必填 |
| `ExpectedFrameRateRange` | `{ min, max, expected }` | 帧率 |
| 卡片能力 | 6.0.2(22)+ | 支持 ArkTS 卡片 |

#### 字段与枚举（含默认值）

##### 接口

##### HdsSceneType 枚举

| 名 | 值 | 说明 |
|----|----|------|
| `DUAL_EDGE_FLOW_LIGHT_WITH_BACKGROUND_MASK` | 0 | 自带背景蒙层的双边流光。TV 无效 |

##### HdsSceneFinishCallback

`type HdsSceneFinishCallback = () => void`

##### HdsSceneController API

| 方法 | 签名 | 说明 |
|------|------|------|
| `constructor()` | `HdsSceneController` | 构造 |
| `start()` | `void` | 开始 |
| `pause()` | `void` | 暂停 |
| `resume()` | `void` | 恢复 |
| `stop()` | `void` | 停止 |
| `setSceneParams(params)` | `(params: SceneParams) => HdsSceneController` | 设置/更新参数,返回自身 |

##### SceneParams 联合类型

目前只有一个场景参数类型。

##### DualEdgeFlowLightWithMaskParam

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `backgroundMaskColors` | `Array<ResourceColor>` | 是 | 背景蒙层颜色数组(渐变) |
| `firstEdgeFlowLight` | `hdsEffect.EdgeFlowLightParam` | 是 | 第一条流光参数 |
| `secondEdgeFlowLight` | `hdsEffect.EdgeFlowLightParam` | 是 | 第二条流光参数 |

##### hdsEffect.EdgeFlowLightParam(简明)

常用字段:`startPos`(0~1 或负值,沿边缘起点位置) / `endPos` / `color`。完整字段见官方 `ui-design-hdseffect` 页。

##### hdsEffect.ExpectedFrameRateRange

`{ min: number, max: number, expected: number }`

### MultiWindowEntryInAPP（应用内多窗口入口）

承载**单应用多窗口并行**逻辑。

坑：只能打开本应用内的 `UIAbility`；跨应用打开用 `want` + `startAbility`，不要用这个组件。

| 符号 | 说明 |
|------|------|
| `MultiWindowEntryInAPP(params: MultiWindowEntryInAPPParams)` | 构造 |
| `params.want` | `Want`,必填,需含 bundleName/moduleName/abilityName |
| `params.isShowSubtitle` | `boolean`,默认 false |
| `params.multiWindowEntryInAPPStyle` | 样式对象 |
| `iconOptions` | `{ iconColor, iconWeight, iconSize, backgroundColor }` |
| `subtitleOptions` | `{ modifier: TextModifier }` |
| 点击事件 | **不支持 onClick,可用 onTouch** |
| 尺寸 | **不支持百分比**,用 vp/lpx |
| 无障碍 | **不支持** accessibilityText / accessibilityDescription |
| 支持设备形态 | 双折叠展开、三折叠双/三屏横、平板横屏 |

#### 字段与枚举（含默认值）

##### MultiWindowEntryInAPPParams

| 字段 | 类型 | 必填 | 说明 |
|------|------|------|------|
| `want` | `Want` | **是** | 含 bundleName/moduleName/abilityName |
| `isShowSubtitle` | `boolean` | 否(默认 `false`) | 是否显示默认文本标题 |
| `multiWindowEntryInAPPStyle` | `MultiWindowEntryInAPPStyle` | 否 | 样式定制 |

##### MultiWindowEntryInAPPStyle

| 字段 | 类型 | 说明 |
|------|------|------|

##### MultiWindowEntryInAPPIconOptions

| 字段 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `iconColor` | `ResourceColor` | `$r('sys.color.font_primary')` | 图标颜色 |
| `iconWeight` | `number \| FontWeight \| string` | `400` | 粗细,100-900(100 为步长);支持 `Bold/Medium/Regular` 字符串 |
| `iconSize` | `number \| string \| Resource` | `24 * 24 vp` | 图标尺寸,**不支持百分比** |
| `backgroundColor` | `ResourceColor` | `$r('sys.color.comp_background_tertiary')` | 背景色 |

##### MultiWindowEntryInAPPSubtitleOptions

| 字段 | 类型 | 说明 |
|------|------|------|
| `modifier` | `TextModifier` | 标题文本修饰器 |

