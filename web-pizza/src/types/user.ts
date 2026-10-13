export interface UserProfile {
  id?: number;
  name: string;
  first_name?: string;
  last_name?: string;
  phone: string;
  street: string;
  house: string;
  apartment: string;
  additional_address?: string;
  telegram_id?: number | null;
  username?: string | null;
  avatar_url?: string | null;
  is_phone_verified?: boolean;
  client_code?: string;
  bonuses: number;
  isAuthenticated?: boolean;
}

export const USER_PROFILE_STORAGE_KEY = "doma_user_profile_v1";

export function isUserAuthenticated(profile: UserProfile | null | undefined): boolean {
  if (!profile) return false;
  return Boolean(
    profile.isAuthenticated ||
    profile.telegram_id ||
    (profile.is_phone_verified && profile.phone)
  );
}
