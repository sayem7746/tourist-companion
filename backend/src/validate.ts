import type { FastifyRequest } from 'fastify';
import type { z } from 'zod';
import { ValidationError } from './errors.js';

export function parseWithSchema<S extends z.ZodTypeAny>(
  schema: S,
  data: unknown,
  label: string,
): z.infer<S> {
  const result = schema.safeParse(data);
  if (!result.success) {
    throw new ValidationError(`Invalid ${label}`, result.error.flatten());
  }
  return result.data;
}

export function validateRequest<
  TQuery extends z.ZodTypeAny | undefined,
  TBody extends z.ZodTypeAny | undefined,
  TParams extends z.ZodTypeAny | undefined,
>(
  request: FastifyRequest,
  schemas: {
    query?: TQuery;
    body?: TBody;
    params?: TParams;
  },
): {
  query: TQuery extends z.ZodTypeAny ? z.infer<TQuery> : undefined;
  body: TBody extends z.ZodTypeAny ? z.infer<TBody> : undefined;
  params: TParams extends z.ZodTypeAny ? z.infer<TParams> : undefined;
} {
  return {
    query: (schemas.query
      ? parseWithSchema(schemas.query, request.query, 'query')
      : undefined) as TQuery extends z.ZodTypeAny ? z.infer<TQuery> : undefined,
    body: (schemas.body
      ? parseWithSchema(schemas.body, request.body, 'body')
      : undefined) as TBody extends z.ZodTypeAny ? z.infer<TBody> : undefined,
    params: (schemas.params
      ? parseWithSchema(schemas.params, request.params, 'params')
      : undefined) as TParams extends z.ZodTypeAny ? z.infer<TParams> : undefined,
  };
}
