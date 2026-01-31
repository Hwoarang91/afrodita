import { apiClient } from './client';

export interface BookingTermsSettings {
  termsOfServiceUrl: string | null;
  cancellationPolicyUrl: string | null;
}

export async function getBookingTerms(): Promise<BookingTermsSettings> {
  const { data } = await apiClient.get<BookingTermsSettings>('/public/settings/booking-terms');
  return data;
}
