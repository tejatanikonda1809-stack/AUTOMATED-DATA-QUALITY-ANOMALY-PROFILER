import React, { useEffect, useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import { QualityScoreCard } from "../components/QualityScoreCard";
import { DataTable } from "../components/DataTable";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";

export const OverviewScreen: React.FC = () => {
  const { colors } = useTheme();
  const { activeDataset, analyses, refreshAnalysis, navigateTo, datasetStates } = useApp();
  const [isRefreshing, setIsRefreshing] = useState(false);

  const analysis = analyses[activeDataset];
  const currentState = datasetStates[activeDataset];

  useEffect(() => {
    if (!analysis && currentState !== "empty") {
      refreshAnalysis(activeDataset);
    }
  }, [activeDataset, analysis, currentState]);

  const handleRefresh = async () => {
    setIsRefreshing(true);
    await refreshAnalysis(activeDataset);
    setIsRefreshing(false);
  };

  if (!analysis) {
    return (
      <View style={[styles.emptyContainer, { backgroundColor: colors.bg }]}>
        <MaterialCommunityIcons name="database-search-outline" size={54} color={colors.textMuted} />
        <Text style={[styles.emptyTitle, { color: colors.text }]}>No Dataset Uploaded Yet</Text>
        <Text style={[styles.emptySub, { color: colors.textMuted }]}>
          Upload a CSV or Excel spreadsheet to begin profiling and analyzing data health.
        </Text>
        <TouchableOpacity
          style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
          onPress={() => navigateTo("upload", { dataset: activeDataset })}
        >
          <Feather name="upload" size={16} color="#fff" />
          <Text style={styles.btnPrimaryText}>Upload Dataset</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const schema = analysis.schema || {};
  const missing = analysis.missing || {};
  const duplicates = analysis.duplicates || {};
  const issues = analysis.issue_center || [];
  const columns = schema.columns || [];

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Action Bar */}
      <View style={styles.topActions}>
        <View style={styles.actionLeft}>
          <Text style={[styles.pageHeading, { color: colors.text }]}>
            Profiling Summary: {activeDataset.toUpperCase()}
          </Text>
          <Text style={[styles.pageSub, { color: colors.textMuted }]}>
            Real-time multi-dimensional data quality inspection and schema inference.
          </Text>
        </View>

        <View style={styles.actionButtons}>
          <TouchableOpacity
            style={[styles.btnSecondary, { borderColor: colors.border }]}
            onPress={handleRefresh}
            disabled={isRefreshing}
          >
            {isRefreshing ? (
              <ActivityIndicator size="small" color={colors.primary} />
            ) : (
              <>
                <Feather name="refresh-cw" size={14} color={colors.textSecondary} />
                <Text style={[styles.btnSecondaryText, { color: colors.textSecondary }]}>Re-profile</Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAction, { backgroundColor: colors.primary }]}
            onPress={() => navigateTo("issues", { dataset: activeDataset })}
          >
            <Feather name="alert-triangle" size={14} color="#fff" />
            <Text style={styles.btnActionText}>View Issues ({issues.length})</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnAction, { backgroundColor: colors.success }]}
            onPress={() => navigateTo("cleaning", { dataset: activeDataset })}
          >
            <MaterialCommunityIcons name="broom" size={16} color="#fff" />
            <Text style={styles.btnActionText}>Open Cleaning Studio</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Quality Score Card */}
      <QualityScoreCard scoreData={analysis.quality_score} />

      {/* 4 Metric Stats Cards */}
      <View style={styles.metricsGrid}>
        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Total Dimensions</Text>
            <MaterialCommunityIcons name="table-column" size={18} color={colors.primary} />
          </View>
          <Text style={[styles.metricVal, { color: colors.text }]}>
            {schema.row_count ?? 0} <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textMuted }}>rows</Text>
          </Text>
          <Text style={[styles.metricSub, { color: colors.textMuted }]}>
            {schema.col_count ?? 0} columns ({((schema.row_count || 0) * (schema.col_count || 0)).toLocaleString()} total cells)
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Missing Data</Text>
            <MaterialCommunityIcons name="file-question-outline" size={18} color={colors.warning} />
          </View>
          <Text style={[styles.metricVal, { color: missing.total_missing > 0 ? colors.warning : colors.success }]}>
            {missing.total_missing ?? 0} <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textMuted }}>cells</Text>
          </Text>
          <Text style={[styles.metricSub, { color: colors.textMuted }]}>
            {missing.missing_pct_overall ?? 0}% overall across {missing.columns_with_missing ?? 0} column(s)
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Duplicate Rows</Text>
            <MaterialCommunityIcons name="content-copy" size={18} color={colors.danger} />
          </View>
          <Text style={[styles.metricVal, { color: duplicates.total_duplicates > 0 ? colors.danger : colors.success }]}>
            {duplicates.total_duplicates ?? 0} <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textMuted }}>rows</Text>
          </Text>
          <Text style={[styles.metricSub, { color: colors.textMuted }]}>
            {duplicates.duplicate_pct ?? 0}% exact duplicates in {duplicates.duplicate_groups?.length ?? 0} group(s)
          </Text>
        </View>

        <View style={[styles.metricCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.metricHeader}>
            <Text style={[styles.metricLabel, { color: colors.textMuted }]}>Identified Issues</Text>
            <Feather name="alert-circle" size={18} color={colors.danger} />
          </View>
          <Text style={[styles.metricVal, { color: issues.length > 0 ? colors.danger : colors.success }]}>
            {issues.length} <Text style={{ fontSize: 13, fontWeight: "500", color: colors.textMuted }}>issues</Text>
          </Text>
          <Text style={[styles.metricSub, { color: colors.textMuted }]}>
            Categorized across 6 data quality dimensions
          </Text>
        </View>
      </View>

      {/* Schema Attributes Breakdown Table */}
      <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Column Schema & Semantic Types</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
              Inferred data types, null distributions, and uniqueness cardinalities for each column.
            </Text>
          </View>
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={true}>
          <View style={styles.schemaTable}>
            <View style={[styles.schemaRow, styles.schemaHeaderRow, { backgroundColor: colors.tableHeaderBg, borderBottomColor: colors.border }]}>
              <Text style={[styles.schemaCol, { width: 180, color: colors.textSecondary }]}>Column Name</Text>
              <Text style={[styles.schemaCol, { width: 140, color: colors.textSecondary }]}>Semantic Type</Text>
              <Text style={[styles.schemaCol, { width: 120, color: colors.textSecondary }]}>Storage DType</Text>
              <Text style={[styles.schemaCol, { width: 130, color: colors.textSecondary }]}>Missing (%)</Text>
              <Text style={[styles.schemaCol, { width: 130, color: colors.textSecondary }]}>Unique Values</Text>
            </View>

            {columns.map((col: any, idx: number) => {
              const isAlt = idx % 2 === 1;
              const hasMissing = col.missing_count > 0;
              return (
                <View
                  key={idx}
                  style={[
                    styles.schemaRow,
                    {
                      backgroundColor: isAlt ? colors.tableRowAlt : colors.bgCard,
                      borderBottomColor: colors.border,
                    },
                  ]}
                >
                  <Text style={[styles.schemaCellText, { width: 180, fontWeight: "700", color: colors.text }]}>
                    {col.name}
                  </Text>
                  <View style={{ width: 140, justifyContent: "center" }}>
                    <View style={[styles.typeBadge, { backgroundColor: colors.primaryBg }]}>
                      <Text style={[styles.typeBadgeText, { color: colors.primary }]}>{col.semantic_type || "Unknown"}</Text>
                    </View>
                  </View>
                  <Text style={[styles.schemaCellText, { width: 120, color: colors.textMuted, fontFamily: "monospace" }]}>
                    {col.dtype}
                  </Text>
                  <Text style={[styles.schemaCellText, { width: 130, color: hasMissing ? colors.warning : colors.textSecondary }]}>
                    {col.missing_count} ({col.missing_pct}%)
                  </Text>
                  <Text style={[styles.schemaCellText, { width: 130, color: colors.textSecondary }]}>
                    {col.unique_count} ({col.unique_pct}%)
                  </Text>
                </View>
              );
            })}
          </View>
        </ScrollView>
      </View>

      {/* Paginated Interactive Data Table */}
      <View style={[styles.sectionCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.sectionHeader}>
          <View>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>Interactive Dataset Grid</Text>
            <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
              Double-tap/click any cell to edit in-place. Search across all attributes or sort by column.
            </Text>
          </View>
        </View>

        <DataTable datasetKey={activeDataset} which="working" onCellEdited={handleRefresh} />
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
  },
  emptyContainer: {
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
    maxWidth: 400,
    lineHeight: 18,
    marginBottom: 8,
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  topActions: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  actionLeft: {
    flex: 1,
    minWidth: 240,
  },
  pageHeading: {
    fontSize: 18,
    fontWeight: "800",
  },
  pageSub: {
    fontSize: 12,
    marginTop: 2,
  },
  actionButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    flexWrap: "wrap",
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 12,
    fontWeight: "600",
  },
  btnAction: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  btnActionText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
  },
  metricsGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 12,
    marginBottom: 16,
  },
  metricCard: {
    flex: 1,
    minWidth: 200,
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    gap: 6,
  },
  metricHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  metricLabel: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  metricVal: {
    fontSize: 22,
    fontWeight: "800",
  },
  metricSub: {
    fontSize: 11,
  },
  sectionCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
    marginBottom: 16,
  },
  sectionHeader: {
    marginBottom: 12,
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  sectionSub: {
    fontSize: 12,
    marginTop: 2,
  },
  schemaTable: {
    minWidth: 700,
  },
  schemaRow: {
    flexDirection: "row",
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    alignItems: "center",
  },
  schemaHeaderRow: {
    paddingVertical: 8,
  },
  schemaCol: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  schemaCellText: {
    fontSize: 12,
  },
  typeBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    alignSelf: "flex-start",
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: "700",
  },
});

