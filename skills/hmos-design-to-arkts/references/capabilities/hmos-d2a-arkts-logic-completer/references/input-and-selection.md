# 输入与选择（input-and-selection）

按组件名 / 场景词检索本文件，每个组件一节：坑位 + 常用接口表 + 字段与枚举表。标题括号内是设计稿名 / 中文别名，不是 API 名——写代码只用反引号里的真实 API。

### TextInput（单行文本输入）

TextInput 是单行文本输入组件，用于接收用户键入的文本内容。

坑：没有状态绑定，输入内容无法获取；有 onChange 但没有用 @State，UI 不更新；搜索框没有防抖，每次按键都触发搜索；表单没有校验，直接提交。

| API | 说明 |
|-----|------|
| `TextInput({ placeholder?, text?, controller? })` | 创建输入框，text 支持 $$ 双向绑定（API 10+） |
| `.type(InputType)` | 输入类型（见下表） |
| `.enterKeyType(EnterKeyType)` | 回车键类型：Done/Go/Search/Send/Next/PREVIOUS(11+)/NEW_LINE(11+) |
| `.maxLength(number)` | 最大输入长度 |
| `.showPasswordIcon(boolean)` | 密码模式下显示可见性切换图标 |
| `.inputFilter(regex, error?)` | 正则过滤非法输入字符（API 8+） |
| `.showError(ResourceStr \| undefined)` | 错误状态下的提示文本，传入 undefined 隐藏错误状态（API 10+） |
| `.showUnderline(boolean)` | 下划线模式（API 10+） |
| `.showCounter(boolean, options?)` | 字符计数器（API 11+） |
| `.enableKeyboardOnFocus(boolean)` | 获焦时是否自动拉起键盘，默认 true（API 10+） |
| `.cancelButton({ style?, icon? })` | 右侧清除按钮（API 11+） |
| `.selectAll(boolean)` | 设置初始状态时是否全选文本（API 11+） |
| `.onChange((value: string) => void)` | 内容变化回调 |
| `.onSubmit((enterKey: EnterKeyType) => void)` | 回车提交回调 |
| `.onFocus(() => void)` | 获焦回调 |
| `.onBlur(() => void)` | 失焦回调 |
| `.onEditChange((isEditing: boolean) => void)` | 编辑状态变化 |

**InputType 枚举**：

| 类型 | 说明 |
|------|------|
| Normal | 普通文本（默认） |
| Password | 密码 |
| Email | 邮箱 |
| Number | 纯数字 |
| PhoneNumber | 电话号码 |
| USER_NAME（11+） | 用户名（适配密码填充服务） |
| NEW_PASSWORD（11+） | 新密码 |
| NUMBER_PASSWORD（11+） | 数字密码 |
| NUMBER_DECIMAL（11+） | 带小数点的数字 |
| URL（12+） | URL 输入 |

> **Controller**：需要编程控制光标或选区时，构造时传入 `TextInputController`，可调用 `controller.caretPosition(pos)` 定位光标、`controller.setTextSelection(start, end)` 设置选区。

### Search（搜索框）

Search 是搜索框组件，用于接收用户输入的搜索关键字并触发搜索操作。

坑：没有 onSubmit，用户按搜索键无响应；没有处理空字符串，导致空搜索；onChange 中直接发起网络请求，没有防抖；搜索结果为空时没有任何提示；没有给 Search 设置 value 的双向绑定，外部无法清空搜索框。

| API | 说明 |
|-----|------|
| `Search(options?)` | 创建搜索框，options 包含 value / placeholder / icon / controller |
| `.searchButton(text, options?)` | 设置搜索按钮文字和样式 |
| `.placeholderColor(color)` | placeholder 文本颜色 |
| `.placeholderFont(font)` | placeholder 文本样式 |
| `.textFont(font)` | 输入文本样式 |
| `.textAlign(TextAlign)` | 文本对齐方式 |
| `.fontColor(color)` | 输入文字颜色 |
| `.caretStyle(CaretStyle)` | 光标样式（宽度、颜色） |
| `.searchIcon(IconOptions)` | 左侧搜索图标样式 |
| `.cancelButton(options)` | 右侧清除按钮样式（CancelButtonStyle.CONSTANT / INPUT / INVISIBLE） |
| `.maxLength(number)` | 最大输入字符数 |
| `.type(SearchType)` | 输入框类型：NORMAL / NUMBER / PHONE_NUMBER / EMAIL |
| `.copyOption(CopyOptions)` | 是否可复制 |
| `.enableKeyboardOnFocus(boolean)` | 获焦时是否拉起键盘，默认 true |
| `.selectionMenuHidden(boolean)` | 是否隐藏系统选择菜单 |
| `.onSubmit(callback)` | 点击搜索按钮/软键盘搜索键时回调 |
| `.onChange(callback)` | 输入内容变化时回调 |
| `.onEditChange(callback)` | 编辑状态变化时回调（true=获焦, false=失焦） |
| `.onCopy / .onCut / .onPaste` | 复制/剪切/粘贴回调 |
| `controller.caretPosition(pos)` | 设置光标位置 |
| `controller.stopEditing()` | 退出编辑态 |
| `controller.setTextSelection(start, end)` | 设置选中区域 |

### TextSelection（文本选择：TextArea / RichEditor）

TextSelection 是文本选择交互模式，基于 TextArea / RichEditor 的选择功能实现，用于支持用户选中文本进行复制、剪切、自定义操作等交互场景。

坑：copyOptions 设为 None，用户无法选中和复制文本；没有创建 controller 就调用 setTextSelection；onTextSelectionChange 中直接操作重耗时的业务逻辑；RichEditor 中 onSelect 回调参数用错。

| API | 说明 |
|-----|------|
| `TextArea({ text, controller? })` | 创建多行输入框 |
| `RichEditor({ controller })` | 创建富文本编辑器 |
| `.copyOptions(CopyOptions)` | 控制复制粘贴能力：None / InApp / LocalDevice / CROSS_DEVICE |
| `.onTextSelectionChange((start, end) => void)` | TextArea 选区变化回调 |
| `RichEditor.onSelect((value: RichEditorSelection) => void)` | RichEditor 选区回调 |
| `TextAreaController.setTextSelection(start, end)` | 程序化设置选区 |
| `RichEditorController.setSelection(start, end)` | 程序化设置富文本选区 |
| `RichEditorController.updateSpanStyle(...)` | 更新选区内文本样式 |
| `.bindSelectionMenu(spanType, builder, responseType)` | RichEditor 自定义选择菜单 |
| `.enablePreviewText(boolean)` | 启用输入预览文本 |

### Select（下拉选择菜单）

Select 是下拉选择菜单组件，用于在多个选项中让用户选择一项。

坑：没有 onSelect 回调，选了也不知道；没有设置 selected 和 value，选中状态不可控；联动选择时没有重置子级 Select；选项列表为空数组，下拉无内容；SelectOption 的 value 使用了过长文本，没有设置 optionWidth。

| API | 说明 |
|-----|------|
| `Select(options: SelectOption[])` | 创建下拉选择，options 包含 value / icon |
| `.selected(index)` | 设置选中项索引，支持 $$ 双向绑定 |
| `.value(text)` | 设置按钮显示文本，支持 $$ 双向绑定 |
| `.font(Font)` | 下拉按钮文本样式 |
| `.fontColor(color)` | 下拉按钮文本颜色 |
| `.optionFont(Font)` | 菜单项文本样式 |
| `.optionFontColor(color)` | 菜单项文本颜色 |
| `.optionBgColor(color)` | 菜单项背景色 |
| `.selectedOptionFont(Font)` | 选中项文本样式 |
| `.selectedOptionFontColor(color)` | 选中项文本颜色 |
| `.selectedOptionBgColor(color)` | 选中项背景色 |
| `.optionWidth(Dimension)` | 菜单项宽度 |
| `.optionHeight(Dimension)` | 菜单显示最大高度 |
| `.space(Length)` | 文本与箭头间距，默认 8 |
| `.arrowPosition(ArrowPosition)` | 箭头位置：END（默认）/ START |
| `.menuAlign(MenuAlignType, offset?)` | 菜单对齐方式：START / CENTER / END |
| `.controlSize(ControlSize)` | 组件尺寸：SMALL / NORMAL |
| `.divider(DividerOptions \| null)` | 分割线样式，null 隐藏 |
| `.menuBackgroundColor(color)` | 菜单背景色 |
| `.menuBackgroundBlurStyle(BlurStyle)` | 菜单背景模糊效果 |
| `.onSelect(callback)` | 选中项时回调 (index, value) |

> **注意**：Select 选项数据变化后需要同步重置 `selected` 和 `value`，否则会出现选中状态与实际不一致的问题。

### Picker（滑动选择器：DatePicker / TextPicker）

Picker 是滑动选择器组件，包含 DatePicker（日期选择）和 TextPicker（文本/图文选择），通过上下滑动滚轮的方式从预设列表中选取值。

坑：DatePicker 起始日期晚于结束日期，会被重置为默认值；TextPicker range 设置为空数组，不会显示；onChange 中没有区分单列和多列返回值的类型；在滑动动效过程中修改属性数据导致不生效；TextPicker 的 range 类型运行时动态切换（如从 string[] 变为 string[][]）。

| API | 说明 |
|-----|------|
| `DatePicker(options?: DatePickerOptions)` | 创建日期选择器 |
| `DatePickerOptions.start / end / selected` | 起始日期 / 结束日期 / 选中日期 |
| `DatePickerMode.DATE / YEAR_AND_MONTH / MONTH_AND_DAY` | 日期展示模式（API 18+） |
| `.lunar(boolean)` | 是否显示农历 |
| `.onDateChange(callback: Callback<Date>)` | 日期变化回调（API 10+） |
| `.canLoop(boolean)` | 是否循环滚动（API 20+） |
| `TextPicker(options?: TextPickerOptions)` | 创建文本选择器 |
| `TextPickerOptions.range` | 选择列表：string[] / string[][] / TextCascadePickerRangeContent[] |
| `TextPickerOptions.selected` | 选中项索引：number / number[] |
| `.onChange(callback)` | 选中项变化回调 |
| `.canLoop(boolean)` | 是否循环滚动（API 10+） |
| `.selectedIndex(number \| number[])` | 设置选中项索引（API 10+） |
| `.divider(DividerOptions \| null)` | 分割线样式（API 12+） |
| `.disappearTextStyle(PickerTextStyle)` | 边缘项文本样式（API 10+） |
| `.textStyle(PickerTextStyle)` | 待选项文本样式（API 10+） |
| `.selectedTextStyle(PickerTextStyle)` | 选中项文本样式（API 10+） |
| `.defaultPickerItemHeight(number \| string)` | 选项高度 |
| `.gradientHeight(Dimension)` | 渐隐效果高度（API 12+） |

> **注意**：DatePicker 的日期范围为 [1900-01-31, 2100-12-31]。TextPicker 的 range 类型一旦确定不可动态切换。多列联动使用 TextCascadePickerRangeContent[]。

### SegmentButton（SegmentedButton / 分段按钮）

SegmentButton 是分段按钮组件，包含页签类（tab）和胶囊类（capsule）两种形态。

坑：按钮数量不在 2~5 范围内；selectedIndexes 未使用 $ 双向绑定语法；图标按钮只设了 icon 没设 selectedIcon，图标不显示；页签类设置 multiply: true 不生效，页签类只支持单选；使用扩展运算符创建选项（ArkTS 禁止 object spread）。

| API | 说明 |
|-----|------|
| `SegmentButton({ options, selectedIndexes })` | 创建分段按钮，selectedIndexes 需 @Link 绑定 |
| `SegmentButtonOptions.tab({ buttons, ... })` | 创建页签类选项（仅支持文字按钮） |
| `SegmentButtonOptions.capsule({ buttons, multiply?, ... })` | 创建胶囊类选项（文字/图标/图标+文字） |
| `multiply` | 是否可多选（仅 capsule 类型），默认 false |
| `onItemClicked` | 按钮被点击时回调下标（API 13+） |
| `buttons` | 2~5 个按钮的元组，支持 push/pop/shift/unshift/splice 动态操作 |
| `SegmentButtonItemOptionsArray.create(tuple)` | 静态创建按钮信息数组 |
| `backgroundColor / selectedBackgroundColor` | 背景板颜色 / 选中态背景板颜色 |
| `fontColor / selectedFontColor` | 未选中 / 选中态文本颜色 |
| `fontSize / selectedFontSize` | 未选中 / 选中态字体大小 |
| `fontWeight / selectedFontWeight` | 未选中 / 选中态字体粗细 |
| `imageSize` | 图标尺寸，默认 { width: 24, height: 24 } |
| `direction` | 布局方向（API 12+），支持 RTL 镜像 |
| `backgroundBlurStyle` | 背景模糊材质 |
| `enableStateAnimation` | 修改 selectedIndexes 时是否开启切换动画（API 24+），默认 false |

> **注意**：分段按钮仅支持 2~5 个按钮。页签类只支持单选，胶囊类通过 `multiply` 控制单选/多选。`selectedIndexes` 必须使用 `$` 双向绑定语法。导入时需要从 `'@kit.ArkUI'` 引入 SegmentButton 及相关类型。

### Checkbox（多选框，配 CheckboxGroup 全选）

Checkbox 是多选框组件，用于在一组选项中进行多项选择。

坑：Checkbox 没有 select 绑定，勾选状态不受控；有全选但没有和子项联动；子项变化没有反向更新全选状态；协议 Checkbox 没有和提交按钮联动。

| API | 说明 |
|-----|------|
| `Checkbox({ name?, group?, indicatorBuilder? })` | 创建多选框，indicatorBuilder 可自定义选中样式（API 12+） |
| `.select(boolean)` | 设置选中状态（支持 $$ 双向绑定） |
| `.shape(CheckBoxShape)` | 形状：CIRCLE（默认，API 11+）/ ROUNDED_SQUARE |
| `.selectedColor(color)` | 选中态颜色 |
| `.unselectedColor(color)` | 未选中态边框颜色（API 10+） |
| `.mark(MarkStyle)` | 自定义对勾样式：strokeColor / strokeWidth / size（API 10+） |
| `.onChange((checked: boolean) => void)` | 选中状态变化回调 |
| `CheckboxGroup({ group: string })` | 多选框组（全选控制） |
| `.selectAll(boolean)` | 是否全选 |
| `.checkboxShape(CheckBoxShape)` | 组内多选框形状 |
| `.onChange((event: CheckboxGroupResult) => void)` | 组选中状态变化 |

#### CheckboxGroup（多选框群组，控制全选）

CheckboxGroup 是多选框群组组件，用于控制同组 Checkbox 的全选或取消全选状态。

坑：CheckboxGroup 和 Checkbox 的 group 名称不一致，无法联动；没有 onChange 处理，全选状态无法同步；LazyForEach 场景下没有手动管理未创建 Checkbox 的选中状态；用对象展开更新数组项（ArkTS 禁止）。

| API | 说明 |
|-----|------|
| `CheckboxGroup({ group?: string })` | 创建多选框群组，group 用于关联同组 Checkbox |
| `.selectAll(boolean)` | 设置是否全选，支持 $$ 双向绑定（API 10+） |
| `.selectedColor(ResourceColor)` | 被选中或部分选中状态的颜色 |
| `.unselectedColor(ResourceColor)` | 非选中状态边框颜色（API 10+） |
| `.mark(MarkStyle)` | 内部图标样式（API 10+） |
| `.checkboxShape(CheckBoxShape)` | 组件形状：CIRCLE / ROUNDED_SQUARE（API 12+） |
| `.onChange((result: CheckboxGroupResult) => void)` | 选中状态变化回调，返回 name 数组和 SelectStatus |
| `SelectStatus.All / Part / None` | 全选 / 部分选中 / 全不选 |


### Radio（单选框）

Radio 是单选框组件，用于在一组互斥选项中选择其一。

坑：没有设置 group，多个 Radio 不互斥；checked 写死 true，无法切换；onChange 里没有判断 isChecked，会在取消选中时也更新状态；没有用 @State 管理 selectedValue，切换后 UI 不刷新。

| API | 说明 |
|-----|------|
| `Radio({ value: string, group: string })` | 创建单选框，value 是当前值，group 用于分组互斥 |
| `indicatorType: RadioIndicatorType` | 选中样式：TICK（勾选，默认）/ DOT（圆点）/ CUSTOM（API 12+） |
| `.checked(boolean)` | 设置选中状态，支持 $$ 双向绑定（API 10+） |
| `.radioStyle(RadioStyle)` | 自定义选中/非选中颜色（API 10+） |
| `.onChange((isChecked: boolean) => void)` | 选中状态变化回调 |
| `.enabled(boolean)` | 是否可交互 |

### Toggle（双态切换，含 Switch 开关样式）

Toggle 是双态切换组件，用于在开/关两种状态之间切换。

坑：isOn 写死 true，状态永远不会变；没有声明 @State，onChange 里赋值不会触发 UI 更新；有 @State 但没绑定 onChange，用户点了没反应；有互斥关系的开关没处理联动。

| API | 说明 |
|-----|------|
| `Toggle({ type: ToggleType.Switch, isOn?: boolean })` | 创建开关样式，isOn 支持 $$ 双向绑定 |
| `Toggle({ type: ToggleType.Checkbox, isOn?: boolean })` | 创建勾选样式 |
| `Toggle({ type: ToggleType.Button, isOn?: boolean })` | 创建按钮样式（可含子组件） |
| `.onChange((isOn: boolean) => void)` | 状态变化回调 |
| `.selectedColor(color)` | 选中态背景色 |
| `.switchPointColor(color)` | 滑块颜色（仅 Switch） |
| `.switchStyle(SwitchStyle)` | 自定义 Switch 样式（API 12+），可设置 pointRadius / unselectedColor / pointColor / trackBorderRadius |
| `.enabled(boolean)` | 是否可交互 |

#### Switch（ToggleType.Switch 开关样式）

Switch 是 Toggle 组件的开关样式（ToggleType.Switch），用于在开/关两种状态间切换，是设置页面最常用的交互控件。

坑：isOn 写死 true，点击切换无效果；没有声明 @State，onChange 赋值不会触发 UI 更新；有 @State 但没绑定 onChange，用户点了没反应；有互斥关系的开关没处理联动。

| API | 说明 |
|-----|------|
| `Toggle({ type: ToggleType.Switch, isOn?: boolean })` | 创建开关样式，isOn 支持 $$ 双向绑定 |
| `.onChange((isOn: boolean) => void)` | 状态变化回调 |
| `.selectedColor(color)` | 选中态（开启）背景色 |
| `.switchPointColor(color)` | 圆形滑块颜色 |
| `.switchStyle(SwitchStyle)` | 自定义样式（API 12+）：pointRadius / unselectedColor / pointColor / trackBorderRadius |
| `.enabled(boolean)` | 是否可交互 |
| `ToggleType.Switch` | 开关样式 |
| `ToggleType.Checkbox` | 勾选框样式 |
| `ToggleType.Button` | 状态按钮样式 |
| `.contentModifier(modifier)` | 自定义内容区（API 12+） |


### Slider（滑动条）

Slider 是滑动条组件，用于通过拖动滑块在一个连续或离散的数值范围内选择值。

坑：没有 onChange，滑块可以拖动但不更新状态；min >= max，导致滑块行为异常；step 为 0 或负值，导致步长无效；没有显示当前值，用户不知道滑到了多少；在 Moving 模式下发起网络请求，导致大量无效请求。

| API | 说明 |
|-----|------|
| `Slider(options?)` | 创建滑动条，options 包含 value / min / max / step / style / direction / reverse |
| `SliderStyle.OutSet` | 滑块在滑轨上（默认） |
| `SliderStyle.InSet` | 滑块在滑轨内 |
| `SliderStyle.NONE` | 无滑块（API 12+） |
| `.blockColor(color)` | 滑块颜色 |
| `.trackColor(color \| LinearGradient)` | 滑轨背景颜色，支持渐变色 |
| `.selectedColor(color)` | 已滑动部分颜色 |
| `.showSteps(boolean)` | 是否显示步长刻度 |
| `.showTips(boolean, content?)` | 滑动时是否显示气泡提示 |
| `.trackThickness(Length)` | 滑轨粗细 |
| `.blockSize(SizeOptions)` | 滑块大小 |
| `.blockStyle(SliderBlockStyle)` | 滑块形状：DEFAULT / IMAGE / SHAPE |
| `.blockBorderColor(color)` | 滑块描边颜色 |
| `.blockBorderWidth(Length)` | 滑块描边粗细 |
| `.stepColor(color)` | 刻度颜色 |
| `.stepSize(Length)` | 刻度大小 |
| `.trackBorderRadius(Length)` | 滑轨圆角 |
| `.selectedBorderRadius(Dimension)` | 已滑动部分圆角 |
| `.sliderInteractionMode(mode)` | 交互方式：SLIDE_AND_CLICK / SLIDE_ONLY / SLIDE_AND_CLICK_UP |
| `.slideRange(SlideRange)` | 有效滑动区间 { from, to } |
| `.onChange(callback)` | 滑块变化回调 (value, mode) |
| `SliderChangeMode` | Begin(0) / Moving(1) / End(2) / Click(3) |

> **注意**：onChange 的 value 可能含小数，显示时建议用 `value.toFixed(0)` 或 `value.toFixed(1)` 处理精度。

### Rating（评分）

Rating 是评分组件，用于在给定范围内选择评分。

坑：indicator 为 true 时用户无法操作评分，但绑定了 onChange；没有用 @State 管理评分值，拖动后 UI 不更新；没有设置 stepSize，默认 0.5 可能不符合整数评分需求；评分为 0 时就能提交，应校验。

| API | 说明 |
|-----|------|
| `Rating({ rating: number, indicator?: boolean })` | 创建评分组件，rating 支持 $$ 双向绑定 |
| `.stars(number)` | 评分总数，默认 5 |
| `.stepSize(number)` | 评分步长，默认 0.5，范围 [0.1, stars] |
| `.starStyle({ backgroundUri, foregroundUri, secondaryUri })` | 自定义星级图片 |
| `.onChange((value: number) => void)` | 评分变化回调 |
| `indicator: true` | 只读指示器模式，不可交互 |

### Counter（计数器）

Counter 是计数器组件，提供增加或减少的计数操作。

坑：没有监听 onInc/onDec，点击加减按钮没有任何反应；没有声明 @State，onInc 里赋值不会触发 UI 更新；没有做边界检查，数值可能变成负数或超大值；使用对象展开运算符更新数组项（ArkTS 禁止 spread）。

| API | 说明 |
|-----|------|
| `Counter() { 子组件 }` | 创建计数器，子组件一般为 Text 显示数值 |
| `.onInc(callback: VoidCallback)` | 点击增加按钮时触发 |
| `.onDec(callback: VoidCallback)` | 点击减少按钮时触发 |
| `.enableInc(boolean)` | 增加按钮的启用/禁用（API 10+） |
| `.enableDec(boolean)` | 减少按钮的启用/禁用（API 10+） |
| `.enabled(boolean)` | 整体是否可交互（通用属性） |

### PatternLock（图案密码锁）

PatternLock 是图案密码锁组件，以九宫格图案方式输入密码用于密码验证。

坑：没有绑定 controller，无法调用 reset() 或 setChallengeResult()；onPatternComplete 中没有做长度校验，1-2 个点也当作有效密码；autoReset 为 false 但也没手动 reset()，用户无法重新输入；用 === 比较两个数组引用（永远不等），应转成字符串比较。

| API | 说明 |
|-----|------|
| `PatternLock(controller?: PatternLockController)` | 创建图案密码锁组件 |
| `.sideLength(Length)` | 九宫格的宽高（正方形），默认 288vp |
| `.circleRadius(Length)` | 圆点半径，默认 6vp |
| `.pathStrokeWidth(number \| string)` | 连线宽度，默认 12vp |
| `.regularColor(color)` | 未选中圆点填充色 |
| `.selectedColor(color)` | 选中圆点填充色 |
| `.activeColor(color)` | 激活状态圆点填充色（手指经过但未选中） |
| `.pathColor(color)` | 连线颜色 |
| `.backgroundColor(color)` | 背景颜色 |
| `.autoReset(boolean)` | 输入完成后再次按下是否自动重置，默认 true |
| `.activateCircleStyle(CircleStyleOptions)` | 激活状态背景圆环样式（API 12+） |
| `.skipUnselectedPoint(boolean)` | 路径经过未选中点是否跳过选中（API 15+） |
| `.onPatternComplete((input: Array<number>) => void)` | 密码输入完成回调 |
| `.onDotConnect(Callback<number>)` | 选中圆点时实时回调（API 11+） |
| `PatternLockController.reset()` | 重置组件状态 |
| `PatternLockController.setChallengeResult(result)` | 设置验证结果（CORRECT / WRONG）（API 11+） |

### Chips（Chip / ChipGroup 标签组）

Chips 是操作块组件（含 Chip 单个标签和 ChipGroup 标签组），用于搜索历史、标签筛选、属性选择等场景，支持单选/多选及可删除标签。

坑：ChipGroup 的 selectedIndexes 没有用 @State，选中不会响应式更新；单选模式下初始 selectedIndexes 传了多个索引，只有第一个生效；用对象展开运算符构造 ChipGroupItemOptions（ArkTS 不支持）；没有处理 onChange 回调，选中状态不与业务数据同步。

| API | 说明 |
|-----|------|
| `Chip({ label, prefixIcon?, suffixIcon?, activated?, allowClose?, onClicked?, onClose? })` | 创建单个操作块 |
| `ChipGroup({ items, itemStyle?, selectedIndexes?, multiple?, onChange? })` | 创建操作块群组 |
| `ChipSize.NORMAL / ChipSize.SMALL` | 操作块尺寸 |
| `.activated` | Chip 激活态（boolean） |
| `.allowClose` | 是否显示关闭图标 |
| `.onClicked` | Chip 点击回调 |
| `.onClose` | 关闭图标点击回调 |
| `ChipGroup.onChange` | 选中索引变化回调 `Callback<Array<number>>` |
| `ChipGroup.multiple` | 是否多选（默认 false） |
| `ChipGroup.chipGroupSpace` | 左右内边距及 Chip 间距 |
| `IconGroupSuffix({ items })` | ChipGroup 右侧自定义后缀组件 |
| `import { Chip, ChipSize, ChipGroup } from '@kit.ArkUI'` | 导入模块 |
