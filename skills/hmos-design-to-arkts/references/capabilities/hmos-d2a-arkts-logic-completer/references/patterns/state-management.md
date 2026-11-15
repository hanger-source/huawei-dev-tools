# 状态管理装饰器选型模式

> 本文回答的问题：**「这个场景该用 `@State` 还是 `@Observed`?该用 `@Provide` 还是 `@Provider`?要持久化该用 `AppStorage` 还是 `PersistenceV2`?V1 和 V2 怎么选?」**
>
> 本文以**选型决策为核心**，不复刻每个装饰器的完整 API 规格（V1/V2 官方文档链接见文末）。

## §0. 先建立地图：V1 / V2 两套生态并存

鸿蒙状态管理**两套并存**，装饰器同名不同义，**一个 struct 只能挑一列**（混用直接编译失败）：

| 作用 | V1（`@Component`） | V2（`@ComponentV2`） |
|------|-------------------|--------------------|
| 内部状态 | `@State` | `@Local` |
| 父传子只读 | `@Prop` | `@Param`（配 `@Once` 阻断更新） |
| 父传子双向 | `@Link`（父侧 `$field` 语法） | `@Param` + `@Event` 回调 |
| 对象深度观测 | `@Observed` + `@ObjectLink` | `@ObservedV2` + `@Trace`（类装饰器，可两套通用） |
| 跨层级通信 | `@Provide` + `@Consume` | `@Provider` + `@Consumer` |
| 全局状态 | `AppStorage` + `@StorageLink/@StorageProp` | `AppStorageV2.connect<T>(...)` |
| 持久化 | `PersistentStorage.persistProp` | `PersistenceV2.connect / globalConnect` |
| 派生值 | 普通方法 `getXxx()`（no-getter 约束） | `@Computed get xxx()`（no-getter 唯一豁免） |
| 监听变化 | 属性钩子 `xxx_?:` | `@Monitor('field')` |

```typescript
@ComponentV2
struct Bad1 {
  @State count: number = 0      // ❌ @ComponentV2 内用 @State 直接编译失败
}

@Component
struct Bad2 {
  @Local count: number = 0      // ❌ @Component 内用 @Local 直接编译失败
}
```

> 这是 [INSTRUCTIONS.md](../../INSTRUCTIONS.md) ArkTS 硬约束：V1/V2 装饰器不得同一 struct 混用。但**整个项目可以并存**——A 组件 `@Component` + `@State`、B 组件 `@ComponentV2` + `@Local` 互相调用没问题（`@Param` 接收 V1 `@State` 传入的值也合法）。

## §1. V1 / V2 选型硬决策（最先看）

| 场景 | 建议 | 理由 |
|------|------|------|
| **新项目 / 新组件** | 优先 **V2** | API 12+ 稳定，按属性刷新精度更高，`@Computed`/`@Monitor` 心智更轻 |
| **已有 V1 项目 / 维护老代码** | **继续 V1**，不要中途切 | 同 struct 内不能混，全量重构成本大 |
| **项目里既有 V1 也有 V2**（正常情况） | **按组件隔离**，不跨界 | 互传数据走 `@Param` / 普通参数 |
| 深度嵌套对象观测 | V1 用 `@Observed`+`@ObjectLink`（略繁琐），**V2 首选 `@ObservedV2`+`@Trace`** | `@Trace` 只通知真正用到该属性的组件 |
| 派生值（全价 = 单价 × 数量） | V1 用普通方法，**V2 首选 `@Computed`** | 自动追踪依赖，按需重算 |
| 监听变化做副作用 | V1 用 `xxx_?:` 钩子，**V2 用 `@Monitor('field')`** | 支持多字段、深度路径 |

三条硬纪律：

1. **一个 struct 只能走一条路**。起手 `@Component` 就从头到尾 V1，`@ComponentV2` 就从头到尾 V2
2. **V1/V2 互相传数据**走普通参数；`@Param` 能接收 V1 `@State` 传过来的值
3. **`@ObservedV2` + `@Trace` 是例外**：装饰**类**（不是组件），V1/V2 组件里都能 `new` 使用；但 `@Observed` 类不能在 V2 组件里配 `@ObjectLink`（`@ObjectLink` 本身是 V1 装饰器）

## §2. 选型决策树（核心章）

给定场景，从上往下第一条匹配就是答案：

| 场景 | V1 | V2 |
|------|----|----|
| A. 组件内部私有状态 | `@State` | `@Local` |
| B. 父传子，子只读 | `@Prop` | `@Param` |
| C. 父传子，子回传修改（双向） | `@Link`（父侧 `$field`） | 不存在"子直接双向改"：`@Param` 接值 + `@Event` 回调通知父改 |
| D. 对象内部字段变化要刷 UI | `@Observed` class + 子组件 `@ObjectLink` | `@ObservedV2` class + 属性 `@Trace`，无需拆子组件 |
| E. 数组元素对象变化 | 元素类 `@Observed`，ForEach 里 `@ObjectLink` | 元素类 `@ObservedV2` + `@Trace`，数组整体 `@Local`（基础类型数组直接 `@Local`，push/splice 可观察） |
| F. 跨层级共享（父 → 孙） | `@Provide('key')` / `@Consume('key')` | `@Provider('key')` / `@Consumer('key')`（必须本地初始化；两端都必须 `@ComponentV2`） |
| G. 应用级全局（登录态 / 主题） | `AppStorage` + `@StorageLink('key')` | `AppStorageV2.connect<T>(TypeCtor, () => new T())`（类须 `@ObservedV2` + `@Trace`） |
| H. 页面级状态 | `LocalStorage` 实例 + `@Entry(storage)` + `@LocalStorageLink` | `@Entry` 组件 `@Provider`，下层 `@Consumer`（V2 不再推荐 LocalStorage） |
| I. 持久化（重启还在） | `PersistentStorage.persistProp('key', default)` | `PersistenceV2.connect<T>(...)`（类 `@ObservedV2` + `@Trace`；数组用 `globalConnect`） |
| J. 派生值 | 没有原生支持，普通方法 `getTotal()`（**不能** `get total()`，no-getter 硬约束） | `@Computed get total()`，自动依赖追踪 |
| K. 监听字段变化做副作用 | 命名钩子 `xxx_?: (old, new) => void`（只在 `@Observed` class 内对属性生效） | `@Monitor('field') method(monitor: IMonitor): void`，更通用 |

## §3. 响应式失灵 Top 8 排查（超实用）

**症状 1：对象内部字段变了，UI 不刷新**（改了 `user.name`，Text 不更新）
原因：`@State` 只观测**整体赋值**。修法（V1）：类加 `@Observed`、子组件用 `@ObjectLink` 接；修法（V2）：`@ObservedV2` + `@Trace`，不用拆子组件。

**症状 2：数组 `arr.push(x)`，UI 不刷新**
原因：V1 对数组方法观测有版本要求。修法（V1 兜底）：`this.items = this.items.concat(['x'])` 整体替换；V2 `@Local` 数组原生支持 push/splice/pop，直接改。

**症状 3：`@Consume` 运行时抛异常**（"Cannot find @Provide"）
原因：祖先链上没有对应 key 的 `@Provide`。修法：API 20+ 给 `@Consume` 加默认值；API 20 前保证祖先有 `@Provide`，或改 V2 `@Consumer`。

**症状 4：`@Component` + `@Local` 同 struct，编译失败**
修法：整个 struct 要么 V1 要么 V2——改 `@ComponentV2` 或把 `@Local` 换 `@State`。

**症状 5：`@ObservedV2` 单用，属性变化不刷新**
修法：`@ObservedV2` 和 `@Trace` **必须成对**，需要观察哪个属性就在哪个属性上加。

**症状 6：`@ObjectLink` 接一个普通 class**
修法：给类加 `@Observed`。

**症状 7：`@Computed get` 在 V1 组件里用**
修法：改 `@ComponentV2`，或去掉 `get` 改普通方法 `getTotal()`。

**症状 8：AppStorage / V2 key 拼错，拿到默认值无声失效**
修法：**用字符串常量统一管理 key**：

```typescript
export const STORAGE_KEY_USER_NAME = 'userName'
@StorageLink(STORAGE_KEY_USER_NAME) userName: string = ''
```

## §4. 存储三件套选型（AppStorage / LocalStorage / PersistenceV2）

| 维度 | `AppStorage` / `AppStorageV2` | `LocalStorage`(V1) | `PersistentStorage` / `PersistenceV2` |
|------|------|------|------|
| 作用域 | **进程级**全局，跨组件 / 页面 / UIAbility | **单个实例**，绑 `@Entry(storage)` | **进程级** + **硬盘持久化** |
| 进程销毁 | 数据丢失 | 数据丢失 | **保留**，下次启动还在 |
| 典型场景 | 登录态、全局主题、多 Tab 共享 | 单页内部跨组件共享（V2 更推荐 `@Provider`） | 用户偏好、登录 token、小配置 |
| V2 API | `AppStorageV2.connect(T, ...)!` | （V2 不再推荐） | `PersistenceV2.connect(T, ...)!` |
| 常见坑 | key 拼错静默失效 | `@Entry(storage)` 的 storage 必须模块级 | 存大对象卡启动；`collections.Array` 要 `globalConnect` |

选型决策：跨组件 / 页面 / UIAbility 共享 → `AppStorage` / `AppStorageV2`；只在页面内共享 → V2 首选 `@Provider`/`@Consumer`；要活过进程销毁 → `PersistentStorage` / `PersistenceV2`；**大列表数据不要用 Storage 存**，用数据库（`@ohos.data.relationalStore`）或文件。

## §5. 速查（必抄骨架）

### V1 套路四段

```typescript
// 1. 内部状态 + 父传子
@Component
struct App {
  @State count: number = 0
  build() { Child({ v: this.count }) }
}
@Component
struct Child { @Prop v: number = 0; build() { Text(this.v + '') } }

// 2. 对象深度观测
@Observed class Task { done: boolean = false }
@Component
struct Row { @ObjectLink task: Task; build() { Text('' + this.task.done) } }

// 3. 跨层级
@Component
struct App2 { @Provide('theme') theme: string = 'light'; build() { Sub() } }
@Component
struct Sub { @Consume('theme') theme: string = 'light'; build() { Text(this.theme) } }

// 4. 全局
AppStorage.setOrCreate<string>('userName', 'Alice')
@Component
struct H { @StorageLink('userName') u: string = ''; build() { Text(this.u) } }
```

### V2 套路四段

```typescript
import { AppStorageV2, PersistenceV2 } from '@kit.ArkUI'

// 1. 内部状态 + 父传子
@ComponentV2
struct App {
  @Local count: number = 0
  build() { Child({ v: this.count }) }
}
@ComponentV2
struct Child { @Param v: number = 0; build() { Text(this.v + '') } }

// 2. 对象深度观测
@ObservedV2 class Task { @Trace done: boolean = false }
@ComponentV2
struct Row {
  @Local task: Task = new Task()
  build() { Text('' + this.task.done) }
}

// 3. 跨层级（@Consumer 必须本地初始化）
@ComponentV2
struct AppV2 { @Provider('theme') theme: string = 'light'; build() { SubV2() } }
@ComponentV2
struct SubV2 { @Consumer('theme') theme: string = 'dark'; build() { Text(this.theme) } }

// 4. 全局 / 持久化
@ObservedV2
class UserSession {
  @Trace userName: string = ''
  @Trace loggedIn: boolean = false
}
@ComponentV2
struct Header {
  @Local session: UserSession = AppStorageV2.connect<UserSession>(
    UserSession, (): UserSession => new UserSession())!
  build() { Text(this.session.userName) }
}

// 派生值（V2 专属）
@ObservedV2
class Cart {
  @Trace price: number = 0
  @Trace quantity: number = 0
  @Computed get total(): number { return this.price * this.quantity }
}
```

### 九条硬纪律

1. **V1/V2 装饰器不得在同一 `struct` 内混用**（INSTRUCTIONS.md 硬约束）
2. `@Link` 禁止设默认值（编译报错）
3. `@Observed` 的**子类继承时必须也 `@Observed`**，否则深度观测失效
4. `@ObservedV2` 和 `@Trace` **必须成对**，单独用无效
5. `@Param` **只读**，子组件要改值走 `@Event` 回调
6. `@Computed get xxx()` 是 V2 对 no-getter 硬约束的**唯一豁免**；V1 或非 `@Computed` 的 `get` 一律禁用
7. `@Consumer`（V2）**必须本地初始化**
8. `AppStorage` / `AppStorageV2` 的 key **必须用字符串常量统一管理**，防拼写错误
9. `PersistenceV2` **只存小配置**，大列表数据用数据库 / 文件

### 引用链接

- V1 `@Observed`/`@ObjectLink` → [官方原文](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-observed-and-objectlink)；`@Provide`/`@Consume` → [官方原文](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-provide-and-consume)；`AppStorage` → [官方原文](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-appstorage)
- V2 `@Local`/`@Param` → [官方原文](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-new-local)、[官方原文](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-new-param)；`@ObservedV2`/`@Trace` → [官方原文](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-new-observedv2-and-trace)；`@Provider`/`@Consumer` → [官方原文](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-new-provider-and-consumer)
- `AppStorageV2` → [官方原文](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-new-appstoragev2)；`PersistenceV2` → [官方原文](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-new-persistencev2)
- 状态管理概述 → [arkts-state-management-overview](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-state-management-overview)；MVVM V2 范式 → [arkts-mvvm-v2](https://developer.huawei.com/consumer/cn/doc/harmonyos-guides/arkts-mvvm-v2)
