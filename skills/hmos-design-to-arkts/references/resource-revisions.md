# 导入后的资源修正

Pixso/Figma、Full/Fast 均适用。第一次资源导入后，真机验证或视觉校准发现图片错误时，先读取本文件。即使只修一张图，也不能直接向工程 `resources/base/media` 复制图片或用脚本覆盖；使用下面的受保护修订路径。CLI 无法阻止宿主 Agent 自行写文件，最终必须验证一致性。

1. **获取真实修正资源。** 从实际来源 MCP 获取对应图片，保留来源节点及获取证据，存入本 run 的新 acquisition 子目录。保留原始 source、exports、resources、旧修订和导入历史。准备覆盖当前页面全部 imageIds 的 PNG 集合：未变化图片可从当前成功导入版本复制到新的暂存目录，变化图片来自本次真实获取，不用占位图或改写旧 manifest。
2. **创建候选修订。** 执行 `devecocli d2a resources prepare --project <root> --run <id> --page-name <PageName> --assets <新暂存目录> --revise --output json`，需要时加 `--mapping <映射文件>`。CLI 保存不可覆盖的 `resource-revisions/<PageName>/<resourceRevision>/` 并返回 resourceRevision UUID；此时工程文件及导入历史没有变化。CLI 已配置 imageExport 时也可使用 `--revise --fetch --url <设计链接> [--mcp <服务名>]`。来源由已保存 run 锁定，Pixso/Figma 使用同一修订流程。
3. **审阅写入计划。** 执行 `devecocli d2a import page --project <root> --run <id> --dry-run --module <原模块> --page-name <PageName> --resource-revision <resourceRevision> --output json`。审阅返回的 planPath 与 diff，确认只有本页面图片，没有 ETS 或路由改动；二进制差异会显示修改前后的 SHA-256，需要时实际查看新旧图片。
4. **应用修订。** 在用户已授权范围和原 Skill 确认规则下执行 `devecocli d2a import page --project <root> --run <id> --apply --plan <planPath> --output json`。不在 apply 重传 module、page-name 或 resource-revision。CLI 在原项目锁内重验资源基线、来源/页面/模块归属、其余页面的图片引用、文件身份和计划；成功后更新图片及其导入记录，保留项目页面代码和原页面哈希。失败按原规则回滚，不能改历史或清单强行继续。
5. **验证实际结果。** 重跑受影响的检查并重新构建部署，打开目标页面、获取新截图并实际查看；保留实际修复与部署证据，按原流程继续视觉校准。最后执行 `devecocli d2a verify --project <root> --run <id> --output json`，读取实际检查项及返回的报告路径。`imported-files` 等完整性项失败必须报告失败；没有请求工程检查时整体 partial 不等于编译或视觉失败，也不表示这些检查已执行。页面代码有后续改动时也会被检出，资源修订不会替页面改动补写成功记录。

资源修订要求同一 run、同一已导入页面和模块，保留原 imageIds，不负责增删资源名或修改页面代码。第一次导入尚未完成时仍走普通 resources prepare 和 import。其余页面使用的共享图片不能借修订覆盖；应按页面及资源命名重新设计修复，不能绕过保护。新版本已导入后，基于旧版本的候选修订会失效，须重新准备并审阅。

如果当前工程图片已与 import-history 不一致，先保留真实文件、旧清单和执行记录并报告阻塞，不能手改哈希或用本命令把未经审阅的写入变成合法导入。测试场景可保留问题工程，在新建的独立工程重放完整步骤；不得自动清空或回滚用户工程。
