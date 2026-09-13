import { ZodFirstPartyTypeKind, type ZodType, type ZodTypeAny } from 'zod';

function unwrap(schema: ZodTypeAny): { inner: ZodTypeAny; optional: boolean } {
  let inner = schema;
  let optional = false;
  while (inner._def?.typeName === ZodFirstPartyTypeKind.ZodOptional || inner._def?.typeName === ZodFirstPartyTypeKind.ZodDefault) {
    optional = true;
    inner = inner._def.innerType ?? inner._def.schema ?? inner;
  }
  return { inner, optional };
}

function nodeToJson(schema: ZodTypeAny): Record<string, unknown> {
  const { inner } = unwrap(schema);
  const typeName = inner._def?.typeName as ZodFirstPartyTypeKind | undefined;
  const description = inner.description;

  switch (typeName) {
    case ZodFirstPartyTypeKind.ZodString:
      return { type: 'string', ...(description ? { description } : {}) };
    case ZodFirstPartyTypeKind.ZodNumber:
      return { type: 'number', ...(description ? { description } : {}) };
    case ZodFirstPartyTypeKind.ZodBoolean:
      return { type: 'boolean', ...(description ? { description } : {}) };
    case ZodFirstPartyTypeKind.ZodEnum:
      return {
        type: 'string',
        enum: inner._def.values,
        ...(description ? { description } : {}),
      };
    case ZodFirstPartyTypeKind.ZodObject:
      return zodObjectToJsonSchema(inner);
    default:
      return { ...(description ? { description } : {}) };
  }
}

export function zodObjectToJsonSchema(schema: ZodType): Record<string, unknown> {
  const { inner } = unwrap(schema as ZodTypeAny);
  if (inner._def?.typeName !== ZodFirstPartyTypeKind.ZodObject) {
    return { type: 'object', additionalProperties: false, properties: {} };
  }
  const shape = inner._def.shape();
  const properties: Record<string, unknown> = {};
  const required: string[] = [];
  for (const [key, value] of Object.entries(shape as Record<string, ZodTypeAny>)) {
    const { optional } = unwrap(value);
    properties[key] = nodeToJson(value);
    if (!optional) required.push(key);
  }
  return {
    type: 'object',
    additionalProperties: false,
    properties,
    ...(required.length ? { required } : {}),
  };
}
