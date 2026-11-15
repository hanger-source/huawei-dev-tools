/** 文档中的 6.1.1(24) 表示 API 24；26 起使用完整语义化 API 版本。 */
export function parseApiVersion(value: string | null): string | null {
  if (!value) return null;
  const plain = value.replace(/[*`]/g, "").trim();
  const legacy = /^(?:HarmonyOS\s*)?\d+\.\d+\.\d+\s*[（(](\d+)[）)]/i.exec(plain);
  if (legacy) return legacy[1];
  const match = /^(?:API\s*(?:version|版本)?\s*)?(\d+(?:\.\d+\.\d+)?)(?=\s|$|[，。；;])/i.exec(plain);
  if (!match) return null;
  if (match[1].includes(".") && Number(match[1].split(".")[0]) < 26) return null;
  return match[1];
}

export function compareApiVersions(left: string | number, right: string | number): number {
  const a = String(left).split(".").map(Number);
  const b = String(right).split(".").map(Number);
  for (let i = 0; i < 3; i++) {
    const delta = (a[i] || 0) - (b[i] || 0);
    if (delta) return Math.sign(delta);
  }
  return 0;
}
