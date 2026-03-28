import { Composio } from "@composio/core";
import { ClaudeAgentSDKProvider} from "@composio/claude-agent-sdk";
import { createSdkMcpServer, query } from "@anthropic-ai/claude-agent-sdk";

// Initialize Composio
const composio = new Composio({
  apiKey: "ak_N3AMM09fMl7wpzjPXhDn",
  provider: new ClaudeAgentSDKProvider(),
});

const externalUserId = "pg-test-dfd7328d-3efb-41f3-a945-b73acdea0000";

// Create a tool router session
const session = await composio.create(externalUserId);
// Get tools from the session (native)
const tools = await session.tools();

const customServer = createSdkMcpServer({
  name: "composio",
  version: "1.0.0",
  tools: tools,
});

// Initialize Claude client
for await (const content of query({
  prompt: "Send an email to gorcho@gmail.com saying hello",
  options: {
    mcpServers: { composio: customServer },
    permissionMode: "bypassPermissions",
  },
})) {
  if (content.type === "assistant") {
    console.log("Claude:", content.message);
  }
}

console.log(`✅ Received response from Claude`);
