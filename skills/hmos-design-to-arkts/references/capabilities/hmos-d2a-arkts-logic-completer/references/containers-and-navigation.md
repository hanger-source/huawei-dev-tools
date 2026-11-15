# 容器与导航（containers-and-navigation）

按组件名 / 场景词检索本文件，每个组件一节：坑位 + 常用接口表 + 字段与枚举表。标题括号内是设计稿名 / 中文别名，不是 API 名——写代码只用反引号里的真实 API。

### Navigation（应用主导航容器）

Navigation 是**应用主导航容器**，从 API 8 起支持，API 10+ 起才是"**路由栈驱动**"的现代形态。

坑：路由栈只建一次（`@Provide`），子页 `@Consume` 取用，不要 `new NavPathStack()` 再拿一个；新代码不与 `@ohos.router` 混用（两套路由栈独立，返回键行为错乱）；`navDestination` 的 Builder 每个子页只能一个根节点。

#### 构造

| 接口 | 签名 | 说明 |
|------|------|------|
| `Navigation` | `(pathInfos?: NavPathStack, home?: HomePathInfo)` | 推荐带 `NavPathStack` 形态 |
| `NavPathStack` | `new NavPathStack()` | 路由栈，`@kit.ArkUI` 导出 |
| `NavPathInfo` | `(name, param, onPop?, isEntry?)` | 路由项 |

#### 高频属性

| 属性 | 类型 |
|------|------|
| `title` | `ResourceStr \| NavigationCommonTitle \| NavigationCustomTitle \| CustomBuilder` |
| `titleMode` | `NavigationTitleMode`: `Free` / `Full` / `Mini` |
| `menus` | `Array<NavigationMenuItem> \| CustomBuilder` |
| `toolbarConfiguration` | `Array<ToolbarItem> \| CustomBuilder` |
| `mode` | `NavigationMode`: `Stack` / `Split` / `Auto` |
| `navBarWidth` / `navBarPosition` | `Length` / `NavBarPosition` |
| `hideTitleBar` / `hideToolBar` / `hideNavBar` / `hideBackButton` | `boolean`（第二参 animated） |
| `navDestination` | `(name: string, param: unknown) => void`（Builder） |
| `systemBarStyle` | `Optional<SystemBarStyle>` |

#### 核心事件

| 事件 | 签名 | 说明 |
|------|------|------|
| `onTitleModeChange` | `(mode: NavigationTitleMode) => void` | Free 模式下滚动触发 |
| `onNavBarStateChange` | `(isVisible: boolean) => void` | Split 模式下 navBar 显隐 |
| `onNavigationModeChange` | `(mode: NavigationMode) => void` | Auto 模式下 Stack ↔ Split |

#### `NavPathStack` 常用方法

| 方法 | 签名 | 用途 |
|------|------|------|
| `pushPath` | `(info: NavPathInfo, options?: NavigationOptions \| boolean)` | 主力入栈 |
| `pushPathByName` | `(name, param, onPop?, animated?)` | 按名入栈 |
| `pushDestination` | `(info, options?) => Promise<void>` | 异步入栈，可 catch |
| `replacePath` | `(info, options?)` | 替换栈顶 |
| `pop` | `(result?, animated?) => NavPathInfo \| undefined` | 栈顶出栈 |
| `popToName` | `(name, result?, animated?) => number` | 回退到指定页 |
| `clear` | `(animated?)` | 清空栈 |
| `setInterception` | `(interception: NavigationInterception)` | 全局路由拦截 |
| `size` | `() => number` | 栈深 |
| `getAllPathName` | `() => Array<string>` | 所有页名 |

#### 字段与枚举（含默认值）

##### 构造重载

| 形态 | 签名 | 说明 |
|------|------|------|
| API 8 | `Navigation()` | 最老形态，**不推荐新代码用** |
| **API 10+（推荐）** | `Navigation(pathInfos: NavPathStack)` | 绑定路由栈 |
| API 20+ | `Navigation(pathInfos: NavPathStack, homeDestination: HomePathInfo)` | 指定一个 NavDestination 作为首页 |

##### 核心属性速览

| 属性 | 类型 | 场景 |
|------|------|------|
| `navBarWidthRange` | `[Dimension, Dimension]` | 分割线可拖拽范围 |
| `minContentWidth` | `Dimension` | 内容区最小宽度，默认 360vp |
| `backButtonIcon` | `string \| PixelMap \| Resource \| SymbolGlyphModifier` | 自定义返回图标 |
| `recoverable` | `boolean`（API 14+） | 是否参与状态恢复 |

##### 枚举速查

**`NavigationMode`**：

| 值 | 说明 |
|----|------|
| `Stack` | 单栏，子页面覆盖首页 |
| `Split` | 分栏，左 navBar 右 content（分割线可拖） |
| `Auto`（默认） | 宽 ≥ 600vp → `Split`，否则 `Stack`（自折叠屏 / 平板适配首选） |

**`NavigationTitleMode`**：

| 值 | 说明 |
|----|------|
| `Free`（默认 0） | 随滚动缩小；满屏滚动组件时标题从大变小 |
| `Full`（1） | 固定大标题；只有主标题 112vp / 主 + 副 138vp |
| `Mini`（2） | 固定小标题；统一 56vp |

**`LaunchMode`**（API 12+，`NavigationOptions.launchMode`）：

| 值 | 行为 |
|----|------|
| `STANDARD`（默认） | 正常 push / replace |
| `MOVE_TO_TOP_SINGLETON` | 同名已存在则移到栈顶，否则正常 push |
| `POP_TO_SINGLETON` | 同名已存在则弹出其上所有页面，否则正常 push |
| `NEW_INSTANCE` | 强制创建新实例，不复用 |

##### `NavPathInfo`（API 10+）

##### `PopInfo`（API 11+）

##### `NavPathStack` 路由方法速览

| 方法 | 签名 | 用途 |
|------|------|------|
| `popToIndex` | `(index: number, result?: Object, animated?: boolean)` | 回退到指定索引 |
| `moveToTop` / `moveIndexToTop` | 同名 | 把指定页移到栈顶 |
| `removeByName` / `removeByIndexes` / `removeByNavDestinationId` | 多种删除 | 按名 / 索引 / id 删除栈中页面 |
| `getParamByName` / `getParamByIndex` | 同名 | 拿参数 |
| `disableAnimation` | `(value: boolean)` | 全局禁用转场动画 |
| `getParent` | `() => NavPathStack \| null` | 嵌套 Navigation 时获取父栈 |

**要点**：
- 现代写法 = `Navigation(pathStack)` + `navDestination(builder)` + `pathStack.pushPath`
- 子页面用 `@Consume('pathStack')` 拿到栈，**不要** `new NavPathStack()` 再拿一个
- 返回值用 `pushPathByName` 的 `onPop` 回调 **或** `NavPathInfo` 构造函数的 `onPop` 参数
- 拦截用 `setInterception({ willShow })`，是**类似 Vue/React Router 的全局守卫**
- 新代码别碰 `@ohos.router`;子页面生命周期见本文件 NavDestination 节

### NavDestination（路由子页根容器）

NavDestination 是 **Navigation 子页面的根容器**，从 API 10 起支持。

坑：必须由 `Navigation.navDestination(builder)` 分派，单独使用无效；取 `pathInfo.param` 要在 `onReady` 里（唯一时机，只触发一次）；`bindToScrollable` 滚动联动要求 titleBar / toolBar 未隐藏。

#### 构造

| 接口 | 签名 | 说明 |
|------|------|------|
| `NavDestination` | `()` | 无参构造，只能作为 `navDestination(builder)` 分派的根 |

#### 高频属性

| 属性 | 类型 |
|------|------|
| `title` | `string \| CustomBuilder \| NavDestinationCommonTitle \| NavDestinationCustomTitle \| Resource` |
| `mode` | `NavDestinationMode`: `STANDARD` / `DIALOG`（不支持动态修改） |
| `hideTitleBar` / `hideToolBar` / `hideBackButton` | `boolean`（可选 animated） |
| `toolbarConfiguration` | `Array<ToolbarItem> \| CustomBuilder` |
| `menus` | `Array<NavigationMenuItem> \| CustomBuilder` |
| `systemBarStyle` | `Optional<SystemBarStyle>` |
| `systemTransition` | `NavigationSystemTransitionType` |
| `bindToScrollable` | `Array<Scroller>` |
| `bindToNestedScrollable` | `Array<NestedScrollInfo>` |

#### 核心事件（生命周期 + 交互）

| 事件 | 签名 | 关键点 |
|------|------|-------|
| `onWillAppear` | `Callback<void>` | 挂载前，改栈当前帧生效 |
| `onReady` | `Callback<NavDestinationContext>` | **唯一拿 pathStack/param 时机**，只触发一次 |
| `onWillShow` / `onShown` | `Callback<void>` / `Callback<VisibilityChangeReason>` | 显示前/已显示 |
| `onWillHide` / `onHidden` | 同 | 隐藏前/已隐藏 |
| `onWillDisappear` | `Callback<void>` | 卸载前（转场动画开始前） |
| `onBackPressed` | `() => boolean` | **返 true 拦截返回键** |
| `onResult` | `Optional<Callback<ESObject>>` | 被 pop(result) 时触发 |
| `onActive` / `onInactive` | `Optional<Callback<NavDestinationActiveReason>>` | 激活态变化（DIALOG 场景主用） |

#### `NavDestinationContext` 关键字段

| 字段 | 类型 | 用途 |
|------|------|------|
| `pathInfo` | `NavPathInfo` | 拿 `pathInfo.param` 接参数 |
| `pathStack` | `NavPathStack` | 做二次跳转 / 查看栈深 |
| `navDestinationId` | `string` | 全局唯一 id（API 12+） |

#### 字段与枚举（含默认值）

##### 构造

`NavDestination()` —— 无参构造。**只能作为 `Navigation.navDestination(builder)` 分派出的唯一根节点**，不能当普通容器直接使用。

##### 核心属性速览

| 属性 | 类型 | 场景 |
|------|------|------|
| `recoverable` | `Optional<boolean>` | 应用异常退出后恢复（需 Navigation 也开启） |
| `preferredOrientation` | `Optional<Orientation>` | 页面方向 |
| `enableStatusBar` / `enableNavigationIndicator` | `Optional<boolean>`（API 19+） | 状态栏 / 导航条显隐 |

##### 枚举速查

**`NavDestinationMode`**（API 11+）：

| 值 | 行为 |
|----|------|
| `STANDARD`（默认 0） | 标准页，入栈覆盖下层 |
| `DIALOG`（1） | **透明层叠**，不遮盖下层，下层**不触发 onHidden**，只触发 `onInactive`。适用于 Sheet / 弹窗式子页 |

**`NavigationSystemTransitionType`**（API 14+）：

| 值 | 说明 |
|----|------|
| `DEFAULT`（默认） | 系统默认（水平滑入） |
| `NONE` | 无动画 |
| `TITLE` / `CONTENT` | 只动 titleBar / 只动内容区 |
| `FADE` / `EXPLODE` / `SLIDE_RIGHT` / `SLIDE_BOTTOM` | 渐变 / 中心缩放 / 右滑入 / 底滑入 |

##### 核心事件签名

| 事件 | 签名 |
|------|------|
| `onShown` | `Callback<VisibilityChangeReason>`（API 10+；API 21+ 起带入参） |
| `onHidden` | `Callback<VisibilityChangeReason>` |

##### `NavDestinationContext`

**要点**：
- 生命周期:`onReady` 一次性拿上下文 → `onShown/onHidden` 每次可见 → `onBackPressed` 拦返回
- DIALOG 模式 ≠ 普通 Sheet，它走 **onActive/onInactive 而非 onShown/onHidden**
- 滚动联动一行搞定：`.bindToScrollable([this.scroller])`
- 子页面**总是** `@Consume('pathStack')`，**永远不要** `new NavPathStack()` 重建
- HDS 升级见 hds-components.md 的 HdsNavDestination 节，容器见本文件 Navigation 节

### Tabs（页签容器，含 BottomTab 底部页签 / SubTab 子页签）

Tabs 是通过页签进行内容视图切换的**容器组件**，每个页签对应一个 TabContent 子组件。

坑：直接子组件只能是 `TabContent`（外面可包 `if/else`、`ForEach`），塞 `Column` / `Row` 无效；底部页签 = `barPosition(BarPosition.End)` + `BottomTabBarStyle`，内嵌子页签用 `SubTabBarStyle`；切换的四种触发源（手势 / 控制器 / index 修改 / 点击）都进 `onChange`。

#### 构造

| 接口 | 签名 | 说明 |
|------|------|------|
| `Tabs` | `(options?: TabsOptions)` | 容器构造，`TabsOptions` 见下方"字段与枚举"表 |
| `BarPosition` | 枚举 `Start`（0）/ `End`（1） | 位置 |
| `BarMode` | 枚举 `Fixed` / `Scrollable` | 布局模式 |

#### 高频属性（按使用频率排序）

| 属性 | 类型 | 场景 |
|------|------|------|
| `barPosition` | `BarPosition` | 顶/底/左/右四向（与 `vertical` 组合） |
| `vertical` | `boolean` | 横/纵方向 |
| `scrollable` | `boolean` | 是否允许手势滑动切换（底部 Tab 常设 `false`） |
| `barMode` | `BarMode` | `Fixed` 均分 / `Scrollable` 可滚 |
| `animationDuration` | `number` | 切换动画 ms；`0` 关闭 |
| `divider` | `DividerStyle` | 分割线 |
| `barOverlap` | `boolean` | TabBar 叠加在 TabContent 之上 |
| `barBackgroundColor` / `barBackgroundBlurStyle` | `ResourceColor` / `BlurStyle` | 背景 |

#### 核心事件

| 事件 | 签名 | 说明 |
|------|------|------|
| `onChange` | `(index: number) => void` | 切换**完成后** |
| `onTabBarClick` | `(index: number) => void` | 仅点击触发，不含滑动 |
| `onAnimationStart` | `OnTabsAnimationStartCallback` | 切换动画开始（自定义 TabBar 联动首选） |
| `onAnimationEnd` | `OnTabsAnimationEndCallback` | 切换动画结束 |
| `onContentWillChange` | `(currentIndex: number, comingIndex: number) => boolean` | **切换拦截**，返回 false 阻止切换 |
| `onSelected` / `onUnselected` | `(index: number) => void` | 页签选中 / 取消（API 18+） |

#### `TabsController` 常用方法

| 方法 | 签名 | 用途 |
|------|------|------|
| `changeIndex` | `(value: number) => void` | 命令式跳页 |
| `preloadItems` | `(indices: Optional<Array<number>>) => Promise<void>` | 预加载（API 12+，必须 Tabs 创建后调用） |
| `setTabBarTranslate` | `(translate: TranslateOptions) => void` | TabBar 平移（API 13+） |
| `setTabBarOpacity` | `(opacity: number) => void` | TabBar 透明度（API 13+） |

#### 字段与枚举（含默认值）

##### 构造参数 `TabsOptions`（API 15+）

| 参数 | 类型 | 默认 | 必填 | 说明 |
|------|------|------|------|------|
| `index` | `number` | `0` | 否 | 当前页签索引；**支持 `$$` 双向绑定**（API 10+） |
| `controller` | `TabsController` | — | 否 | 控制器，不支持多 Tabs 共用一个 controller |
| `barModifier` | `CommonModifier` | — | 否 | TabBar 通用属性动态 modifier（API 15+） |

##### `BarPosition` 枚举

| 值 | `vertical(true)` | `vertical(false)` |
|----|------------------|-------------------|
| `Start`（默认 0） | 页签位于容器**左**侧 | 页签位于容器**顶**部 |
| `End`（1） | 页签位于容器**右**侧 | 页签位于容器**底**部（**底部导航常用**） |

##### `BarMode` 枚举（页签布局）

| 值 | 说明 |
|----|------|
| `Fixed`（默认） | 均分布局，所有页签等宽占满 TabBar |
| `Scrollable` | 按实际长度布局，总宽超出 TabBar 时可横向滑动 |

##### 核心属性速览

| 属性 | 类型 | 默认 | 说明 |
|------|------|------|------|
| `barWidth` / `barHeight` | `Length` | 自适应 | TabBar 宽高 |
| `fadingEdge` | `boolean` | `true` | 可滑动模式下两端渐隐（API 10+） |
| `barBackgroundBlurStyle` | `BlurStyle` 或 `{ blurStyle, BackgroundBlurStyleOptions }` | — | TabBar 背景模糊（API 11+/18+） |
| `barGridAlign` | `BarGridColumnOptions` | — | TabBar 栅格对齐（API 10+） |

##### `TabsController` 方法速览

| 方法 | 签名 | 说明 |
|------|------|------|

**要点**：
- 容器本体 API **不用 import**，`TabsController` 也一样，都是全局构造
- `index` 支持 `$$` 双向绑定；`controller` 是普通成员，不加 `@State`
- 切换 = 四种触发源（手势 / 控制器 / index 修改 / 点击）都进 `onChange`
- 拦截 = `onContentWillChange` 返 `false`
- HDS 版见 hds-components.md 的 HdsTabs 节，业务组合见本文件下方 BottomTab / SubTab 模式

#### BottomTab 底部页签模式（Tabs + BottomTabBarStyle）

BottomTab 是底部页签导航模式，基于 Tabs + TabContent 的 BottomTabBarStyle 实现，用于应用主页在多个一级页面之间切换导航。

坑：barPosition 用了 Start，底部 Tab 应使用 End；没有用 BottomTabBarStyle，而是用了 SubTabBarStyle（视觉不符合底部导航规范）；忘记设置 scrollable(false)，用户左右滑动会切页而非操作页面内容；index 不用双向绑定，通过 TabsController 和 onChange 手动同步容易遗漏。

| API | 说明 |
|-----|------|
| `Tabs({ barPosition: BarPosition.End, index })` | 创建底部页签容器，index 支持 $$ 双向绑定 |
| `TabContent().tabBar(BottomTabBarStyle.of(icon, text))` | 底部页签样式，含图标 + 文字 |
| `BottomTabBarStyle.of(icon, text)` | 创建底部页签样式实例 |
| `.scrollable(false)` | 禁用手势滑动切页 |
| `.barHeight(Length)` | 设置 TabBar 高度（默认 56vp / API 12+ 默认 48vp） |
| `.onChange((index: number) => void)` | 页签切换回调 |
| `.onTabBarClick((index: number) => void)` | 页签点击回调（含重复点击） |
| `.barBackgroundColor(color)` | TabBar 背景色 |
| `.barMode(BarMode.Fixed)` | 所有 Tab 平均分配宽度（默认） |

#### SubTab 子页签模式（Tabs + SubTabBarStyle）

SubTab 是子页签/内联标签模式，基于 Tabs + TabContent 的 SubTabBarStyle 实现，用于页面内部区域的内容分类切换（区别于 BottomTab 的一级导航）。

坑：用 BottomTabBarStyle 做内容区子 Tab（视觉风格不匹配）；barMode 用 Scrollable 但 Tab 数量很少（2-3 个），应使用 Fixed 平均分配；每次切换 Tab 都重新创建数据，没有缓存策略；SubTabBarStyle.of() 不传字符串参数。

| API | 说明 |
|-----|------|
| `Tabs({ barPosition?, index?, controller? })` | 创建 Tab 容器 |
| `TabContent().tabBar(SubTabBarStyle.of(text))` | 子页签样式 |
| `SubTabBarStyle.of(text)` | 创建子页签样式实例 |
| `.indicator({ color, height, borderRadius })` | 指示器样式 |
| `.labelStyle({ selectedColor, unselectedColor, font? })` | 标签文字样式 |
| `.barMode(BarMode.Fixed)` | Tab 平均分配宽度 |
| `.barMode(BarMode.Scrollable, options?)` | Tab 可滚动 |
| `.barHeight(Length)` | TabBar 高度（SubTab 默认 56vp） |
| `.onChange((index: number) => void)` | 页签切换回调 |
| `.scrollable(boolean)` | 是否可手势滑动切换内容 |
| `.animationDuration(number)` | 切换动画时长 |



### List（列表容器，配 ListItem）

List 是列表容器组件，配合 ListItem 展示一组结构相同的数据。

坑：列表数据写死在 build 里，没有用 @State；ForEach 没有提供 keyGenerator，列表更新可能异常；ListItem 没有点击事件，用户点了没反应；没有处理空状态，列表为空时页面一片空白。

| API | 说明 |
|-----|------|
| `List({ space?, initialIndex?, scroller? })` | 创建列表容器，scroller 绑定 Scroller 控制器 |
| `ListItem()` | 列表子项 |
| `ListItemGroup({ header?, footer? })` | 分组（配合 sticky 可吸顶） |
| `.listDirection(Axis)` | 排列方向：Axis.Vertical（默认）/ Axis.Horizontal |
| `.lanes(number)` | 多列布局，如 `.lanes(2)` 实现两列列表（API 9+） |
| `.divider({ strokeWidth, color, startMargin, endMargin })` | 分割线 |
| `.scrollBar(BarState)` | 滚动条：Auto（默认 API 10+）/ On / Off |
| `.cachedCount(number)` | LazyForEach 预加载行数，建议设为一屏行数的一半 |
| `.sticky(StickyStyle)` | ListItemGroup header/footer 吸顶/吸底（API 9+） |
| `.edgeEffect(EdgeEffect)` | 边缘效果：Spring（回弹）/ Fade（淡出）/ None |
| `.nestedScroll(NestedScrollOptions)` | 嵌套滚动联动模式，出现滑动冲突时可显式设置（API 10+） |
| `.enableScrollInteraction(boolean)` | 是否支持手势滚动，禁用后仍可通过 Scroller 控制（API 10+） |
| `.scrollSnapAlign(ScrollSnapAlign)` | 滚动结束对齐效果，轮播类列表用（API 10+） |
| `.onScrollIndex((first, last) => void)` | 滚动索引变化 |
| `.onReachEnd(() => void)` | 滚动触底 |
| `.swipeAction({ start?, end? })` | ListItem 侧滑操作 |
| `.selectable(boolean)` | ListItem 是否可框选 |
| `ForEach(arr, itemGenerator, keyGenerator)` | 循环渲染 |
| `LazyForEach(dataSource, itemGenerator, keyGenerator)` | 懒加载渲染（长列表必用） |

> **性能要点**：长列表务必用 `LazyForEach` + `.cachedCount(n/2)`（n 为一屏可见项数）。需要编程控制滚动（回到顶部、跳转指定索引）时，通过 `scroller` 参数绑定 `Scroller` 控制器，调用 `scroller.scrollToIndex()` 或 `scroller.scrollEdge(Edge.Top)`。

### Refresh（下拉刷新容器）

Refresh 是**下拉刷新容器**，从 API 8 起支持（API 11+ 为现代形态）。

坑：子组件必须是可滚动容器（`List` / `Scroll` / `Grid` / `WaterFlow`），塞 `Column` 不响应；下拉需拉过 `refreshOffset`（默认 64vp）松手才触发；`onRefreshing` 业务结束必须复位 `isRefreshing`（`try/finally` 兜底，忘改回是最常见 bug）。

#### 构造

| 接口 | 签名 | 说明 |
|------|------|------|
| `Refresh` | `(options: RefreshOptions)` | 必填 options |
| `RefreshOptions` | `{ refreshing: boolean, builder?, promptText?, refreshingContent? }` | `refreshing` 用 `$$` |

#### 核心属性

| 属性 | 类型 | 场景 |
|------|------|------|
| `refreshOffset` | `number`(vp) | 触发刷新阈值,默 64 / 96 |
| `pullToRefresh` | `boolean` | 设 `false` 禁用下拉刷新 |
| `pullUpToCancelRefresh` | `boolean \| undefined`(API 23+) | 刷新中上划取消 |
| `pullDownRatio` | `Optional<number>` | 0-1 跟手系数 |
| `maxPullDownDistance` | `Optional<number>`(API 20+) | 最大下拉距离 |

#### 核心事件

| 事件 | 签名 | 说明 |
|------|------|------|
| `onRefreshing` | `() => void` | 进入刷新态,**发起请求的入口** |
| `onStateChange` | `(state: RefreshStatus) => void` | 5 个状态转换监听 |
| `onOffsetChange` | `Callback<number>`(API 12+) | 下拉距离变化,做自定义动画 |

#### 枚举

| `RefreshStatus` | Inactive(0) / Drag(1) / OverDrag(2) / Refresh(3) / Done(4) |
|-----------------|------------------------------------------------------------|

#### 字段与枚举（含默认值）

##### 构造参数 `RefreshOptions`

| 字段 | 类型 | 必填 | 场景 |
|------|------|------|------|
| `refreshing` | `boolean`(支持 `$$` 双向绑定) | **是** | 核心状态;**务必用 `$$`** |
| `builder` | `CustomBuilder`(API 10+) | 否 | 自定义刷新区域,**API 12+ 起官方推荐改用 `refreshingContent`**(避免销毁重建导致的动画中断) |
| `promptText` | `ResourceStr`(API 12+) | 否 | 刷新区域底部自定义文本;设置后 `refreshOffset` 默认值从 64vp 变 96vp |
| `refreshingContent` | `ComponentContent`(API 12+) | 否 | 官方推荐的自定义刷新区域;同时设 `builder` 时 `builder` **不生效** |

##### 核心属性速览

| 属性 | 类型 | 默认 | 场景 |
|------|------|------|------|

##### 枚举 `RefreshStatus`

| 值 | 名称 | 含义 |
|----|------|------|
| 0 | `Inactive` | 默认 |
| 1 | `Drag` | 下拉中,< 阈值 |
| 2 | `OverDrag` | 下拉中,≥ 阈值 |
| 4 | `Done` | 刷新结束,回到初始态 |

**要点**：
- `refreshing` **必须** `$$` 双向绑定,不是普通单向
- 子组件**必须**可滚动(`List` / `Scroll` / `Grid` / `WaterFlow`),塞 `Column` 不响应
- `onRefreshing` 内业务请求**必须** try/finally 兜底 `isRefreshing = false`
- 自定义刷新内容:API 12+ 用 `refreshingContent`,API 11 及之前用 `builder`,同时设只 `refreshingContent` 生效
- 完整"下拉刷新 + 上拉加载 + 四态"套路见 patterns/data-and-form.md

### Swiper（轮播 / 滑块视图容器）

Swiper 是滑块视图容器组件，提供子组件滑动轮播显示的能力。

坑：没有设置 loop 和 autoPlay，轮播图不会自动播放；没有 onChange，外部无法获知当前页码；interval 设置过短，用户来不及阅读；displayCount 超过子组件数量；轮播图没有设置点击事件，点了没反应。

| API | 说明 |
|-----|------|
| `Swiper(controller?)` | 创建轮播容器 |
| `.index(number)` | 当前页索引，支持 $$ 双向绑定 |
| `.autoPlay(boolean)` | 是否自动播放 |
| `.interval(number)` | 自动播放间隔（毫秒），默认 3000 |
| `.duration(number)` | 切换动画时长（毫秒），默认 400 |
| `.loop(boolean)` | 是否循环，默认 true |
| `.vertical(boolean)` | 是否纵向滑动，默认 false |
| `.displayCount(number \| string)` | 一页显示几个子组件，'auto' 自适应 |
| `.displayMode(SwiperDisplayMode)` | 子组件主轴方向尺寸：STRETCH / AUTO_LINEAR |
| `.cachedCount(number)` | 预加载子组件个数 |
| `.disableSwipe(boolean)` | 禁止手势滑动 |
| `.curve(Curve \| string)` | 动画曲线 |
| `.indicator(DotIndicator \| DigitIndicator \| boolean)` | 导航点样式 |
| `.displayArrow(boolean \| ArrowStyle)` | 导航箭头 |
| `.nestedScroll(SwiperNestedScrollMode)` | 嵌套滚动模式 |
| `.onChange(callback)` | 页面切换完成回调 (index) |
| `.onAnimationStart(callback)` | 切换动画开始回调 (index, targetIndex) |
| `.onAnimationEnd(callback)` | 切换动画结束回调 (index) |
| `.onGestureSwipe(callback)` | 手势滑动中回调 |
| `controller.showNext()` | 翻至下一页 |
| `controller.showPrevious()` | 翻至上一页 |
| `controller.changeIndex(index, useAnimation?)` | 跳转到指定页 |
| `controller.finishAnimation(callback?)` | 停止播放动画 |
| `DotIndicator` | 圆点指示器（selectedColor / color / itemWidth / itemHeight 等） |
| `DigitIndicator` | 数字指示器 |

### ScrollBar（滚动条，配 Scroller）

ScrollBar 是滚动条组件，用于配合可滚动组件（List、Grid、Scroll、WaterFlow 等）使用，通过共享 Scroller 控制器实现联动滚动。

坑：ScrollBar 和可滚动组件使用不同的 Scroller，无法联动；ScrollBar 方向与可滚动组件方向不一致；没有关闭可滚动组件自带的滚动条，导致两个滚动条同时出现；ScrollBar 父级是可滚动组件却未指定主轴大小，可能导致无穷大；一个 Scroller 同时绑定多个 ScrollBar，不支持一对多。

| API | 说明 |
|-----|------|
| `ScrollBar({ scroller, direction?, state? })` | 创建滚动条组件，通过 Scroller 与可滚动组件绑定 |
| `ScrollBarDirection.Vertical` | 纵向滚动条 |
| `ScrollBarDirection.Horizontal` | 横向滚动条 |
| `BarState.Auto` | 自动显隐（默认） |
| `BarState.On` | 常驻显示 |
| `BarState.Off` | 隐藏 |
| `.enableNestedScroll(boolean)` | 是否支持嵌套滚动（API 14+），默认 false |
| `.scrollBarColor(ColorMetrics)` | 无子节点时滚动条滑块颜色（API 20+） |

> **注意**：ScrollBar 与可滚动组件必须共享同一个 Scroller 实例且方向一致，仅支持一对一绑定。API 12+ 无子节点时支持默认样式滚动条。

### AlphabetIndexer（字母索引条）

AlphabetIndexer 是字母索引条组件，可与 List 等容器组件联动用于按字母快速定位内容。

坑：arrayValue 为空数组，索引条不显示任何内容；selected 超出范围，会取默认值 0；没有设置 usingPopup(true) 就使用 onRequestPopupData，弹窗不会出现；没有和 List 联动跳转，用户点击索引无效果。

| API | 说明 |
|-----|------|
| `AlphabetIndexer({ arrayValue: string[], selected: number })` | 创建索引条，arrayValue 为索引字母数组 |
| `.selected(index: number)` | 设置当前选中项索引，支持 $$ 双向绑定（API 10+） |
| `.usingPopup(boolean)` | 是否显示提示弹窗，默认 false |
| `.onSelect((index: number) => void)` | 索引项选中事件 |
| `.onRequestPopupData((index: number) => string[])` | 请求弹窗二级索引内容 |
| `.onPopupSelect((index: number) => void)` | 弹窗二级索引项选中事件 |
| `.alignStyle(IndexerAlign, offset?)` | 弹窗对齐样式（Left / Right / START / END） |
| `.color(color)` | 未选中项文本颜色 |
| `.selectedColor(color)` | 选中项文本颜色 |
| `.selectedBackgroundColor(color)` | 选中项背景颜色 |
| `.popupColor(color)` | 弹窗一级索引文本颜色 |
| `.popupBackground(color)` | 弹窗背景颜色 |
| `.popupFont(Font)` | 弹窗一级索引文本样式 |
| `.selectedFont(Font)` | 选中项文本样式 |
| `.font(Font)` | 未选中项文本样式 |
| `.itemSize(number)` | 索引项区域大小，默认 16vp |
| `.autoCollapse(boolean)` | 自适应折叠模式（API 11+） |
| `.popupBackgroundBlurStyle(BlurStyle)` | 弹窗背景模糊材质（API 12+） |
