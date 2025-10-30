// H3 Utility Tests
import { describe, it, expect } from '@jest/globals';
import { toH3Cell, h3Distance, isValidH3Cell } from '../utils/h3.util';

describe('H3 Utility', () => {
  describe('toH3Cell', () => {
    it('should convert valid coordinates to H3 cell', () => {
      const lat = 37.5665;
      const lng = 126.9780;
      const cell = toH3Cell(lat, lng, 10);
      
      expect(cell).toBeDefined();
      expect(typeof cell).toBe('string');
      expect(cell.length).toBeGreaterThan(0);
    });

    it('should throw error for invalid latitude', () => {
      expect(() => toH3Cell(91, 126.9780, 10)).toThrow('Invalid latitude');
      expect(() => toH3Cell(-91, 126.9780, 10)).toThrow('Invalid latitude');
    });

    it('should throw error for invalid longitude', () => {
      expect(() => toH3Cell(37.5665, 181, 10)).toThrow('Invalid longitude');
      expect(() => toH3Cell(37.5665, -181, 10)).toThrow('Invalid longitude');
    });

    it('should use default resolution 10 when not specified', () => {
      const cell1 = toH3Cell(37.5665, 126.9780);
      const cell2 = toH3Cell(37.5665, 126.9780, 10);
      
      expect(cell1).toBe(cell2);
    });
  });

  describe('h3Distance', () => {
    it('should calculate distance between same cells as 0', () => {
      const cell = toH3Cell(37.5665, 126.9780, 10);
      const distance = h3Distance(cell, cell);
      
      expect(distance).toBe(0);
    });

    it('should calculate distance between nearby cells', () => {
      const cell1 = toH3Cell(37.5665, 126.9780, 10);
      const cell2 = toH3Cell(37.5666, 126.9781, 10);
      const distance = h3Distance(cell1, cell2);
      
      expect(distance).toBeGreaterThanOrEqual(0);
      expect(distance).toBeLessThan(100);
    });

    it('should return MAX_SAFE_INTEGER for invalid cells', () => {
      const validCell = toH3Cell(37.5665, 126.9780, 10);
      const invalidCell = 'invalid-cell';
      const distance = h3Distance(validCell, invalidCell);
      
      expect(distance).toBe(Number.MAX_SAFE_INTEGER);
    });
  });

  describe('isValidH3Cell', () => {
    it('should validate correct H3 cell', () => {
      const cell = toH3Cell(37.5665, 126.9780, 10);
      expect(isValidH3Cell(cell)).toBe(true);
    });

    it('should reject invalid H3 cell string', () => {
      expect(isValidH3Cell('invalid-cell')).toBe(false);
      expect(isValidH3Cell('')).toBe(false);
      expect(isValidH3Cell('123')).toBe(false);
    });
  });
});
