import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import * as api from "../services/api";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";

export const ComparisonScreen: React.FC = () => {
  const { colors } = useTheme();
  const { comparisonData, runComparisonAnalysis, navigateTo, datasetStates } = useApp();
  const [isRunning, setIsRunning] = useState(false);

  const refState = datasetStates.ref;
  const curState = datasetStates.cur;
  const hasBoth = refState !== "empty" && curState !== "empty";

  useEffect(() => {
    if (hasBoth && !comparisonData) {
      runComparisonAnalysis();
    }
  }, [hasBoth]);

  const handleRunComparison = async () => {
    setIsRunning(true);
    await runComparisonAnalysis();
    setIsRunning(false);
  };

  if (!hasBoth) {
    return (
      <View style={[styles.emptyCard, { backgroundColor: colors.bg }]}>
        <MaterialCommunityIcons name="swap-horizontal" size={54} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>Comparative Mode Setup Incomplete</Text>
        <Text style={[styles.emptySub, { color: colors.textMuted }]}>
          Two-Dataset Comparison requires both a Reference dataset (Baseline) and a Current dataset.
        </Text>
        <View style={styles.emptyButtons}>
          <TouchableOpacity
            style={[styles.btnSlot, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigateTo("upload", { dataset: "ref" })}
          >
            <Text style={[styles.btnSlotLabel, { color: colors.textSecondary }]}>
              Reference: {refState !== "empty" ? "✓ Loaded" : "Upload Reference →"}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.btnSlot, { backgroundColor: colors.bgCard, borderColor: colors.border }]}
            onPress={() => navigateTo("upload", { dataset: "cur" })}
          >
            <Text style={[styles.btnSlotLabel, { color: colors.textSecondary }]}>
              Current: {curState !== "empty" ? "✓ Loaded" : "Upload Current →"}
            </Text>
          </TouchableOpacity>
        </View>
      </View>
    );
  }

  const comp = comparisonData;
  const summary = comp?.summary || {};
  const schema = comp?.schema || {};
  const quality = comp?.quality || {};
  const rowMatch = comp?.row_match || {};
  const driftList: any[] = comp?.drift || [];

  const scoreChange = quality.score_change ?? 0;
  const scoreVerb = scoreChange > 0 ? `+${scoreChange}` : `${scoreChange}`;

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Header Bar */}
      <View style={[styles.headerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={{ flex: 1, minWidth: 260 }}>
          <Text style={[styles.heading, { color: colors.text }]}>Two-Dataset Comparison Dashboard</Text>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>
            Reference (Baseline) vs. Current (New Version) cross-dataset audit, record linkage, and distribution drift analysis.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btnRecompare, { backgroundColor: colors.primary }]}
          onPress={handleRunComparison}
          disabled={isRunning}
        >
          {isRunning ? (
            <ActivityIndicator size="small" color="#fff" />
          ) : (
            <>
              <Feather name="refresh-cw" size={14} color="#fff" />
              <Text style={styles.btnRecompareText}>Re-run Comparison</Text>
            </>
          )}
        </TouchableOpacity>
      </View>

      {/* Executive Narrative Paragraph */}
      {summary.narrative && (
        <View style={[styles.narrativeCard, { backgroundColor: colors.primaryBg, borderColor: colors.primaryLight }]}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, marginBottom: 6 }}>
            <Feather name="info" size={16} color={colors.primary} />
            <Text style={[styles.narrativeTitle, { color: colors.primary }]}>Executive Comparative Narrative</Text>
          </View>
          <Text style={[styles.narrativeText, { color: colors.text }]}>{summary.narrative}</Text>
        </View>
      )}

      {/* Metric Cards Row */}
      <View style={styles.metricsRow}>
        {/* Quality Score Comparison */}
        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.metricTitle, { color: colors.textMuted }]}>Quality Score Delta</Text>
          <View style={styles.scoreCompareRow}>
            <View>
              <Text style={[styles.scoreSmall, { color: colors.textSecondary }]}>Ref: {quality.reference_score ?? 0}</Text>
              <Text style={[styles.scoreSmall, { color: colors.textSecondary }]}>Cur: {quality.current_score ?? 0}</Text>
            </View>
            <View
              style={[
                styles.deltaBadge,
                { backgroundColor: scoreChange >= 0 ? colors.successBg : colors.dangerBg },
              ]}
            >
              <Text style={[styles.deltaText, { color: scoreChange >= 0 ? colors.success : colors.danger }]}>
                {scoreVerb} pts
              </Text>
            </View>
          </View>
        </View>

        {/* Record Linkage Card */}
        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.metricTitle, { color: colors.textMuted }]}>Record Linkage ({rowMatch.id_column ? `Key: ${rowMatch.id_column}` : "Positional"})</Text>
          <View style={styles.linkageRow}>
            <Text style={[styles.linkageTag, { color: colors.success }]}>+{rowMatch.new_count ?? 0} New</Text>
            <Text style={[styles.linkageTag, { color: colors.danger }]}>-{rowMatch.deleted_count ?? 0} Deleted</Text>
            <Text style={[styles.linkageTag, { color: colors.warning }]}>~{rowMatch.modified_count ?? 0} Modified</Text>
          </View>
        </View>

        {/* Drift Summary Card */}
        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.metricTitle, { color: colors.textMuted }]}>Statistical Distribution Drift</Text>
          <Text style={[styles.driftCount, { color: summary.drift_columns > 0 ? colors.danger : colors.success }]}>
            {summary.drift_columns ?? 0} <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textMuted }}>columns drifted</Text>
          </Text>
          <Text style={[styles.driftSub, { color: colors.textMuted }]}>Two-Sample KS test evaluated at α = 0.05</Text>
        </View>
      </View>

      {/* Schema Evolution Section */}
      <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Schema Evolution & Structural Diffs</Text>
        <Text style={[styles.sectionSubheading, { color: colors.textMuted }]}>
          Attributes added, removed, or with data-type shifts between dataset versions.
        </Text>

        <View style={styles.schemaDiffGrid}>
          <View style={[styles.diffBox, { backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.diffLabel, { color: colors.success }]}>Added Columns ({schema.added_columns?.length ?? 0})</Text>
            <Text style={[styles.diffContent, { color: colors.text }]}>
              {schema.added_columns?.length ? schema.added_columns.join(", ") : "None"}
            </Text>
          </View>

          <View style={[styles.diffBox, { backgroundColor: colors.bgSecondary }]}>
            <Text style={[styles.diffLabel, { color: colors.danger }]}>Removed Columns ({schema.removed_columns?.length ?? 0})</Text>
            <Text style={[styles.diffContent, { color: colors.text }]}>
              {schema.removed_columns?.length ? schema.removed_columns.join(", ") : "None"}
            </Text>
          </View>
        </View>
      </View>

      {/* Distribution Drift Details Table */}
      <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionHeading, { color: colors.text }]}>Column-Level Distribution Drift Analysis</Text>
        <Text style={[styles.sectionSubheading, { color: colors.textMuted }]}>
          Hypothesis testing evaluating distribution invariance between Reference and Current versions.
        </Text>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={styles.driftTable}>
            <View style={[styles.driftTableRow, styles.driftTableHeader, { backgroundColor: colors.tableHeaderBg, borderBottomColor: colors.border }]}>
              <Text style={[styles.driftCol, { width: 160, color: colors.textSecondary }]}>Column Name</Text>
              <Text style={[styles.driftCol, { width: 110, color: colors.textSecondary }]}>Type</Text>
              <Text style={[styles.driftCol, { width: 120, color: colors.textSecondary }]}>KS Statistic</Text>
              <Text style={[styles.driftCol, { width: 110, color: colors.textSecondary }]}>p-Value</Text>
              <Text style={[styles.driftCol, { width: 130, color: colors.textSecondary }]}>Drift Status</Text>
              <Text style={[styles.driftCol, { width: 280, color: colors.textSecondary }]}>Interpretation</Text>
            </View>

            {driftList.map((d, idx) => {
              const isAlt = idx % 2 === 1;
              const hasDrift = d.drift_detected;
              return (
                <View
                  key={idx}
                  style={[
                    styles.driftTableRow,
                    {
                      backgroundColor: isAlt ? colors.tableRowAlt : colors.bgCard,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.driftCell, { width: 160, fontWeight: "700", color: colors.text }]}>
                    {d.column}
                  </Text>
                  <Text style={[styles.driftCell, { width: 110, color: colors.textMuted, textTransform: "capitalize" }]}>
                    {d.type}
                  </Text>
                  <Text style={[styles.driftCell, { width: 120, color: colors.textSecondary }]}>
                    {d.ks_statistic !== undefined ? d.ks_statistic.toFixed(4) : "—"}
                  </Text>
                  <Text style={[styles.driftCell, { width: 110, color: colors.textSecondary }]}>
                    {d.p_value !== undefined ? d.p_value.toFixed(4) : "—"}
                  </Text>
                  <View style={{ width: 130, justifyContent: "center" }}>
                    <View
                      style={[
                        styles.driftPill,
                        { backgroundColor: hasDrift ? colors.dangerBg : colors.successBg },
                      ]}
                    >
                      <Text style={[styles.driftPillText, { color: hasDrift ? colors.danger : colors.success }]}>
                        {hasDrift ? "Drift Detected" : "Invariance Held"}
                      </Text>
                    </View>
                  </View>
                  <Text style={[styles.driftCell, { width: 280, fontSize: 11, color: colors.textMuted }]}>
                    {d.interpretation || d.note || "No significant drift observed."}
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
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
    maxWidth: 1100,
    alignSelf: "center",
    width: "100%",
    gap: 16,
  },
  emptyCard: {
    flex: 1,
    alignItems: "center",
    justifyContent: "center",
    padding: 30,
    gap: 12,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: "700",
  },
  emptySub: {
    fontSize: 13,
    textAlign: "center",
    maxWidth: 420,
    lineHeight: 18,
    marginBottom: 10,
  },
  emptyButtons: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
    justifyContent: "center",
  },
  btnSlot: {
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnSlotLabel: {
    fontSize: 13,
    fontWeight: "600",
  },
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
    flexWrap: "wrap",
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: "800",
  },
  subheading: {
    fontSize: 12,
    marginTop: 2,
  },
  btnRecompare: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnRecompareText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  narrativeCard: {
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
  },
  narrativeTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  narrativeText: {
    fontSize: 13,
    lineHeight: 20,
  },
  metricsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
  },
  metricCard: {
    flex: 1,
    minWidth: 220,
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    gap: 8,
  },
  metricTitle: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  scoreCompareRow: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  scoreSmall: {
    fontSize: 13,
    fontWeight: "600",
  },
  deltaBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
  },
  deltaText: {
    fontSize: 13,
    fontWeight: "800",
  },
  linkageRow: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  linkageTag: {
    fontSize: 12,
    fontWeight: "700",
  },
  driftCount: {
    fontSize: 22,
    fontWeight: "800",
  },
  driftSub: {
    fontSize: 11,
  },
  sectionCard: {
    padding: 18,
    borderRadius: 14,
    borderWidth: 1,
  },
  sectionHeading: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSubheading: {
    fontSize: 12,
    marginTop: 2,
    marginBottom: 12,
  },
  schemaDiffGrid: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  diffBox: {
    flex: 1,
    minWidth: 240,
    padding: 12,
    borderRadius: 8,
    gap: 4,
  },
  diffLabel: {
    fontSize: 12,
    fontWeight: "700",
  },
  diffContent: {
    fontSize: 12,
  },
  driftTable: {
    minWidth: 800,
  },
  driftTableRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  driftTableHeader: {
    paddingVertical: 8,
  },
  driftCol: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  driftCell: {
    fontSize: 12,
  },
  driftPill: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  driftPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
});

