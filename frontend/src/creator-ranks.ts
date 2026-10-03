import type { Ionicons } from "@expo/vector-icons";
import type { Lang } from "@/src/i18n";

type IconName = keyof typeof Ionicons.glyphMap;

// Paylaşılan soru sayısına göre içerik üretici rank'leri.
export type CreatorRank = {
  key: string;
  min: number;
  max: number; // dahil (son seviye için Infinity)
  en: string;
  tr: string;
  color: string;
  icon: IconName;
};

export const CREATOR_RANKS: CreatorRank[] = [
  { key: "curious", min: 1, max: 50, en: "Curious Mind", tr: "Meraklı Zihin", color: "#6C8EF5", icon: "bulb" },
  { key: "maker", min: 51, max: 250, en: "Question Maker", tr: "Soru Üreticisi", color: "#22B8A6", icon: "create" },
  { key: "builder", min: 251, max: 750, en: "Knowledge Builder", tr: "Bilgi İnşa Edici", color: "#F5A524", icon: "construct" },
  { key: "master", min: 751, max: 2000, en: "Quiz Master", tr: "Quiz Ustası", color: "#A855F7", icon: "ribbon" },
  { key: "legend", min: 2001, max: Infinity, en: "Swipedia Legend", tr: "Swipedia Efsanesi", color: "#FF8A3D", icon: "flame" },
];

export type CreatorProgress = {
  hasRank: boolean;
  rank: CreatorRank; // mevcut rank (soru yoksa ilk hedef rank)
  isMax: boolean;
  nextTarget: number | null; // bir sonraki seviyeye ulaşmak için gereken toplam soru
  progress: number; // 0..1 (mevcut seviye içindeki ilerleme)
  count: number;
};

export function creatorRankFor(count: number): CreatorProgress {
  const safe = Math.max(0, count || 0);
  if (safe <= 0) {
    return { hasRank: false, rank: CREATOR_RANKS[0], isMax: false, nextTarget: 1, progress: 0, count: 0 };
  }
  const rank = CREATOR_RANKS.find((r) => safe >= r.min && safe <= r.max) ?? CREATOR_RANKS[CREATOR_RANKS.length - 1];
  const isMax = rank.max === Infinity;
  const lower = rank.min - 1; // bu seviyeye giriş eşiği
  const upper = isMax ? safe : rank.max;
  const progress = isMax ? 1 : Math.min(1, Math.max(0, (safe - lower) / (upper - lower)));
  return { hasRank: true, rank, isMax, nextTarget: isMax ? null : rank.max + 1, progress, count: safe };
}

export function creatorRankName(rank: CreatorRank, lang: Lang): string {
  return lang === "tr-TR" ? rank.tr : rank.en;
}
