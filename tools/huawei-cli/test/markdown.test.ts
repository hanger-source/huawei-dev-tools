import { describe, expect, it } from "vitest";
import {
  evaluateCompatibility,
  extractSection,
  parseHeadings,
  parseSectionMetadata
} from "../src/markdown.js";
import { VERSION_PROFILES } from "../src/constants.js";

const fixture = `# oh_input_manager.h

#### 概述

起始版本： 12

#### OH_Input_InjectTouchEvent()

\`\`\`
int32_t OH_Input_InjectTouchEvent(const struct Input_TouchEvent* touchEvent)
\`\`\`

从API version 20开始，建议先请求授权。

从API版本26.0.0开始，持有权限的调用方也可以直接使用本接口。

设备行为差异：该接口在PC/2in1设备中可正常调用，在其他设备上调用无效果。

需要权限： ohos.permission.CONTROL_DEVICE

起始版本： 12

#### OH_Input_InjectMouseEvent()

下一节。
`;

describe("markdown parsing", () => {
  it("parses headings and Huawei-style anchors", () => {
    const headings = parseHeadings(fixture);
    expect(headings.some((item) => item.anchor === "oh_input_injecttouchevent")).toBe(true);
  });

  it("matches Huawei duplicate heading anchors", () => {
    const headings = parseHeadings("# 文档\n\n#### 场景描述\n\nA\n\n#### 场景描述\n\nB");
    expect(headings.map((item) => item.anchor)).toEqual(["文档", "场景描述", "场景描述-1"]);
    expect(extractSection("# 文档\n\n#### 场景描述\n\nA\n\n#### 场景描述\n\nB", "场景描述-1")?.content).toContain("B");
  });

  it("extracts exactly one symbol section", () => {
    const section = extractSection(fixture, "OH_Input_InjectTouchEvent");
    expect(section?.content).toContain("CONTROL_DEVICE");
    expect(section?.content).not.toContain("下一节");
  });

  it("marks HarmonyOS 6 Phone input injection unsupported", () => {
    const section = extractSection(fixture, "OH_Input_InjectTouchEvent");
    expect(section).not.toBeNull();
    const metadata = parseSectionMetadata(section!.content, 22);
    expect(metadata.sinceVersion).toBe("12");
    expect(metadata.laterVersionNotes[0]?.version).toBe("26.0.0");
    const verdict = evaluateCompatibility(
      section!.content,
      metadata,
      VERSION_PROFILES["6"],
      "Phone"
    );
    expect(verdict.verdict).toBe("unsupported");
    expect(verdict.deviceStatus).toBe("unsupported");
  });

  it("distinguishes API 26 patch versions and legacy SDK notation in official Markdown", () => {
    const content = "### Example()\n\n**起始版本：** 26.0.1\n\n**设备行为差异**：该接口在Phone设备中可正常调用。";
    const metadata = parseSectionMetadata(content, "26.0.0");
    expect(evaluateCompatibility(content, metadata, VERSION_PROFILES["26.0.0"], "Phone").verdict).toBe("unsupported");
    expect(evaluateCompatibility(content, metadata, VERSION_PROFILES["26.0.1"], "Phone").verdict).toBe("supported");
    const old = parseSectionMetadata("**起始版本：** 6.1.1(24)", "26.0.0");
    expect(old.sinceVersion).toBe("24");
    expect(metadata.deviceBehavior).toHaveLength(1);
  });
});
