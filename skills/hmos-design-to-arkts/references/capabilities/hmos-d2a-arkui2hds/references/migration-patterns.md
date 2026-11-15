# 接入方式和迁移模式

## 目录

- [适用场景](#适用场景)
- [方式一：组件平替（适合标准组件替换）](#方式一组件平替适合标准组件替换)
- [方式二：重构替换（适合自定义组件替换）](#方式二重构替换适合自定义组件替换)

## 适用场景

适用场景与支持范围见 [INSTRUCTIONS.md](../INSTRUCTIONS.md) 的「适用场景」节。

---

## 方式一：组件平替（适合标准组件替换）

### 步骤

1. 识别目标界面中的标准 ArkUI 组件（Tabs、Navigation 等）
2. 导入对应的 HDS 组件
3. 替换组件名称（**仅替换主组件，子组件保持不变**）
4. 替换控制器类型（如 TabsController → HdsTabsController）
5. **默认配置 HDS 新特性**（悬浮效果、材质效果等）
6. 调整样式以匹配设计规范

### 重要原则 - 什么需要改，什么不需要改

#### 需要修改的：
- **主组件名称**：`Tabs` → `HdsTabs`
- **控制器类型**：`TabsController` → `HdsTabsController`
- **导入语句**：添加 HDS 组件和控制器的导入
- **默认配置 HDS 新特性**：添加悬浮效果和材质效果配置

#### 不需要修改的：
- **TabContent**：保持不变，不需要改成 HdsTabContent
- **SubTabBarStyle**：保持不变，不需要改成 HdsSubTabBarStyle
- **BottomTabBarStyle**：保持不变，不需要改成 HdsBottomTabBarStyle
- **其余原生组件**：Scroll、Column、Row 等保持不变

### 示例

```typescript
// 原代码
// Tabs 是原生组件，不需要导入

private tabsController: TabsController = new TabsController();

Tabs({ controller: this.tabsController }) {
  TabContent() {
    Text('内容1')
  }
  .tabBar('页签1')

  TabContent() {
    Text('内容2')
  }
  .tabBar('页签2')
}
.barHeight(48)

// 替换后（默认配置 HDS 新特性）
import { HdsTabs, DividerMode, hdsMaterial, HdsTabsController } from '@kit.UIDesignKit';

private tabsController: HdsTabsController = new HdsTabsController();

HdsTabs({ controller: this.tabsController }) {
  TabContent() {  // 保持不变，不需要改成 HdsTabContent
    Text('内容1')
  }
  .tabBar('页签1')  // 保持不变

  TabContent() {  // 保持不变，不需要改成 HdsTabContent
    Text('内容2')
  }
  .tabBar('页签2')  // 保持不变
}
.barHeight(48)
.barPosition(BarPosition.End)
.barOverlap(true)  // 开启页签栏叠加效果
// 默认配置：分割线样式（跟手渐变显隐）
.divider({
  mode: DividerMode.FOLLOW_SCROLL,
  style: {
    strokeWidth: 0.5,
    color: 0x1A000000
  }
})
// 默认配置：悬浮页签栏和材质效果（6.1 新特性）
.barFloatingStyle({
  barBottomMargin: 28,
  systemMaterialEffect: {
    materialType: hdsMaterial.MaterialType.IMMERSIVE,
    materialLevel: hdsMaterial.MaterialLevel.ADAPTIVE
  }
})
```

### 默认配置说明

**为什么默认配置 HDS 新特性？**
- 三方应用使用 HDS 组件的主要目的就是体验新特性
- 悬浮效果和材质效果是 6.1 版本的核心特性
- 默认配置可以让开发者快速获得最佳视觉效果

**默认配置包含：**（必配口径以 [INSTRUCTIONS.md](../INSTRUCTIONS.md) 的「重要原则」节为准）
1. `barOverlap(true)` - 页签栏背后变模糊并叠加在 TabContent 之上（悬浮前提，必配）
2. `divider` - 分割线跟手渐变显隐（推荐默认，`style: { strokeWidth, color }` 嵌套形态）
3. `barFloatingStyle` - 悬浮页签栏配置（systemMaterialEffect 嵌套于 barFloatingStyle 内，必配）

**可选配置：**
- `barWidth` - 页签栏宽度（支持 `small`、`medium`、`large` 三种尺寸，不配置则使用默认全屏宽度）
- `barSideMargin` - 页签栏左右边距（仅在配置 barWidth 时生效）
- `barBottomMargin` - 页签栏底部边距
- `gradientMask` - 渐变遮罩，如 `gradientMask: { maskColor: '#66F1F3F5', maskHeight: 92 }`

### 注意事项

1. **只替换主组件**：HdsTabs 是对原生 Tabs 的增强包装，TabContent 仍然是原生组件
2. **控制器必须替换**：HdsTabsController 继承自 TabsController，但提供了额外的 HDS 特性控制方法
3. **样式类保持不变**：SubTabBarStyle、BottomTabBarStyle 等样式类不需要加 Hds 前缀
4. **默认配置新特性**：切换到 HDS 组件时，默认配置悬浮效果和材质效果，以获得最佳体验

---

## 方式二：重构替换（适合自定义组件替换）

### 识别基础容器实现

在重构替换场景中，需要识别使用基础容器（Column、Row 等）拼出的 UI 效果，判断是否适合替换为 HDS 组件。详见 [components.md](components.md) 中的组件识别特征表。

### 步骤

1. 识别目标界面中的自定义组件实现（包括基础容器拼出的效果）
2. 提取组件的核心功能和样式
3. 创建 HDS 组件封装
4. 支持通过开关切换原组件和 HDS 组件
5. 逐步迁移到 HDS 组件

### 示例

```typescript
// 定义开关
const USE_HDS_COMPONENTS = true;

// 原自定义 BottomBar 组件
@ComponentV2
struct CustomBottomBar {
  @Param actions: BottomBarAction[] = [];

  build() {
    if (USE_HDS_COMPONENTS) {
      // 使用HDS组件
      this.HdsActionBarBuild();
    } else {
      // 原实现
      this.OriginalBottomBarBuild();
    }
  }

  @Builder
  HdsActionBarBuild() {
    HdsActionBar({
      startButtons: this.actions.filter(a => a.position === 'start').map(a => new ActionBarButton({
        baseIcon: a.icon,
        onClick: a.onClick
      })),
      endButtons: this.actions.filter(a => a.position === 'end').map(a => new ActionBarButton({
        baseIcon: a.icon,
        onClick: a.onClick
      })),
      actionBarStyle: new ActionBarStyle({
        height: 56,
        backgroundBlurStyle: BlurStyle.COMPONENT_REGULAR
      })
    });
  }

  @Builder
  OriginalBottomBarBuild() {
    Row() {
      // 原自定义实现
    }
    .height(56)
    .backgroundColor('#FFFFFF')
  }
}
```
