# 数据请求与表单校验模式（data-and-form）

> 跨组件套路：**「拉数据的四态 / 分页 / 下拉刷新 / 防并发」+「表单的校验时机 / 错误结构 / 异步查重」**。单组件规格查对应 Reference（`Refresh` / `List` / `TextInput` 等在 `references/containers-and-navigation.md`、`references/input-and-selection.md`）。

## §1. 四态模型（核心抽象）

任何"远程拉数据再渲染"的页面，都存在 5 种运行态：

| 状态 | 语义 | UI 表现 |
|------|------|--------|
| `Idle` | 初始，未发起请求 | 占位 / 空白 |
| `Loading` | 请求进行中 | 转圈 / 骨架屏 |
| `Success` | 拿到数据且非空 | 渲染列表 |
| `Empty` | 拿到数据但为空 | "暂无内容"占位图 |
| `Error` | 请求失败 | 错误提示 + 重试按钮 |

**用 `enum` 表达五态**，不要用联合字面量（ArkTS 不支持 `@State status: 'idle' | 'loading'`，违反 [INSTRUCTIONS.md](../../INSTRUCTIONS.md) 红线）：

```typescript
enum DataStatus { Idle, Loading, Success, Empty, Error }
```

## §2. 最小骨架（复制即可运行）

```typescript
enum DataStatus { Idle, Loading, Success, Empty, Error }

interface FeedItem {
  id: string
  title: string
}

@Entry
@Component
struct FeedPage {
  @State status: DataStatus = DataStatus.Idle
  @State items: FeedItem[] = []
  @State errorMsg: string = ''

  aboutToAppear(): void {
    this.load()
  }

  build() {
    Column() {
      if (this.status === DataStatus.Loading) {
        this.LoadingView()
      } else if (this.status === DataStatus.Error) {
        this.ErrorView()
      } else if (this.status === DataStatus.Empty) {
        this.EmptyView()
      } else if (this.status === DataStatus.Success) {
        this.SuccessView()
      }
    }
    .width('100%').height('100%')
  }

  @Builder
  LoadingView() {
    Column() {
      LoadingProgress().width(48).height(48)
      Text('加载中...').margin({ top: 12 })
    }
    .width('100%').height('100%').justifyContent(FlexAlign.Center)
  }

  @Builder
  ErrorView() {
    Column({ space: 12 }) {
      Text(this.errorMsg).fontColor('#FF3B30')
      Button('重试').onClick((): void => { this.load() })
    }
    .width('100%').height('100%').justifyContent(FlexAlign.Center)
  }

  @Builder
  EmptyView() {
    Column() {
      Text('暂无内容').fontColor('#999')
    }
    .width('100%').height('100%').justifyContent(FlexAlign.Center)
  }

  @Builder
  SuccessView() {
    List({ space: 8 }) {
      ForEach(this.items, (item: FeedItem) => {
        ListItem() {
          Text(item.title).padding(12).width('100%')
        }
      }, (item: FeedItem): string => item.id)
    }
    .width('100%').height('100%')
  }

  private async load(): Promise<void> {
    this.status = DataStatus.Loading
    try {
      const list: FeedItem[] = await this.fetchFeed()
      if (list.length === 0) {
        this.status = DataStatus.Empty
      } else {
        this.items = list
        this.status = DataStatus.Success
      }
    } catch (e) {
      const err = e as Error
      this.errorMsg = err.message.length > 0 ? err.message : '网络错误,请重试'
      this.status = DataStatus.Error
    }
  }
}
```

五态分支用 `if / else if` 一条链，不要叠多个 `if`（会互相覆盖同屏）；`catch (e)` 里必须 `as Error` 再取 message。

## §3. HTTP 请求封装

```typescript
import { http } from '@kit.NetworkKit'

async function apiGet<T>(url: string): Promise<T> {
  const req = http.createHttp()
  try {
    const resp: http.HttpResponse = await req.request(url, {
      method: http.RequestMethod.GET,
      readTimeout: 10000,
      connectTimeout: 10000,
      expectDataType: http.HttpDataType.OBJECT
    })
    if (resp.responseCode !== http.ResponseCode.OK) {
      throw new Error('HTTP ' + resp.responseCode)
    }
    return resp.result as T
  } finally {
    req.destroy()
  }
}
```

硬纪律：

1. `createHttp()` 出来的 `HttpRequest` 必须 `destroy()`，用 try/finally 兜底（否则内存泄漏）
2. `ohos.permission.INTERNET` 权限必须在 `module.json5` 声明
3. `responseCode` 必须判——`req.request` 在 4xx/5xx 时**不会**抛异常
4. `resp.result` 类型是 `string | Object | ArrayBuffer`，取前必须 `as` 窄化
5. URL 包含中文必须 `encodeURL(url)`；HarmonyOS 没有全局 `fetch`，`@kit.NetworkKit` 是唯一官方路径

## §4. 分页列表（pageNum / pageSize / hasMore 三元组）

```typescript
@State items: FeedItem[] = []
@State isLoadingMore: boolean = false
@State hasMore: boolean = true
private pageNum: number = 1
private readonly pageSize: number = 20
```

`pageNum` / `pageSize` 用**普通成员字段**（不驱动 UI 刷新，只是业务指针）。核心 3 函数：

```typescript
private async reload(): Promise<void> {
  this.pageNum = 1
  try {
    const list: FeedItem[] = await this.fetchPage(1, this.pageSize)
    this.items = list
    this.hasMore = list.length === this.pageSize
  } catch (e) {
    this.errorMsg = (e as Error).message
  }
}

private async loadMore(): Promise<void> {
  if (!this.hasMore || this.isLoadingMore) { return }
  this.isLoadingMore = true
  try {
    const next: FeedItem[] = await this.fetchPage(this.pageNum + 1, this.pageSize)
    this.items = this.items.concat(next)
    this.pageNum += 1
    this.hasMore = next.length === this.pageSize
  } catch (e) {
    this.showToast((e as Error).message)   // 分页失败只 Toast,不切状态
  } finally {
    this.isLoadingMore = false
  }
}
```

触底加载 + 尾部状态：

```typescript
List({ space: 8 }) {
  LazyForEach(this.dataSource, (item: FeedItem) => {
    ListItem() { Text(item.title).padding(12) }
  }, (item: FeedItem): string => item.id)

  if (this.isLoadingMore) {
    ListItem() { LoadingProgress().width(24).height(24) }
  } else if (!this.hasMore && this.items.length > 0) {
    ListItem() { Text('— 没有更多了 —').padding(12).fontColor('#999') }
  }
}
.onReachEnd((): void => { this.loadMore() })
```

列表超过 ~50 条务必用 `LazyForEach`（需实现 `IDataSource`），`ForEach` 一次性全量渲染会卡顿。

## §5. 下拉刷新（配合 Refresh 组件）

`Refresh` 组件完整规格见 [references/containers-and-navigation.md](../containers-and-navigation.md) 的 Refresh 节。本模式里它只做一件事：**触发 `reload()`**。

```typescript
Refresh({ refreshing: $$this.isRefreshing }) {
  List({ space: 8 }) {
    LazyForEach(this.dataSource, /* ... */)
  }
  .onReachEnd((): void => { this.loadMore() })
}
.onRefreshing(async (): Promise<void> => {
  try {
    await this.reload()
  } finally {
    this.isRefreshing = false        // 必须 finally 兜底
  }
})
```

**关键区别**：下拉刷新**不切** `status` 到 `Loading`（否则瞬间全屏转圈），让 `Refresh` 自己的指示器承担反馈；分页 / 下拉失败走 Toast，只有首次加载与重试才切 `status`。

## §6. 防并发（版本号方案）

**场景**：用户快速切筛选 A → B → C，最慢的 A 回来后覆盖 C 的结果 → 串数据。

```typescript
@State items: FeedItem[] = []
private requestId: number = 0

private async loadBy(filter: string): Promise<void> {
  this.requestId += 1
  const my: number = this.requestId
  try {
    const list: FeedItem[] = await this.fetchByFilter(filter)
    if (my === this.requestId) {      // 只有最新请求才写入状态
      this.items = list
    }
  } catch (e) {
    if (my === this.requestId) {
      this.errorMsg = (e as Error).message
    }
  }
}
```

原理：发起前 `requestId++`，回调拿本地 `my` 与当前值比较，不相等就静默丢弃。不依赖任何取消 API，比 `destroy()` 旧请求更稳。

## §7. 错误兜底与展示选型

| 策略 | 场景 | 实现 |
|------|------|------|
| **整页错误页 + 重试** | 第一次加载失败，整页无数据 | 切 `DataStatus.Error`，渲染 `ErrorView` |
| **Toast 提示 + 保留旧数据** | 分页 / 下拉刷新失败 | `promptAction.showToast`，不切 `status` |
| **内联错误 + 局部重试** | 列表某条子请求失败 | 该 item 渲染"加载失败,点我重试" |

表单字段的错误展示：

| 方式 | 适用 |
|------|------|
| `TextInput.showError(msg)` | 大多数单字段，官方原生红线 + 图标；**空串要转 `undefined`**，否则红线无文字 |
| 手动 `Text` 红字 | 字段结构复杂（Checkbox 组、日期选择器）`showError` 不可用时 |
| Toast | 提交失败的兜底，不是单字段错误 |

```typescript
TextInput({ placeholder: '手机号' })
  .onBlur((): void => { this.validatePhone() })
  .showError(this.errors.phone.length > 0 ? this.errors.phone : undefined)

private showToast(msg: string): void {
  promptAction.showToast({ message: msg, duration: 2000 })
}
```

## §8. 表单校验时机

| 时机 | 触发条件 | 用在哪类字段 |
|------|---------|------------|
| **实时**（`onChange`） | 每次键入 | 格式简单（手机号位数）、密码强度可视化；**不做严格校验**（键入一半就弹红线体验差） |
| **失焦**（`onBlur`） | 离开输入框 | 大多数字段的**默认选择**；`onChange` 只更新值 |
| **提交**（`click`） | 点提交按钮 | 跨字段关联校验（两次密码一致）、异步查重 |

## §9. 错误数据结构（interface + 整对象替换）

```typescript
// ❌ Record 作为 @State 常出响应式失灵;✅ 显式 interface
interface LoginFormErrors {
  phone: string
  password: string
}

@State errors: LoginFormErrors = { phone: '', password: '' }

// 更新单字段:整对象替换(ArkTS 不支持对象展开 { ...obj })
this.errors = { phone: '格式错误', password: this.errors.password }
```

## §10. 单字段失焦校验骨架

```typescript
struct LoginPage {
  @State phone: string = ''
  @State password: string = ''
  @State errors: LoginFormErrors = { phone: '', password: '' }

  build() {
    Column({ space: 16 }) {
      TextInput({ placeholder: '请输入手机号', text: this.phone })
        .type(InputType.PhoneNumber)
        .maxLength(11)
        .onChange((v: string): void => { this.phone = v })
        .onBlur((): void => { this.validatePhone() })
        .showError(this.errors.phone.length > 0 ? this.errors.phone : undefined)

      TextInput({ placeholder: '请输入密码', text: this.password })
        .type(InputType.Password)
        .onChange((v: string): void => { this.password = v })
        .onBlur((): void => { this.validatePassword() })
        .showError(this.errors.password.length > 0 ? this.errors.password : undefined)

      Button('登录')
        .enabled(this.canSubmit())
        .onClick((): void => { this.submit() })
    }
    .padding(16)
  }

  private validatePhone(): void {
    const err: string = /^1\d{10}$/.test(this.phone) ? '' : '请输入 11 位手机号'
    this.errors = { phone: err, password: this.errors.password }
  }

  private validatePassword(): void {
    const err: string = this.password.length >= 6 ? '' : '密码至少 6 位'
    this.errors = { phone: this.errors.phone, password: err }
  }

  private canSubmit(): boolean {
    return this.phone.length > 0 && this.password.length > 0
      && this.errors.phone.length === 0 && this.errors.password.length === 0
  }

  private submit(): void {
    this.validatePhone()
    this.validatePassword()
    if (!this.canSubmit()) { return }
    // ...发起登录请求
  }
}
```

## §11. 提交前全量校验（多字段）

`validateAll()` 一次性生成新 `errors` 对象再整体赋值，返回 `boolean`；跨字段校验（两次密码一致）只能放提交时：

```typescript
private validateAll(): boolean {
  const next: RegisterFormErrors = {
    phone: /^1\d{10}$/.test(this.form.phone) ? '' : '手机号格式错误',
    email: /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(this.form.email) ? '' : '邮箱格式错误',
    password: this.form.password.length >= 8 ? '' : '密码至少 8 位',
    confirmPassword: this.form.password === this.form.confirmPassword ? '' : '两次密码不一致',
    agreed: this.form.agreed ? '' : '请先勾选用户协议'
  }
  this.errors = next
  return next.phone.length === 0 && next.email.length === 0
    && next.password.length === 0 && next.confirmPassword.length === 0
    && next.agreed.length === 0
}

private submit(): void {
  if (!this.validateAll()) { return }   // 用户可能从没失过焦,必须重新校验
  // ...发起注册请求
}
```

## §12. 异步校验（用户名查重，防抖 + 版本号）

```typescript
enum AsyncStatus { Idle, Checking, Available, Taken, Failed }

@State usernameStatus: AsyncStatus = AsyncStatus.Idle
private debounceTimer: number = -1
private checkVersion: number = 0

private onUsernameChange(v: string): void {
  this.username = v
  this.usernameStatus = AsyncStatus.Idle
  if (this.debounceTimer !== -1) {
    clearTimeout(this.debounceTimer)
  }
  if (v.length === 0) { return }
  this.debounceTimer = setTimeout((): void => {
    this.checkUsername(v)
  }, 500)
}

private async checkUsername(name: string): Promise<void> {
  this.checkVersion += 1
  const my: number = this.checkVersion
  this.usernameStatus = AsyncStatus.Checking
  try {
    const available: boolean = await this.queryUsername(name)
    if (my === this.checkVersion) {     // 只有最新请求的结果才写入
      this.usernameStatus = available ? AsyncStatus.Available : AsyncStatus.Taken
      this.errors = { /* 保留其余字段 */ username: available ? '' : '用户名已被占用' }
    }
  } catch (e) {
    if (my === this.checkVersion) {
      this.usernameStatus = AsyncStatus.Failed
    }
  }
}
```

`canSubmit()` 要查 `usernameStatus === AsyncStatus.Available`（用户可能刚敲完还没等查重完就点提交）。

## §13. 硬纪律（13 条）

1. `@State status: DataStatus`（enum），不用联合字面量
2. 五态分支用 `if / else if` 串联，不用并列 `if`
3. `http.createHttp()` 必须 `destroy()`，用 try/finally
4. `resp.responseCode` 必须显式判，4xx/5xx 不会自动抛
5. `catch (e)` 必须 `e as Error` 才能取 message
6. 下拉刷新 / 分页加载不切 `status`，只用各自 loading 布尔
7. 快速切筛选必上版本号防并发（§6）
8. `errors` 用 `interface`，不用 `Record`
9. 更新单字段整对象替换，不直接改属性、不用对象展开
10. `onChange` 更新值，`onBlur` 做校验，不要反过来
11. `submit` 前必须跑一次全量校验，不能依赖 `errors` 是否为空
12. 异步校验必须防抖 + 版本号，不然打爆后端或串数据
13. `showError(undefined)` 隐藏错误，不要传空字符串
