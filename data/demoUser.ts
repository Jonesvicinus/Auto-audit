import type { User, Category } from "@/types";

export const DEMO_USER: User = {
  id: "demo-user-01",
  name: "Alex Carter",
  email: "alex@example.edu",
  createdAt: "2025-05-01T00:00:00.000Z",
};

// Default categories per spec. Colors feed the chart palette.
// `isOther: true` marks the bucket that absorbs unused total-budget slack.
export const DEFAULT_CATEGORIES: Category[] = [
  {
    id: "cat-food",
    name: "Food",
    color: "#10b981",
    icon: "UtensilsCrossed",
    isDefault: true,
  },
  {
    id: "cat-transport",
    name: "Transportation",
    color: "#3b82f6",
    icon: "Car",
    isDefault: true,
  },
  {
    id: "cat-fun",
    name: "Fun Money",
    color: "#a855f7",
    icon: "PartyPopper",
    isDefault: true,
  },
  {
    id: "cat-bills",
    name: "Bills & Subscriptions",
    color: "#f59e0b",
    icon: "Receipt",
    isDefault: true,
  },
  {
    id: "cat-other",
    name: "Other",
    color: "#6b7280",
    icon: "Package",
    isDefault: true,
    isOther: true,
  },
];
