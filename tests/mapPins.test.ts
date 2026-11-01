import { expect, it } from 'vitest';
import { pinAppearance } from '../src/utils/mapPins';
it('gives hotels and must-visit places priority over category styling', () => {
  expect(pinAppearance(true, true, 'coffee').glyph).toBe('🏨');
  expect(pinAppearance(false, true, 'coffee').glyph).toBe('⭐');
  expect(pinAppearance(false, false, 'coffee').glyph).toBe('☕');
  expect(pinAppearance(false, false, 'museum').color).not.toBe(pinAppearance(false, false, 'food').color);
});
