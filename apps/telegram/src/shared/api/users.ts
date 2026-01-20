import { apiClient } from './client';

export interface ReferralStats {
  referralCode: string;
  totalReferrals: number;
  referrals: Array<{
    id: string;
    firstName: string;
    lastName: string;
    createdAt: string;
  }>;
}

export const usersApi = {
  getReferralCode: async (): Promise<string> => {
    const { data } = await apiClient.get('/users/me/referral');
    return data.referralCode;
  },
  
  getReferralStats: async (): Promise<ReferralStats> => {
    const { data } = await apiClient.get('/users/me/referral/stats');
    return data;
  },
};
