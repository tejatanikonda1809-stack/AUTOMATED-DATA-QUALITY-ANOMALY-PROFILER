import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, useWindowDimensions } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp, ScreenName, DatasetKey } from "../context/AppContext";
import { Feather, MaterialCommunityIcons, Ionicons } from "@expo/vector-icons";

interface NavItem {
  key: ScreenName;
  label: string;
  iconName: string;
  iconFamily: "feather" | "material" | "ionicons";
  badge?: number;
  badgeColor?: string;
  compareOnly?: boolean;
}

export const Navigation: React.FC<{ isSidebar?: boolean }> = ({ isSidebar = false }) => {
  const { colors } = useTheme();
  const { currentScreen, navigateTo, mode, activeDataset, setActiveDataset, datasetStates, analyses } = useApp();
  const { width } = useWindowDimensions();
  const isDesktop = width >= 768;

  const currentAnalysis = analyses[activeDataset];
  const issuesCount = currentAnalysis?.issue_center?.length ?? 0;

  const navItems: NavItem[] = [
    { key: "home", label: "Home", iconName: "home", iconFamily: "feather" },
    { key: "upload", label: "Upload Data", iconName: "upload-cloud", iconFamily: "feather" },
    { key: "overview", label: "Dataset Overview", iconName: "view-dashboard-outline", iconFamily: "material" },
    {
      key: "issues",
      label: "Issue Center",
      iconName: "alert-circle",
      iconFamily: "feather",
      badge: issuesCount > 0 ? issuesCount : undefined,
      badgeColor: colors.danger,
    },
    { key: "cleaning", label: "Cleaning Studio", iconName: "broom", iconFamily: "material" },
    { key: "visualization", label: "Visual Analytics", iconName: "bar-chart-2", iconFamily: "feather" },
    { key: "review", label: "Review & Finalize", iconName: "check-circle", iconFamily: "feather" },
    ...(mode === "compare"
      ? [
          {
            key: "comparison" as ScreenName,
            label: "Two-Dataset Compare",
            iconName: "git-compare-outline",
            iconFamily: "material" as const,
            compareOnly: true,
          },
        ]
      : []),
    { key: "reports", label: "Reports & Export", iconName: "file-text", iconFamily: "feather" },
  ];

  const renderIcon = (item: NavItem, active: boolean) => {
    const iconColor = active ? colors.primary : colors.textMuted;
    const size = isSidebar ? 18 : 20;

    if (item.iconFamily === "material") {
      return <MaterialCommunityIcons name={item.iconName as any} size={size} color={iconColor} />;
    }
    if (item.iconFamily === "ionicons") {
      return <Ionicons name={item.iconName as any} size={size} color={iconColor} />;
    }
    return <Feather name={item.iconName as any} size={size} color={iconColor} />;
  };

  // ===== SIDEBAR LAYOUT (For Desktop / Web) =====
  if (isSidebar || isDesktop) {
    return (
      <View style={[styles.sidebar, { backgroundColor: colors.bgCard, borderRightColor: colors.border }]}>
        {/* Dataset Selector for Compare Mode */}
        {mode === "compare" && (
          <View style={[styles.datasetSelector, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.dsTab,
                activeDataset === "ref" && { backgroundColor: colors.bgCard, elevation: 1 },
              ]}
              onPress={() => setActiveDataset("ref")}
            >
              <Text
                style={[
                  styles.dsTabText,
                  { color: activeDataset === "ref" ? colors.primary : colors.textMuted },
                ]}
              >
                Reference
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[
                styles.dsTab,
                activeDataset === "cur" && { backgroundColor: colors.bgCard, elevation: 1 },
              ]}
              onPress={() => setActiveDataset("cur")}
            >
              <Text
                style={[
                  styles.dsTabText,
                  { color: activeDataset === "cur" ? colors.primary : colors.textMuted },
                ]}
              >
                Current
              </Text>
            </TouchableOpacity>
          </View>
        )}

        <ScrollView style={{ flex: 1 }} showsVerticalScrollIndicator={false}>
          <View style={styles.navList}>
            {navItems.map((item) => {
              const active = currentScreen === item.key;
              return (
                <TouchableOpacity
                  key={item.key}
                  style={[
                    styles.navItem,
                    active && { backgroundColor: colors.primaryBg },
                  ]}
                  onPress={() => navigateTo(item.key)}
                  activeOpacity={0.7}
                >
                  <View style={styles.navItemLeft}>
                    {renderIcon(item, active)}
                    <Text
                      style={[
                        styles.navItemLabel,
                        { color: active ? colors.primary : colors.textSecondary },
                        active && { fontWeight: "700" },
                      ]}
                      numberOfLines={1}
                    >
                      {item.label}
                    </Text>
                  </View>
                  {item.badge !== undefined && (
                    <View style={[styles.badge, { backgroundColor: item.badgeColor || colors.danger }]}>
                      <Text style={styles.badgeText}>{item.badge}</Text>
                    </View>
                  )}
                </TouchableOpacity>
              );
            })}
          </View>
        </ScrollView>
      </View>
    );
  }

  // ===== MOBILE BOTTOM / TOP SCROLL BAR =====
  return (
    <View style={[styles.bottomBar, { backgroundColor: colors.bgCard, borderTopColor: colors.border }]}>
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.bottomScroll}>
        {navItems.map((item) => {
          const active = currentScreen === item.key;
          return (
            <TouchableOpacity
              key={item.key}
              style={[
                styles.bottomTab,
                active && { borderBottomColor: colors.primary, borderBottomWidth: 2 },
              ]}
              onPress={() => navigateTo(item.key)}
              activeOpacity={0.7}
            >
              <View style={{ position: "relative" }}>
                {renderIcon(item, active)}
                {item.badge !== undefined && (
                  <View style={[styles.mobileBadgeDot, { backgroundColor: item.badgeColor || colors.danger }]} />
                )}
              </View>
              <Text
                style={[
                  styles.bottomTabLabel,
                  { color: active ? colors.primary : colors.textMuted },
                  active && { fontWeight: "700" },
                ]}
                numberOfLines={1}
              >
                {item.label}
              </Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </View>
  );
};

const styles = StyleSheet.create({
  sidebar: {
    width: 230,
    borderRightWidth: 1,
    paddingTop: 12,
    paddingHorizontal: 12,
  },
  datasetSelector: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
    marginBottom: 14,
  },
  dsTab: {
    flex: 1,
    paddingVertical: 6,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  dsTabText: {
    fontSize: 12,
    fontWeight: "600",
  },
  navList: {
    gap: 4,
    paddingBottom: 24,
  },
  navItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  navItemLeft: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    flex: 1,
  },
  navItemLabel: {
    fontSize: 13,
    fontWeight: "500",
  },
  badge: {
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 10,
    minWidth: 20,
    alignItems: "center",
    justifyContent: "center",
  },
  badgeText: {
    color: "#fff",
    fontSize: 10,
    fontWeight: "700",
  },
  bottomBar: {
    borderTopWidth: 1,
    height: 58,
  },
  bottomScroll: {
    alignItems: "center",
    paddingHorizontal: 8,
    gap: 4,
  },
  bottomTab: {
    alignItems: "center",
    justifyContent: "center",
    paddingHorizontal: 14,
    height: "100%",
    gap: 3,
  },
  bottomTabLabel: {
    fontSize: 10,
  },
  mobileBadgeDot: {
    position: "absolute",
    top: -2,
    right: -4,
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});

