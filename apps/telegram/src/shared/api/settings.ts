import { apiClient } from './client';

export interface BookingTermsSettings {
  termsOfServiceUrl: string | null;
  cancellationPolicyUrl: string | null;
  customText: string | null;
}

export async function getBookingTerms(): Promise<BookingTermsSettings> {
  const { data } = await apiClient.get<BookingTermsSettings>('/public/settings/booking-terms');
  return data;
}

export interface BusinessSettings {
  address: string | null;
}

export async function getBusiness(): Promise<BusinessSettings> {
  const { data } = await apiClient.get<BusinessSettings>('/public/settings/business');
  return data;
}
