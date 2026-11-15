export interface JsonEnvelope<T> {
  ok: true;
  data: T;
  meta?: Record<string, unknown>;
}

export function printResult<T>(
  data: T,
  options: { json: boolean; human: () => string; meta?: Record<string, unknown> }
): void {
  if (options.json) {
    const envelope: JsonEnvelope<T> = { ok: true, data };
    if (options.meta) envelope.meta = options.meta;
    process.stdout.write(`${JSON.stringify(envelope, null, 2)}\n`);
    return;
  }
  process.stdout.write(`${options.human()}\n`);
}

export function printError(error: unknown, json: boolean): void {
  const message = error instanceof Error ? error.message : String(error);
  if (json) {
    process.stdout.write(
      `${JSON.stringify(
        {
          ok: false,
          error: {
            code: "HUAWEI_DOCS_ERROR",
            message
          }
        },
        null,
        2
      )}\n`
    );
  } else {
    process.stderr.write(`错误：${message}\n`);
  }
}
