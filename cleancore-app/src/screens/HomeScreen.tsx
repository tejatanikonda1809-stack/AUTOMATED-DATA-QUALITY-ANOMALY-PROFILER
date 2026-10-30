import React from "react";
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, Platform } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";

export const HomeScreen: React.FC = () => {
  const { colors } = useTheme();
  const { mode, setMode, navigateTo, backendOnline, datasetStates } = useApp();

  const handleSelectSingle = () => {
    setMode("single");
    navigateTo("upload", { dataset: "single" });
  };

  const handleSelectCompare = () => {
    setMode("compare");
    navigateTo("upload", { dataset: "ref" });
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Hero Section */}
      <View style={[styles.heroCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={[styles.iconWrap, { backgroundColor: colors.primaryBg }]}>
          <MaterialCommunityIcons name="shield-check-outline" size={36} color={colors.primary} />
        </View>
        <Text style={[styles.heroTitle, { color: colors.text }]}>
          Automated Data Quality & Anomaly Profiler
        </Text>
        <Text style={[styles.heroSub, { color: colors.textMuted }]}>
          Profile tabular datasets, detect anomalies and corrupt values, execute interactive data cleaning with pre-flight previews, track audit history, and monitor distribution drift between dataset versions.
        </Text>

        <View style={styles.badgeRow}>
          <View style={[styles.featurePill, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Feather name="check" size={13} color={colors.success} />
            <Text style={[styles.featurePillText, { color: colors.textSecondary }]}>Zero Database Overhead</Text>
          </View>
          <View style={[styles.featurePill, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Feather name="check" size={13} color={colors.success} />
            <Text style={[styles.featurePillText, { color: colors.textSecondary }]}>KS Drift Hypothesis Testing</Text>
          </View>
          <View style={[styles.featurePill, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <Feather name="check" size={13} color={colors.success} />
            <Text style={[styles.featurePillText, { color: colors.textSecondary }]}>WeasyPrint PDF Reports</Text>
          </View>
        </View>
      </View>

      {/* Mode Selection Cards */}
      <Text style={[styles.sectionTitle, { color: colors.text }]}>Select Workflow Mode</Text>

      <View style={styles.modesGrid}>
        {/* Single Dataset Mode Card */}
        <TouchableOpacity
          style={[
            styles.modeCard,
            {
              backgroundColor: colors.bgCard,
              borderColor: mode === "single" ? colors.primary : colors.border,
            },
            mode === "single" && { borderWidth: 2 },
          ]}
          onPress={handleSelectSingle}
          activeOpacity={0.8}
        >
          <View style={styles.modeCardHeader}>
            <View style={[styles.modeIcon, { backgroundColor: colors.primaryBg }]}>
              <MaterialCommunityIcons name="file-document-outline" size={24} color={colors.primary} />
            </View>
            <View style={[styles.statusTag, { backgroundColor: colors.primaryBg }]}>
              <Text style={[styles.statusTagText, { color: colors.primary }]}>Standard</Text>
            </View>
          </View>
          <Text style={[styles.modeTitle, { color: colors.text }]}>Single Dataset Profiling & Cleaning</Text>
          <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
            Upload a single CSV or Excel spreadsheet. Inspect quality scores, review missing values, duplicates, outliers, and type errors, then interactively clean and export.
          </Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.cardBtnText, { color: colors.primary }]}>
              {datasetStates.single !== "empty" ? "Continue Session" : "Start Profiling →"}
            </Text>
          </View>
        </TouchableOpacity>

        {/* Comparative Mode Card */}
        <TouchableOpacity
          style={[
            styles.modeCard,
            {
              backgroundColor: colors.bgCard,
              borderColor: mode === "compare" ? colors.info : colors.border,
            },
            mode === "compare" && { borderWidth: 2 },
          ]}
          onPress={handleSelectCompare}
          activeOpacity={0.8}
        >
          <View style={styles.modeCardHeader}>
            <View style={[styles.modeIcon, { backgroundColor: colors.infoBg }]}>
              <MaterialCommunityIcons name="swap-horizontal" size={24} color={colors.info} />
            </View>
            <View style={[styles.statusTag, { backgroundColor: colors.infoBg }]}>
              <Text style={[styles.statusTagText, { color: colors.info }]}>Comparative</Text>
            </View>
          </View>
          <Text style={[styles.modeTitle, { color: colors.text }]}>Two-Dataset Comparison & Drift</Text>
          <Text style={[styles.modeDesc, { color: colors.textMuted }]}>
            Compare a Reference dataset against a Current dataset. Detect schema evolution, primary key record linkages (New, Deleted, Modified), and statistical distribution drift.
          </Text>
          <View style={styles.cardFooter}>
            <Text style={[styles.cardBtnText, { color: colors.info }]}>
              {datasetStates.ref !== "empty" ? "Continue Comparison" : "Compare Versions →"}
            </Text>
          </View>
        </TouchableOpacity>
      </View>

      {/* Capabilities Overview */}
      <View style={[styles.overviewSection, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.overviewTitle, { color: colors.text }]}>Core Platform Capabilities</Text>

        <View style={styles.capGrid}>
          <View style={styles.capItem}>
            <Ionicons name="calculator-outline" size={20} color={colors.primary} />
            <Text style={[styles.capName, { color: colors.text }]}>0–100 Quality Scoring</Text>
            <Text style={[styles.capDesc, { color: colors.textMuted }]}>
              Mathematical penalty algorithm evaluating completeness, uniqueness, and consistency.
            </Text>
          </View>

          <View style={styles.capItem}>
            <Ionicons name="analytics-outline" size={20} color={colors.success} />
            <Text style={[styles.capName, { color: colors.text }]}>Ensemble Outliers</Text>
            <Text style={[styles.capDesc, { color: colors.textMuted }]}>
              Tukey's IQR fences combined with Z-score standard deviation detection.
            </Text>
          </View>

          <View style={styles.capItem}>
            <Ionicons name="git-branch-outline" size={20} color={colors.warning} />
            <Text style={[styles.capName, { color: colors.text }]}>Two-Sample KS Drift</Text>
            <Text style={[styles.capDesc, { color: colors.textMuted }]}>
              Two-sample Kolmogorov-Smirnov non-parametric hypothesis testing at α = 0.05.
            </Text>
          </View>

          <View style={styles.capItem}>
            <Ionicons name="shield-outline" size={20} color={colors.danger} />
            <Text style={[styles.capName, { color: colors.text }]}>Pre-flight Previews</Text>
            <Text style={[styles.capDesc, { color: colors.textMuted }]}>
              Sample affected row simulation before committing any cleaning changes.
            </Text>
          </View>
        </View>
      </View>
    </ScrollView>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  content: {
    padding: 20,
    maxWidth: 1000,
    alignSelf: "center",
    width: "100%",
  },
  heroCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 24,
    marginBottom: 24,
    alignItems: "center",
    textAlign: "center",
  },
  iconWrap: {
    width: 64,
    height: 64,
    borderRadius: 16,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 16,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: "800",
    textAlign: "center",
    marginBottom: 10,
    letterSpacing: -0.4,
  },
  heroSub: {
    fontSize: 14,
    lineHeight: 21,
    textAlign: "center",
    maxWidth: 680,
    marginBottom: 20,
  },
  badgeRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "center",
    gap: 8,
  },
  featurePill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
  },
  featurePillText: {
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 14,
  },
  modesGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
    marginBottom: 24,
  },
  modeCard: {
    flex: 1,
    minWidth: 280,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  modeCardHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  modeIcon: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: "center",
    justifyContent: "center",
  },
  statusTag: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 10,
  },
  statusTagText: {
    fontSize: 11,
    fontWeight: "700",
  },
  modeTitle: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 8,
  },
  modeDesc: {
    fontSize: 13,
    lineHeight: 19,
    marginBottom: 18,
    flex: 1,
  },
  cardFooter: {
    borderTopWidth: 1,
    borderTopColor: "rgba(0,0,0,0.06)",
    paddingTop: 12,
  },
  cardBtnText: {
    fontSize: 13,
    fontWeight: "700",
  },
  overviewSection: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  overviewTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 16,
  },
  capGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  capItem: {
    flex: 1,
    minWidth: 200,
    gap: 6,
  },
  capName: {
    fontSize: 13,
    fontWeight: "700",
  },
  capDesc: {
    fontSize: 12,
    lineHeight: 16,
  },
});

