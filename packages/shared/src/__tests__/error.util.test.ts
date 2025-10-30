import { AppError, handleAPIError } from '../utils/error.util';

describe('error.util', () => {
  describe('AppError', () => {
    test('creates error with all properties', () => {
      const error = new AppError('TEST_ERROR', 'Test message', 400, { detail: 'test' });
      
      expect(error.code).toBe('TEST_ERROR');
      expect(error.message).toBe('Test message');
      expect(error.statusCode).toBe(400);
      expect(error.details).toEqual({ detail: 'test' });
    });
    
    test('defaults to 500 status code', () => {
      const error = new AppError('ERROR', 'Message');
      
      expect(error.statusCode).toBe(500);
    });
    
    test('is instance of Error', () => {
      const error = new AppError('ERROR', 'Message');
      
      expect(error).toBeInstanceOf(Error);
      expect(error).toBeInstanceOf(AppError);
    });
  });
  
  describe('handleAPIError', () => {
    test('handles AppError correctly', () => {
      const error = new AppError('VALIDATION_ERROR', 'Invalid input', 400, { field: 'email' });
      
      const result = handleAPIError(error);
      
      expect(result.status).toBe(400);
      expect(result.body.error).toBe('VALIDATION_ERROR');
      expect(result.body.message).toBe('Invalid input');
      expect(result.body.details).toEqual({ field: 'email' });
    });
    
    test('handles standard Error', () => {
      const error = new Error('Something went wrong');
      
      const result = handleAPIError(error);
      
      expect(result.status).toBe(500);
      expect(result.body.error).toBe('INTERNAL_ERROR');
    });
    
    test('handles unknown error', () => {
      const error = 'string error';
      
      const result = handleAPIError(error);
      
      expect(result.status).toBe(500);
      expect(result.body.error).toBe('UNKNOWN_ERROR');
    });
    
    test('hides error details in production', () => {
      const originalEnv = process.env.NODE_ENV;
      process.env.NODE_ENV = 'production';
      
      const error = new Error('Sensitive error message');
      const result = handleAPIError(error);
      
      expect(result.body.message).toBe('Internal server error');
      
      process.env.NODE_ENV = originalEnv;
    });
  });
});
