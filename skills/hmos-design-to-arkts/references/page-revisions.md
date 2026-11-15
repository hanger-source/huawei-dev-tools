# 导入后的页面代码修订

本约定适用于 Pixso/Figma 的 Fast/Full 全部流程，以及它们调用的能力。第一次导入后，补全交互、修复 ArkTS/HDS/布局问题和视觉校准仍在原阶段执行；不重启 Controller、不跳过确认或 Gate。仅把页面代码写入改为下面的受保护流程。

## 保存候选，再写入工程

1. 读取工程当前页面和成功导入记录。把要修改的完整 ETS 保存到本 run 的新 acquisition 子目录，在该副本上补全交互或修正代码；不要先改工程页面、原 exports、source、历史记录或哈希。
2. 准备图片名称 JSON 数组，必须与原导出的稳定 media 名称集合一致。Figma 使用原名称；Pixso 使用资源清单中的 `assets[].name` 去掉 `.png` 的名称，例如 `pixso_1_2`，不是原始节点 ID。保留未使用但仍归属本页的原名称，不新增或重命名资源。图片字节变化另走 [资源修订](resource-revisions.md)。
3. 使用原 project/run/page-name 执行：

   ```bash
   devecocli d2a export arkts-page --project <项目> --run <runId> --page-name <PageName> --input <候选ETS> --image-ids <JSON数组文件> --revise --output json
   ```

   返回 `pageRevision` UUID 和 manifestPath。CLI 先校验原输入、导出、成功导入记录及工程中已登记文件的实际哈希，再保存不可覆盖的 `page-revisions/<PageName>/<UUID>/`。候选由 Agent 生成，绑定原导出、输入、页面路径与当前成功记录；不会写工程或推进阶段。

4. 生成仅写原页面 ETS 的计划并审阅 diff：

   ```bash
   devecocli d2a import page --project <项目> --run <runId> --module <原模块> --page-name <PageName> --dry-run --page-revision <pageRevision> --output json
   ```

   不能混用 `--resource-revision`。计划只写原页面文件，不改图片、路由或其余页面。保留原 Skill 的确认与用户授权要求。

5. 在授权范围内应用已审阅计划；不要再次传 module/page-name/revision：

   ```bash
   devecocli d2a import page --project <项目> --run <runId> --apply --plan <planPath> --output json
   ```

   apply 在原项目锁内重新校验候选、成功记录、工程目标和历史冲突。成功后更新该 ETS 的导入哈希及 pageRevision，保留图片哈希、resourceRevision、原导出、旧代码候选和其余历史。普通失败沿用回滚；进程中断不保证多文件原子完成。

6. 按原阶段执行实际静态检查、构建、部署、截图和必要评分。有新修正时基于最新成功页面生成新候选，不能覆盖旧候选。最后执行 `d2a verify --project <项目> --run <runId> --output json` 并读取结果；未请求的工程检查仍为未执行，完整性通过不等于编译或视觉通过。

## 拒绝与恢复

1. 工程页面或图片已偏离成功记录时，候选创建、计划或 apply 会拒绝。不要先直接改工程再用修订“登记”这些修改；也不改写历史哈希。保留工作副本和真实错误，依据已授权的恢复计划处理原目标后再生成候选，不能自动覆盖用户修改。
2. 候选绑定的成功记录发生变化时必须重新创建候选、生成并审阅计划；例如另一个代码候选或图片修订先被应用。不能修改旧候选基线来强行继续。
3. 原模块、页面和 run 不能改用别名文件、硬链接或另一个数据目录来绕过保护。跨目录历史、输入/导出/资源哈希、路径/符号链接、项目锁、过期计划与失败回滚规则继续生效。
4. 已成功候选被删除或损坏时，不回退为旧导出；普通重导入及 verify 使用该成功版本并报告缺失。保留文件并调查原因，不删除指针或历史规避错误。

本入口只修订单个已导入页面的代码，保留原图片名称集合。新增资源名称、修改其余文件及页面重命名不在此入口范围内；遵循各自的工程约定和用户授权，不扩大写入计划。
