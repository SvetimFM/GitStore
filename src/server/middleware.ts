import type { Request, Response, NextFunction, RequestHandler } from 'express';
import { logger } from '../utils/logger.js';

/**
 * Wraps an async route handler so thrown errors are passed to Express error middleware.
 * Eliminates the need for try-catch in every route handler.
 */
export function asyncHandler<P = Record<string, string>>(
  fn: (req: Request<P>, res: Response, next: NextFunction) => Promise<void>
): RequestHandler<P> {
  return ((req: Request<P>, res: Response, next: NextFunction) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  }) as RequestHandler<P>;
}

/** Strip file paths and sensitive details from error messages sent to clients. */
function sanitizeErrorMessage(msg: string): string {
  // Remove absolute file paths
  return msg.replace(/\/[\w./-]+/g, '[path]').replace(/Bearer\s+\S+/gi, 'Bearer ***');
}

/**
 * Express error-handling middleware. Must be registered after all routes.
 */
export function errorHandler(err: unknown, _req: Request, res: Response, _next: NextFunction): void {
  const raw = err instanceof Error ? err.message : String(err);
  logger.error('Request error:', raw);
  res.status(500).json({ error: sanitizeErrorMessage(raw) });
}

/**
 * Security headers middleware. Must be registered before routes.
 */
export function securityHeaders(_req: Request, res: Response, next: NextFunction): void {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  next();
}
