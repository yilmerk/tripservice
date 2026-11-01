import type { Timestamp } from 'firebase/firestore';

export interface Coordinates { lat: number; lng: number }

export interface Hotel {
  location?: Coordinates;
  name: string;
  address?: string;
  checkIn?: string; // YYYY-MM-DD
  checkOut?: string;
  reservationCode?: string;
  notes?: string;
  famousFor?: string;
}
export type PlaceCategory = 'attraction' | 'museum' | 'food-and-drink' | 'food' | 'coffee' | 'dessert' | 'other';
export interface PlaceInput {
  location?: Coordinates;
  name: string;
  category: PlaceCategory;
  address?: string;
  notes?: string;
  famousFor?: string;
  fee?: { amount: number; currency: string }; // ISO 4217, e.g. TRY, EUR
  mustVisit: boolean;
  visited: boolean;
}
export interface Place extends PlaceInput { id: string }
export interface DestinationInput {
  city: string;
  country: string;
  hotels?: Hotel[];
  airportNotes?: string;
  localTransportNotes?: string;
  intercityNotes?: string;
}
export interface Destination extends DestinationInput {
  id: string;
  places: Place[];
}
export interface TripInput {
  title: string;
  description?: string;
  startDate?: string; // YYYY-MM-DD; local calendar date, not a UTC instant
  endDate?: string;
}
export interface Trip extends TripInput {
  id: string;
  destinations: Destination[];
  createdAt: Timestamp | null; // null while a server timestamp is pending
  updatedAt: Timestamp | null;
}
export type TripUpdate = Partial<TripInput>;
