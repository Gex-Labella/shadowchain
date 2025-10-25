/**
 * Error handling middleware
 */

import { Request, Response, NextFunction } from 'express';
import { apiLogger as logger } from '../../utils/logger';

export interface ApiError extends Error {
  status?: number;
  code?: string;
  details?: any;
}

/**
 * Global error handler middleware
 */
export function errorHandler(
  err: ApiError,
  req: Request,
  res: Response,
  next: NextFunction
): void {
  // Log error
  logger.error({
    error: err,
    method: req.method,
    url: req.url,
    ip: req.ip,
    body: req.body,
    query: req.query,
  }, 'API error occurred');

  // Determine status code
  const status = err.status || 500;
  
  // Prepare error response
  const response: any = {
    error: {
      message: err.message || 'Internal server error',
      code: err.code || 'INTERNAL_ERROR',
    },
  };

  // Include stack trace in development
  if (process.env.NODE_ENV === 'development') {
    response.error.stack = err.stack;
    response.error.details = err.details;
  }

  // Send error response
  res.status(status).json(response);
}

/**
 * Create an API error with status code
 */
export function createApiError(
  message: string,
  status: number = 500,
  code?: string,
  details?: any
): ApiError {
  const error: ApiError = new Error(message);
  error.status = status;
  error.code = code;
  error.details = details;
  return error;
}

/**
 * Common error creators
 */
export const errors = {
  badRequest: (message: string, details?: any) =>
    createApiError(message, 400, 'BAD_REQUEST', details),
  
  unauthorized: (message: string = 'Unauthorized') =>
    createApiError(message, 401, 'UNAUTHORIZED'),
  
  forbidden: (message: string = 'Forbidden') =>
    createApiError(message, 403, 'FORBIDDEN'),
  
  notFound: (message: string = 'Not found') =>
    createApiError(message, 404, 'NOT_FOUND'),
  
  conflict: (message: string, details?: any) =>
    createApiError(message, 409, 'CONFLICT', details),
  
  tooManyRequests: (message: string = 'Too many requests') =>
    createApiError(message, 429, 'TOO_MANY_REQUESTS'),
  
  internal: (message: string = 'Internal server error', details?: any) =>
    createApiError(message, 500, 'INTERNAL_ERROR', details),
  
  serviceUnavailable: (message: string = 'Service unavailable') =>
    createApiError(message, 503, 'SERVICE_UNAVAILABLE'),
};