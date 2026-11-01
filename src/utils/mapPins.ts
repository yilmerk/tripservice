import type { PlaceCategory } from '../types/trip';
export const pinKinds = {
  hotel: { glyph: '🏨', color: '#2563eb', label: 'Otel' },
  must: { glyph: '⭐', color: '#a16207', label: 'Mutlaka gidilmeli' },
  museum: { glyph: '🏛️', color: '#7c3aed', label: 'Müze' },
  attraction: { glyph: '📍', color: '#15803d', label: 'Gezilecek yer' },
  food: { glyph: '🍽️', color: '#c2410c', label: 'Yemek' },
  coffee: { glyph: '☕', color: '#854d0e', label: 'Kahve' },
  dessert: { glyph: '🍰', color: '#be185d', label: 'Tatlı' },
  'food-and-drink': { glyph: '🍽️', color: '#c2410c', label: 'Yeme-İçme' },
  other: { glyph: '●', color: '#475569', label: 'Diğer' },
};
export function pinAppearance(hotel: boolean, mustVisit: boolean, category: PlaceCategory = 'other') {
  const kind = pinKinds[hotel ? 'hotel' : mustVisit ? 'must' : category];
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="44" height="52" viewBox="0 0 44 52"><path d="M22 50C16 40 2 30 2 22a20 20 0 1 1 40 0c0 8-14 18-20 28Z" fill="${kind.color}" stroke="white" stroke-width="2"/><text x="22" y="29" text-anchor="middle" font-size="21" font-family="Arial,sans-serif" fill="white">${kind.glyph}</text></svg>`;
  return { ...kind, icon: { url: `data:image/svg+xml;charset=UTF-8,${encodeURIComponent(svg)}` } };
}
