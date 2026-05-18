import type { LucideIcon } from "lucide-react";
import {
  BadgeDollarSign,
  Banknote,
  Bitcoin,
  CircleDollarSign,
  Coins,
  Flame,
  HandCoins,
  Heart,
  HeartHandshake,
  HelpCircle,
  Info,
  Landmark,
  Languages,
  Layers,
  Paintbrush,
  PenTool,
  PiggyBank,
  QrCode,
  Rocket,
  ScanText,
  Server,
  Shield,
  ShieldCheck,
  Sparkles,
  Timer,
  Users,
  Video,
  Wallet,
  Wallet2,
  WalletCards,
  WalletMinimal,
  Wand2,
  Zap,
  DollarSign,
} from "lucide-react";

const aboutIconMap: Record<string, LucideIcon> = {
  Flame,
  Heart,
  HeartHandshake,
  HelpCircle,
  Info,
  PiggyBank,
  QrCode,
  Rocket,
  Server,
  Shield,
  Sparkles,
  Users,
  Wand2,
  Zap,
};

const faqIconMap: Record<string, LucideIcon> = {
  HelpCircle,
  Info,
  Rocket,
  Shield,
  Sparkles,
  Users,
};

const recruitmentIconMap: Record<string, LucideIcon> = {
  Languages,
  Layers,
  Paintbrush,
  PenTool,
  ScanText,
  ShieldCheck,
  Sparkles,
  Timer,
  Video,
};

const donationsIconMap: Record<string, LucideIcon> = {
  BadgeDollarSign,
  Banknote,
  Bitcoin,
  CircleDollarSign,
  Coins,
  DollarSign,
  Flame,
  HandCoins,
  Heart,
  HeartHandshake,
  HelpCircle,
  Info,
  Landmark,
  PiggyBank,
  QrCode,
  Rocket,
  Server,
  Shield,
  Sparkles,
  Users,
  Wallet,
  Wallet2,
  WalletCards,
  WalletMinimal,
  Wand2,
  Zap,
};

const resolveIcon = (
  iconMap: Record<string, LucideIcon>,
  iconName: string | undefined,
  fallback: LucideIcon,
) => (iconName ? iconMap[iconName] : undefined) || fallback;

export const resolveAboutIcon = (iconName: string | undefined, fallback: LucideIcon) =>
  resolveIcon(aboutIconMap, iconName, fallback);

export const resolveFaqIcon = (iconName: string | undefined, fallback: LucideIcon) =>
  resolveIcon(faqIconMap, iconName, fallback);

export const resolveRecruitmentIcon = (iconName: string | undefined, fallback: LucideIcon) =>
  resolveIcon(recruitmentIconMap, iconName, fallback);

export const resolveDonationsIcon = (iconName: string | undefined, fallback: LucideIcon) =>
  resolveIcon(donationsIconMap, iconName, fallback);
