import { z } from 'zod';

export const conversationIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const createConversationSchema = z
  .object({
    title: z.string().trim().min(1).max(200).optional(),
  })
  .strip();

export const clientContextSchema = z
  .object({
    currentPath: z.string().trim().max(500).optional(),
    pageTitle: z.string().trim().max(300).optional(),
    documentId: z.string().trim().max(80).optional(),
    documentStatus: z.string().trim().max(40).optional(),
    formErrors: z.array(z.string().trim().max(500)).max(8).optional(),
  })
  .strip()
  .optional();

export const chatBodySchema = z
  .object({
    conversationId: z.string().uuid().optional(),
    message: z.string().trim().min(1).max(20000),
    title: z.string().trim().min(1).max(200).optional(),
    stream: z.boolean().optional(),
    clientContext: clientContextSchema,
  })
  .strip();

export const sendMessageSchema = z
  .object({
    message: z.string().trim().min(1).max(20000),
    stream: z.boolean().optional(),
    clientContext: clientContextSchema,
  })
  .strip();

export const actionIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const acknowledgeActionSchema = z
  .object({
    resultingEntityId: z.string().uuid(),
    documentNumber: z.string().trim().max(80).optional(),
  })
  .strip();

export const insightIdParamSchema = z.object({
  id: z.string().uuid(),
});

export const ocrCreateItemSchema = z
  .object({
    lineIndex: z.number().int().nonnegative(),
  })
  .strip();

export const diagnoseErrorBodySchema = z
  .object({
    errorCode: z.string().trim().min(1).max(80),
    errorMessage: z.string().trim().max(2000).optional(),
    currentRoute: z.string().trim().max(500).optional(),
    formValues: z.record(z.unknown()).optional(),
  })
  .strip();

export type DiagnoseErrorBody = z.infer<typeof diagnoseErrorBodySchema>;

export type CreateConversationBody = z.infer<typeof createConversationSchema>;
export type ChatBody = z.infer<typeof chatBodySchema>;
export type SendMessageBody = z.infer<typeof sendMessageSchema>;
