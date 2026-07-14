# Contract: WebMCP Tool Definition & Action Plan Schema

**Date**: 2026-07-08
**Source of truth**: `src/shared/types.ts` (ToolDefinition, Action)

This contract defines the schema the AI must produce and the content script must consume.
It is the bridge between the analyzer output and `navigator.webmcp.registerTool()`.

---

## WebMCP registerTool() Call Shape

The content script calls the imperative WebMCP API once per `ToolDefinition`:

```typescript
navigator.webmcp.registerTool({
  name: tool.name,
  description: tool.description,
  inputSchema: {
    type: 'object',
    properties: Object.fromEntries(
      Object.entries(tool.parameters).map(([key, param]) => [
        key,
        {
          type: param.type,
          description: param.description,
          ...(param.enum ? { enum: param.enum } : {}),
        },
      ])
    ),
    required: Object.entries(tool.parameters)
      .filter(([, p]) => p.required)
      .map(([k]) => k),
  },
  handler: async (params: Record<string, unknown>) => {
    return await executeActionPlan(tool.actions, params);
  },
});
```

---

## ToolDefinition Schema (JSON Schema for AI response validation)

```json
{
  "$schema": "http://json-schema.org/draft-07/schema",
  "type": "object",
  "title": "ToolDefinition",
  "required": ["name", "description", "parameters", "actions"],
  "properties": {
    "name": {
      "type": "string",
      "pattern": "^[a-z][a-z0-9_]*$",
      "maxLength": 64,
      "description": "Unique snake_case tool name"
    },
    "description": {
      "type": "string",
      "maxLength": 256,
      "description": "Human-readable description of what the tool does"
    },
    "parameters": {
      "type": "object",
      "additionalProperties": {
        "$ref": "#/definitions/ToolParameter"
      }
    },
    "actions": {
      "type": "array",
      "minItems": 1,
      "items": { "$ref": "#/definitions/Action" }
    }
  },
  "definitions": {
    "ToolParameter": {
      "type": "object",
      "required": ["type", "description", "required"],
      "properties": {
        "type": { "type": "string", "enum": ["string", "number", "boolean"] },
        "description": { "type": "string", "maxLength": 128 },
        "required": { "type": "boolean" },
        "enum": {
          "type": "array",
          "items": { "type": "string" }
        }
      }
    },
    "Action": {
      "oneOf": [
        {
          "type": "object",
          "required": ["type", "selector", "paramName"],
          "properties": {
            "type": { "const": "fill" },
            "selector": { "type": "string" },
            "paramName": { "type": "string" }
          }
        },
        {
          "type": "object",
          "required": ["type", "selector"],
          "properties": {
            "type": { "const": "click" },
            "selector": { "type": "string" }
          }
        },
        {
          "type": "object",
          "required": ["type", "selector", "paramName"],
          "properties": {
            "type": { "const": "select" },
            "selector": { "type": "string" },
            "paramName": { "type": "string" }
          }
        },
        {
          "type": "object",
          "required": ["type", "selector", "paramName"],
          "properties": {
            "type": { "const": "check" },
            "selector": { "type": "string" },
            "paramName": { "type": "string" }
          }
        },
        {
          "type": "object",
          "required": ["type", "selector"],
          "properties": {
            "type": { "const": "submit" },
            "selector": { "type": "string" }
          }
        }
      ]
    }
  }
}
```

---

## AI System Prompt Contract

The system prompt sent to the AI analyzer. The analyzer implementations MUST use this verbatim.
Defined as `PAGE_ANALYSIS_SYSTEM_PROMPT` in `src/background/analyzer/types.ts`.

```
You are a web page analyzer. Given a structured description of interactive elements on a web
page, output a JSON array of WebMCP tool definitions.

Rules:
- Each tool represents one logical user action (e.g. "subscribe to newsletter", "search for product")
- Group related elements (e.g. all inputs in a single form) into one tool
- Standalone elements (e.g. a search box not in a form) become individual tools
- Tool names MUST be unique, snake_case, max 64 chars, start with a letter
- Descriptions MUST be clear and action-oriented (e.g. "Fill and submit the email subscription form")
- Parameters map to form inputs that the agent needs to supply values for
- Actions MUST use only these types: fill, click, select, check, submit
- Use the exact CSS selectors provided in the element list
- Omit hidden, disabled, or decorative elements
- If no meaningful tools can be inferred, return an empty array []

Output format: a JSON array of ToolDefinition objects matching the provided schema.
```

---

## Concrete Example

**Page**: A newsletter subscription form with an email input and submit button.

**PageContext input** (abridged):
```json
{
  "url": "https://example.com/",
  "title": "Example Site",
  "elements": [
    {
      "tag": "input", "type": "email", "id": "email",
      "placeholder": "Enter your email", "labelText": "Email address",
      "selector": "#email", "inViewport": true, "formSelector": "#subscribe-form"
    },
    {
      "tag": "button", "type": "submit",
      "labelText": "Subscribe", "selector": "#subscribe-form button[type=submit]",
      "inViewport": true, "formSelector": "#subscribe-form"
    }
  ]
}
```

**ToolDefinition output**:
```json
[
  {
    "name": "subscribe_newsletter",
    "description": "Fill and submit the email subscription form",
    "parameters": {
      "email": {
        "type": "string",
        "description": "Email address to subscribe with",
        "required": true
      }
    },
    "actions": [
      { "type": "fill",   "selector": "#email", "paramName": "email" },
      { "type": "submit", "selector": "#subscribe-form" }
    ]
  }
]
```
