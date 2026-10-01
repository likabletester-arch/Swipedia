import type { Ionicons } from "@expo/vector-icons";

export type CategoryDef = { key: string; value: string; icon: keyof typeof Ionicons.glyphMap };

// Değerler (value) içerik dilinde (TR) kanonik olarak saklanır; arayüzde i18n ile çevrilir.
export const CATEGORY_DEFS: CategoryDef[] = [
  { key: "general", value: "Genel Kültür", icon: "library-outline" },
  { key: "science", value: "Bilim", icon: "beaker-outline" },
  { key: "history", value: "Tarih", icon: "hourglass-outline" },
  { key: "language", value: "Dil", icon: "language-outline" },
  { key: "math", value: "Matematik", icon: "calculator-outline" },
  { key: "geography", value: "Coğrafya", icon: "map-outline" },
  { key: "astronomy", value: "Astronomi", icon: "planet-outline" },
  { key: "animals", value: "Hayvanlar Alemi", icon: "paw-outline" },
  { key: "games", value: "Oyun", icon: "game-controller-outline" },
  { key: "tech", value: "Teknoloji", icon: "hardware-chip-outline" },
  { key: "physics", value: "Fizik", icon: "magnet-outline" },
  { key: "chemistry", value: "Kimya", icon: "flask-outline" },
  { key: "biology", value: "Biyoloji", icon: "leaf-outline" },
  { key: "literature", value: "Edebiyat", icon: "book-outline" },
  { key: "movies", value: "Filmler ve Diziler", icon: "film-outline" },
];

export function categoryIcon(value: string): keyof typeof Ionicons.glyphMap {
  return CATEGORY_DEFS.find((c) => c.value === value)?.icon ?? "pricetag-outline";
}
