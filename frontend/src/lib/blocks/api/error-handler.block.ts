import type { BlockContext, BlockResult } from '../types';
import { createDesignTokens } from '../design-injector';

export default function generate(ctx: BlockContext): BlockResult {
  const t = createDesignTokens(ctx.design);

  return {
    'src/lib/api-error.ts': `import { NextResponse } from 'next/server';
import { createClient } from '@/lib/supabase/server';

/**
 * Custom API Error with status code
 */
export class ApiError extends Error {
  public readonly statusCode: number;
  public readonly details?: unknown;

  constructor(message: string, statusCode: number = 500, details?: unknown) {
    super(message);
    this.name = 'ApiError';
    this.statusCode = statusCode;
    this.details = details;
  }

  static badRequest(message: string = 'Bad request', details?: unknown) {
    return new ApiError(message, 400, details);
  }

  static unauthorized(message: string = 'Unauthorized') {
    return new ApiError(message, 401);
  }

  static forbidden(message: string = 'Forbidden') {
    return new ApiError(message, 403);
  }

  static notFound(message: string = 'Not found') {
    return new ApiError(message, 404);
  }

  static tooManyRequests(message: string = 'Too many requests') {
    return new ApiError(message, 429);
  }

  static internal(message: string = 'Internal server error') {
    return new ApiError(message, 500);
  }
}

/**
 * Handle API errors and return proper NextResponse
 */
export function handleApiError(error: unknown): NextResponse {
  if (error instanceof ApiError) {
    return NextResponse.json(
      {
        error: error.message,
        ...(error.details ? { details: error.details } : {}),
      },
      { status: error.statusCode }
    );
  }

  if (error instanceof Error) {
    console.error('Unhandled error:', error);
    return NextResponse.json(
      { error: error.message || 'Internal server error' },
      { status: 500 }
    );
  }

  console.error('Unknown error:', error);
  return NextResponse.json(
    { error: 'Internal server error' },
    { status: 500 }
  );
}

/**
 * Require authenticated user or throw ApiError
 * Returns the authenticated user object
 */
export async function requireAuth() {
  const supabase = await createClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    throw ApiError.unauthorized('Authentication required');
  }

  return { user, supabase };
}

/**
 * Wrap an API handler with automatic error handling
 */
export function withErrorHandler(
  handler: (req: Request) => Promise<NextResponse>
) {
  return async (req: Request): Promise<NextResponse> => {
    try {
      return await handler(req);
    } catch (error) {
      return handleApiError(error);
    }
  };
}
`,
  };
}
