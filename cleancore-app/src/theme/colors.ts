export type ThemeMode = "light" | "dark" | "dim";

export interface ThemeColors {
  mode: ThemeMode;
  bg: string;
  bgCard: string;
  bgCardHover: string;
  bgSecondary: string;
  border: string;
  borderLight: string;
  text: string;
  textSecondary: string;
  textMuted: string;
  primary: string;
  primaryHover: string;
  primaryLight: string;
  primaryBg: string;
  success: string;
  successBg: string;
  warning: string;
  warningBg: string;
  danger: string;
  dangerBg: string;
  info: string;
  infoBg: string;
  badgeBg: string;
  badgeBorder: string;
  tableHeaderBg: string;
  tableRowAlt: string;
  tableRowHover: string;
  modalBackdrop: string;
}

export const lightTheme: ThemeColors = {
  mode: "light",
  bg: "#f8fafc",
  bgCard: "#ffffff",
  bgCardHover: "#f1f5f9",
  bgSecondary: "#f1f5f9",
  border: "#e2e8f0",
  borderLight: "#cbd5e1",
  text: "#0f172a",
  textSecondary: "#334155",
  textMuted: "#64748b",
  primary: "#2563eb",
  primaryHover: "#1d4ed8",
  primaryLight: "#60a5fa",
  primaryBg: "#eff6ff",
  success: "#10b981",
  successBg: "#ecfdf5",
  warning: "#f59e0b",
  warningBg: "#fffbeb",
  danger: "#ef4444",
  dangerBg: "#fef2f2",
  info: "#06b6d4",
  infoBg: "#ecfeff",
  badgeBg: "#f1f5f9",
  badgeBorder: "#e2e8f0",
  tableHeaderBg: "#f8fafc",
  tableRowAlt: "#f8fafc",
  tableRowHover: "#f1f5f9",
  modalBackdrop: "rgba(15, 23, 42, 0.6)",
};

export const darkTheme: ThemeColors = {
  mode: "dark",
  bg: "#0b1120",
  bgCard: "#1e293b",
  bgCardHover: "#283548",
  bgSecondary: "#172033",
  border: "#334155",
  borderLight: "#475569",
  text: "#f8fafc",
  textSecondary: "#cbd5e1",
  textMuted: "#94a3b8",
  primary: "#3b82f6",
  primaryHover: "#2563eb",
  primaryLight: "#93c5fd",
  primaryBg: "rgba(59, 130, 246, 0.15)",
  success: "#10b981",
  successBg: "rgba(16, 185, 129, 0.15)",
  warning: "#f59e0b",
  warningBg: "rgba(245, 158, 11, 0.15)",
  danger: "#ef4444",
  dangerBg: "rgba(239, 68, 68, 0.15)",
  info: "#06b6d4",
  infoBg: "rgba(6, 182, 212, 0.15)",
  badgeBg: "#334155",
  badgeBorder: "#475569",
  tableHeaderBg: "#172033",
  tableRowAlt: "#141c2e",
  tableRowHover: "#243046",
  modalBackdrop: "rgba(0, 0, 0, 0.75)",
};

export const dimTheme: ThemeColors = {
  mode: "dim",
  bg: "#151b28",
  bgCard: "#1e2538",
  bgCardHover: "#263047",
  bgSecondary: "#182030",
  border: "#2c354d",
  borderLight: "#3c4866",
  text: "#e2e8f0",
  textSecondary: "#cbd5e1",
  textMuted: "#8b9bb4",
  primary: "#38bdf8",
  primaryHover: "#0284c7",
  primaryLight: "#7dd3fc",
  primaryBg: "rgba(56, 189, 248, 0.15)",
  success: "#34d399",
  successBg: "rgba(52, 211, 153, 0.15)",
  warning: "#fbbf24",
  warningBg: "rgba(251, 191, 36, 0.15)",
  danger: "#f87171",
  dangerBg: "rgba(248, 113, 113, 0.15)",
  info: "#22d3ee",
  infoBg: "rgba(34, 211, 238, 0.15)",
  badgeBg: "#2c354d",
  badgeBorder: "#3c4866",
  tableHeaderBg: "#182030",
  tableRowAlt: "#161d2c",
  tableRowHover: "#242d42",
  modalBackdrop: "rgba(10, 14, 22, 0.75)",
};

export const getThemeColors = (mode: ThemeMode): ThemeColors => {
  switch (mode) {
    case "dark":
      return darkTheme;
    case "dim":
      return dimTheme;
    case "light":
    default:
      return lightTheme;
  }
};

