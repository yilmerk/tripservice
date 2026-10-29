import type { Coordinates, Place, PlaceCategory } from '../types/trip';
export const categoryLabels: Record<PlaceCategory, string> = {
  museum: 'Müze', attraction: 'Gezilecek Yer', food: 'Yemek', coffee: 'Kahve', dessert: 'Tatlı',
  'food-and-drink': 'Yeme-İçme', other: 'Diğer',
};
export type PlaceFilter = 'all' | 'must' | 'food';
export function filterPlaces(places: Place[], filter: PlaceFilter) {
  return places.filter(place => filter === 'all' || (filter === 'must' ? place.mustVisit : ['food', 'coffee', 'dessert', 'food-and-drink'].includes(place.category)));
}
export function directionsUrl(location: Coordinates) {
  return `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${location.lat},${location.lng}`)}`;
}
export function formatFee(fee: Place['fee']) {
  return fee ? fee.amount === 0 ? 'Ücretsiz' : `${fee.amount.toLocaleString('tr-TR')} ${fee.currency}` : 'Ücret belirtilmedi';
}
