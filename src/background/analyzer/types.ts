import type { AnalyzerRequest, AnalyzerResponse } from '../../shared/types';

export interface Analyzer {
  analyze(request: AnalyzerRequest): Promise<AnalyzerResponse>;
}

export const TOOL_DEFINITIONS_SCHEMA = {
  type: 'array',
  items: {
    type: 'object',
    required: ['name', 'description', 'parameters', 'actions'],
    properties: {
      name: { type: 'string', pattern: '^[a-z][a-z0-9_]*$', maxLength: 64 },
      description: { type: 'string', maxLength: 256 },
      parameters: {
        type: 'object',
        additionalProperties: {
          type: 'object',
          required: ['type', 'description', 'required'],
          properties: {
            type: { type: 'string', enum: ['string', 'number', 'boolean'] },
            description: { type: 'string', maxLength: 128 },
            required: { type: 'boolean' },
            enum: { type: 'array', items: { type: 'string' } },
          },
        },
      },
      actions: {
        type: 'array',
        minItems: 1,
        items: {
          oneOf: [
            {
              type: 'object',
              required: ['type', 'selector', 'paramName'],
              properties: {
                type: { const: 'fill' },
                selector: { type: 'string' },
                paramName: { type: 'string' },
              },
            },
            {
              type: 'object',
              required: ['type', 'selector'],
              properties: {
                type: { const: 'click' },
                selector: { type: 'string' },
              },
            },
            {
              type: 'object',
              required: ['type', 'selector', 'paramName'],
              properties: {
                type: { const: 'select' },
                selector: { type: 'string' },
                paramName: { type: 'string' },
              },
            },
            {
              type: 'object',
              required: ['type', 'selector', 'paramName'],
              properties: {
                type: { const: 'check' },
                selector: { type: 'string' },
                paramName: { type: 'string' },
              },
            },
            {
              type: 'object',
              required: ['type', 'selector'],
              properties: {
                type: { const: 'submit' },
                selector: { type: 'string' },
              },
            },
            {
              type: 'object',
              required: ['type', 'selector'],
              properties: {
                type: { const: 'enter' },
                selector: { type: 'string' },
              },
            },
          ],
        },
      },
    },
  },
} as const;
