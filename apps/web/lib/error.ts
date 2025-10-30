import { NextResponse } from 'next/server';
import { handleAPIError as sharedHandleAPIError } from '@zzik/shared/src/utils/error.util';

export { AppError } from '@zzik/shared/src/utils/error.util';

export function handleAPIError(error: unknown): NextResponse {
  const result = sharedHandleAPIError(error);
  return NextResponse.json(result.body, { status: result.status });
}
