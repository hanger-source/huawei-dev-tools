declare module "@deveco-codegenie/mcp-bridge" {
  export interface McpBridge {
    init(
      logDirectory: string,
      worktree: string,
      devecoHome: string,
      modelBaseUrl: string | null,
      modelApiKey: string | null,
      modelName: string | null
    ): Promise<void>;
    listTools(): string;
    callTool(toolName: string, argsJson: string): Promise<string>;
    stop(): Promise<void>;
  }

  const bridge: McpBridge;
  export default bridge;
}
