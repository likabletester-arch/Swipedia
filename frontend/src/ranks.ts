import type { Ionicons } from "@expo/vector-icons";

import type { Lang } from "@/src/i18n";

export type Rank = {
  key: string;
  min: number;
  range: string;
  rate: number; // bu rütbede 1 puan için gereken doğru cevap sayısı
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  names: { tr: string; en: string };
};

// Rütbe renkleri/simgeleri iki temada da aynı kalır (marka sabitleri).
export const RANKS: Rank[] = [
  {
    key: "citizen", min: 0, range: "1-50", rate: 50, color: "#8A93A0", icon: "flag",
    names: { tr: "Vatandaş", en: "Citizen" },
  },
  {
    key: "student", min: 50, range: "50-150", rate: 100, color: "#3A86FF", icon: "school",
    names: { tr: "Öğrenci", en: "Student" },
  },
  {
    key: "degree", min: 150, range: "150-300", rate: 150, color: "#2D9D78", icon: "ribbon",
    names: { tr: "Yüksek Lisans", en: "Master's" },
  },
  {
    key: "doctorate", min: 300, range: "300-600", rate: 200, color: "#8B5CF6", icon: "medal",
    names: { tr: "Doktora", en: "Doctorate" },
  },
  {
    key: "inventor", min: 600, range: "600-1250", rate: 250, color: "#E58A2B", icon: "bulb",
    names: { tr: "Mucit", en: "Inventor" },
  },
  {
    key: "genius", min: 1250, range: "1250+", rate: 300, color: "#F0B429", icon: "planet",
    names: { tr: "Dahi", en: "Genius" },
  },
];

export function rankFor(points: number): Rank {
  let current = RANKS[0];
  for (const rank of RANKS) {
    if (points >= rank.min) current = rank;
  }
  return current;
}

export function nextRank(points: number): Rank | null {
  for (const rank of RANKS) {
    if (points < rank.min) return rank;
  }
  return null;
}

export function rankName(rank: Rank, lang: Lang): string {
  return lang === "tr-TR" ? rank.names.tr : rank.names.en;
}

export function formatPoints(points: number): string {
  return String(Math.round(points));
}

export const DIFFICULTIES = [
  { key: "kolay" },
  { key: "orta" },
  { key: "zor" },
  { key: "uzman" },
] as const;
