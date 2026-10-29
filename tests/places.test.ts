import { describe, expect, it } from 'vitest';
import { directionsUrl, filterPlaces, formatFee } from '../src/utils/places';
import type { Place } from '../src/types/trip';
const places: Place[] = ['museum', 'food', 'coffee', 'dessert', 'food-and-drink'].map((category, index) => ({ id: String(index), name: category, category: category as Place['category'], mustVisit: index === 0, visited: false }));
describe('place display helpers', () => {
  it('includes all food categories, including legacy records, in the food filter', () => {
    expect(filterPlaces(places, 'food').map(item => item.category)).toEqual(['food', 'coffee', 'dessert', 'food-and-drink']);
    expect(filterPlaces(places, 'must').map(item => item.name)).toEqual(['museum']);
    expect(filterPlaces(places, 'all')).toHaveLength(5);
  });
  it('builds directions to the exact coordinates and distinguishes free from unknown', () => {
    expect(new URL(directionsUrl({ lat: 41, lng: 29 })).searchParams.get('destination')).toBe('41,29');
    expect(formatFee(undefined)).toBe('Ücret belirtilmedi');
    expect(formatFee({ amount: 0, currency: 'TRY' })).toBe('Ücretsiz');
  });
});
