/** Shared domain types for frontend and backend. */

export type UserId = string;
export type TripId = string;

export interface User {
  id: UserId;
  email: string;
  displayName: string;
}

export interface Trip {
  id: TripId;
  userId: UserId;
  destination: string;
  startDate: string;
  endDate: string;
}
