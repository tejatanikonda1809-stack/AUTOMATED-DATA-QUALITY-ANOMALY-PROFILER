import React, { useState } from "react";
import { View, Text, StyleSheet, TouchableOpacity, Platform } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";
import { BackendModal } from "./BackendModal";

export const Header: React.FC = () => {
  const { mode: themeMode, colors, setMode } = useTheme();
  const { currentScreen, activeDataset, mode: appMode, backendOnline, backendUrl } = useApp();
  const [showBackendModal, setShowBackendModal] = useState(false);

  const getTitle = () => {
    switch (currentScreen) {
      case "home":
        return "CleanCore Dashboard";
      case "upload":
        return `Upload ${appMode === "compare" ? (activeDataset === "ref" ? "Reference Dataset" : "Current Dataset") : "Dataset"}`;
      case "overview":
        return `Dataset Overview (${activeDataset.toUpperCase()})`;
      case "issues":
        return `Issue Center (${activeDataset.toUpperCase()})`;
      case "cleaning":
        return `Cleaning Studio (${activeDataset.toUpperCase()})`;
      case "review":
        return `Review & Finalize (${activeDataset.toUpperCase()})`;
      case "comparison":
        return "Two-Dataset Comparison Dashboard";
      case "visualization":
        return `Visual Analytics (${activeDataset.toUpperCase()})`;
      case "reports":
        return "Reports & Downloads";
      default:
        return "Automated Data Quality Profiler";
    }
  };

  return (
    <>
      <View style={[styles.header, { backgroundColor: colors.bgCard, borderBottomColor: colors.border }]}>
        <View style={styles.titleArea}>
          <View style={[styles.brandIcon, { backgroundColor: colors.primaryBg }]}>
            <MaterialCommunityIcons name="layers-triple-outline" size={20} color={colors.primary} />
          </View>
          <View>
            <View style={styles.brandRow}>
              <Text style={[styles.brandText, { color: colors.text }]}>CleanCore</Text>
              <View
                style={[
                  styles.modeBadge,
                  { backgroundColor: appMode === "compare" ? colors.infoBg : colors.primaryBg },
                ]}
              >
                <Text
                  style={[
                    styles.modeBadgeText,
                    { color: appMode === "compare" ? colors.info : colors.primary },
                  ]}
                >
                  {appMode === "compare" ? "Comparative Mode" : "Single Mode"}
                </Text>
              </View>
            </View>
            <Text style={[styles.subtitle, { color: colors.textMuted }]} numberOfLines={1}>
              {getTitle()}
            </Text>
          </View>
        </View>

        <View style={styles.actionsArea}>
          {/* Backend Connection Status Button */}
          <TouchableOpacity
            style={[
              styles.backendPill,
              {
                backgroundColor: backendOnline ? colors.successBg : colors.dangerBg,
                borderColor: backendOnline ? colors.success : colors.danger,
              },
            ]}
            onPress={() => setShowBackendModal(true)}
            activeOpacity={0.7}
          >
            <View
              style={[
                styles.statusDot,
                { backgroundColor: backendOnline ? colors.success : colors.danger },
              ]}
            />
            <Text
              style={[
                styles.backendPillText,
                { color: backendOnline ? colors.success : colors.danger },
              ]}
              numberOfLines={1}
            >
              {backendOnline ? "Flask Online" : "Flask Offline"}
            </Text>
          </TouchableOpacity>

          {/* Theme Switcher */}
          <View style={[styles.themeGroup, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                themeMode === "light" && { backgroundColor: colors.bgCard, elevation: 1 },
              ]}
              onPress={() => setMode("light")}
            >
              <Feather name="sun" size={14} color={themeMode === "light" ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                themeMode === "dark" && { backgroundColor: colors.bgCard, elevation: 1 },
              ]}
              onPress={() => setMode("dark")}
            >
              <Feather name="moon" size={14} color={themeMode === "dark" ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.themeBtn,
                themeMode === "dim" && { backgroundColor: colors.bgCard, elevation: 1 },
              ]}
              onPress={() => setMode("dim")}
            >
              <Feather name="cloud" size={14} color={themeMode === "dim" ? colors.primary : colors.textMuted} />
            </TouchableOpacity>
          </View>
        </View>
      </View>

      <BackendModal visible={showBackendModal} onClose={() => setShowBackendModal(false)} />
    </>
  );
};

const styles = StyleSheet.create({
  header: {
    height: 64,
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 16,
    borderBottomWidth: 1,
    zIndex: 10,
  },
  titleArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  brandIcon: {
    width: 36,
    height: 36,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandText: {
    fontSize: 16,
    fontWeight: "700",
    letterSpacing: -0.3,
  },
  modeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 12,
  },
  modeBadgeText: {
    fontSize: 10,
    fontWeight: "600",
    textTransform: "uppercase",
  },
  subtitle: {
    fontSize: 12,
    marginTop: 1,
  },
  actionsArea: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  backendPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 16,
    borderWidth: 1,
  },
  statusDot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  backendPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  themeGroup: {
    flexDirection: "row",
    alignItems: "center",
    borderRadius: 8,
    borderWidth: 1,
    padding: 2,
  },
  themeBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: 6,
  },
});

