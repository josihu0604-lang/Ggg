export class AppError extends Error {
  constructor(
    public code: string,
    public message: string,
    public statusCode: number = 400,
    public details?: any
  ) {
    super(message);
    this.name = 'AppError';
  }
}

export function handleAPIError(error: unknown): { body: any; status: number } {
  console.error('API Error:', error);

  if (error instanceof AppError) {
    return {
      body: {
        error: error.code,
        message: error.message,
        ...(error.details && { details: error.details }),
      },
      status: error.statusCode
    };
  }

  if (error instanceof Error) {
    return {
      body: {
        error: 'INTERNAL_ERROR',
        message: process.env.NODE_ENV === 'development' ? error.message : 'Internal server error',
      },
      status: 500
    };
  }

  return {
    body: {
      error: 'UNKNOWN_ERROR',
      message: 'An unexpected error occurred',
    },
    status: 500
  };
}
