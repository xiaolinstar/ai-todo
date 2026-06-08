import { startStdioServer } from "./server";

startStdioServer().catch((error: unknown) => {
  console.error("ai-todo-mcp failed to start:", error);
  process.exit(1);
});
