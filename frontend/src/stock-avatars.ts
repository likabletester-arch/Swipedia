import type { ImageSourcePropType } from "react-native";

// Cinsiyete göre hazır (stok) profil avatarları. Değerler DB'de "stock:m1" gibi saklanır.
export const STOCK_AVATARS: Record<string, ImageSourcePropType> = {
  m1: require("@/assets/avatars/m1.png"),
  m2: require("@/assets/avatars/m2.png"),
  m3: require("@/assets/avatars/m3.png"),
  m4: require("@/assets/avatars/m4.png"),
  m5: require("@/assets/avatars/m5.png"),
  f1: require("@/assets/avatars/f1.png"),
  f2: require("@/assets/avatars/f2.png"),
  f3: require("@/assets/avatars/f3.png"),
  f4: require("@/assets/avatars/f4.png"),
  f5: require("@/assets/avatars/f5.png"),
};

export const MALE_AVATARS = ["m1", "m2", "m3", "m4", "m5"];
export const FEMALE_AVATARS = ["f1", "f2", "f3", "f4", "f5"];

export function stockSource(avatar?: string): ImageSourcePropType | null {
  if (!avatar || !avatar.startsWith("stock:")) return null;
  return STOCK_AVATARS[avatar.slice(6)] ?? null;
}
