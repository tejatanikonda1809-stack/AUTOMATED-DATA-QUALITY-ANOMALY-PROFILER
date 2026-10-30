import React, { useState } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import { PreflightModal, PreflightPreviewData } from "../components/PreflightModal";
import * as api from "../services/api";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

type IssueCategory =
  | "all"
  | "Missing Values"
  | "Duplicate Rows"
  | "Data-Type Issues"
  | "Suspicious Values"
  | "Potential Outliers"
  | "Schema Problems";

export const IssuesScreen: React.FC = () => {
  const { colors } = useTheme();
  const { activeDataset, analyses, refreshAnalysis, navigateTo } = useApp();

  const [selectedCategory, setSelectedCategory] = useState<IssueCategory>("all");
  const [preflightData, setPreflightData] = useState<PreflightPreviewData | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [isApplying, setIsApplying] = useState(false);
  const [pendingAction, setPendingAction] = useState<(() => Promise<void>) | null>(null);

  const analysis = analyses[activeDataset];
  const issues: any[] = analysis?.issue_center || [];

  const categories: Array<{ id: IssueCategory; label: string; icon: string }> = [
    { id: "all", label: "All Issues", icon: "alert-circle" },
    { id: "Missing Values", label: "Missing Values", icon: "help-circle" },
    { id: "Duplicate Rows", label: "Duplicate Rows", icon: "copy" },
    { id: "Data-Type Issues", label: "Data-Type Issues", icon: "type" },
    { id: "Suspicious Values", label: "Suspicious Values", icon: "alert-triangle" },
    { id: "Potential Outliers", label: "Outliers", icon: "activity" },
    { id: "Schema Problems", label: "Schema Issues", icon: "columns" },
  ];

  const filteredIssues = issues.filter((issue) => {
    if (selectedCategory === "all") return true;
    return issue.category === selectedCategory || issue.category_type === selectedCategory;
  });

  const getSeverityColor = (severity: string) => {
    switch (severity?.toLowerCase()) {
      case "critical":
      case "high":
        return colors.danger;
      case "medium":
        return colors.warning;
      case "low":
        return colors.info;
      case "info":
      default:
        return colors.textMuted;
    }
  };

  // Quick Action Handler from Issue Cards
  const handleQuickAction = async (issue: any) => {
    const actionHint = issue.action_hint || issue.category;

    if (actionHint === "remove_duplicates") {
      setPreflightData({
        title: "Remove Exact Duplicate Rows",
        description: "Exact duplicate rows will be removed from the dataset, keeping the first occurrence.",
        affectedCount: issue.count || 0,
        sampleAffected: [],
      });
      setPendingAction(() => async () => {
        await api.removeDuplicates(activeDataset, "first");
      });
      setShowPreflight(true);
    } else if (actionHint === "repair_type") {
      try {
        const col = issue.column;
        const targetType = issue.proposed_type || "float64";
        const preview = await api.previewType(activeDataset, col, targetType);

        setPreflightData({
          title: `Convert Column '${col}' to ${targetType}`,
          description: preview.description || `Convert data type to ${targetType}.`,
          column: col,
          targetType,
          affectedCount: preview.total_values || 0,
          sampleAffected: (preview.sample_conversions || []).map((s: any) => ({
            row: s.row,
            original: s.original,
            new: s.converted,
          })),
        });

        setPendingAction(() => async () => {
          await api.repairType(activeDataset, col, targetType);
        });
        setShowPreflight(true);
      } catch (err: any) {
        alert("Failed to generate type conversion preview: " + err.message);
      }
    } else if (actionHint === "fill_missing") {
      try {
        const col = issue.column;
        const method = issue.is_numeric ? "median" : "mode";
        const preview = await api.previewFillMissing(activeDataset, col, method);

        setPreflightData({
          title: `Impute Missing Values in '${col}'`,
          description: preview.description || `Fill gaps using ${method} imputation.`,
          column: col,
          actionMethod: method,
          replacementValue: preview.replacement_value,
          affectedCount: preview.affected_rows_count || 0,
          sampleAffected: preview.sample_affected || [],
        });

        setPendingAction(() => async () => {
          await api.fillMissing(activeDataset, col, method);
        });
        setShowPreflight(true);
      } catch (err: any) {
        alert("Failed to generate imputation preview: " + err.message);
      }
    } else {
      // Navigate to Cleaning Studio with this issue selected
      navigateTo("cleaning", { dataset: activeDataset, tab: issue.category });
    }
  };

  const handleConfirmPreflight = async () => {
    if (!pendingAction) return;
    setIsApplying(true);
    try {
      await pendingAction();
      await refreshAnalysis(activeDataset);
      setShowPreflight(false);
      setPendingAction(null);
    } catch (err: any) {
      alert("Error applying action: " + (err.message || String(err)));
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Top Banner */}
      <View style={[styles.headerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.headerLeft}>
          <Text style={[styles.heading, { color: colors.text }]}>Data Quality Issue Center</Text>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>
            Review anomalies, corrupt strings, missing data, and type mismatches. Execute guided repairs or jump into the Cleaning Studio.
          </Text>
        </View>

        <TouchableOpacity
          style={[styles.btnStudio, { backgroundColor: colors.primary }]}
          onPress={() => navigateTo("cleaning", { dataset: activeDataset })}
        >
          <MaterialCommunityIcons name="broom" size={16} color="#fff" />
          <Text style={styles.btnStudioText}>Cleaning Studio</Text>
        </TouchableOpacity>
      </View>

      {/* Category Tabs */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.tabsRow}>
        {categories.map((cat) => {
          const isActive = selectedCategory === cat.id;
          const count =
            cat.id === "all"
              ? issues.length
              : issues.filter((i) => i.category === cat.id || i.category_type === cat.id).length;

          return (
            <TouchableOpacity
              key={cat.id}
              style={[
                styles.tabPill,
                {
                  backgroundColor: isActive ? colors.primaryBg : colors.bgCard,
                  borderColor: isActive ? colors.primary : colors.border,
                },
              ]}
              onPress={() => setSelectedCategory(cat.id)}
            >
              <Feather
                name={cat.icon as any}
                size={13}
                color={isActive ? colors.primary : colors.textMuted}
              />
              <Text
                style={[
                  styles.tabLabel,
                  { color: isActive ? colors.primary : colors.textSecondary },
                  isActive && { fontWeight: "700" },
                ]}
              >
                {cat.label}
              </Text>
              <View
                style={[
                  styles.countPill,
                  { backgroundColor: isActive ? colors.primary : colors.bgSecondary },
                ]}
              >
                <Text
                  style={[
                    styles.countPillText,
                    { color: isActive ? "#fff" : colors.textSecondary },
                  ]}
                >
                  {count}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* Issues List */}
      {filteredIssues.length === 0 ? (
        <View style={[styles.emptyCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Feather name="check-circle" size={44} color={colors.success} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No Issues Found in this Category</Text>
          <Text style={[styles.emptySub, { color: colors.textMuted }]}>
            All records meet the quality criteria for {selectedCategory === "all" ? "the dataset" : selectedCategory}.
          </Text>
        </View>
      ) : (
        <View style={styles.issuesList}>
          {filteredIssues.map((issue, idx) => {
            const sevColor = getSeverityColor(issue.severity);
            return (
              <View
                key={idx}
                style={[
                  styles.issueCard,
                  { backgroundColor: colors.bgCard, borderColor: colors.border },
                ]}
              >
                {/* Header Row */}
                <View style={styles.cardTop}>
                  <View style={styles.cardTitleArea}>
                    <Text style={[styles.issueTitle, { color: colors.text }]}>
                      {issue.title || issue.description}
                    </Text>
                    {issue.column && (
                      <View style={[styles.columnPill, { backgroundColor: colors.bgSecondary }]}>
                        <Text style={[styles.columnPillText, { color: colors.textSecondary }]}>
                          Column: {issue.column}
                        </Text>
                      </View>
                    )}
                  </View>

                  <View style={[styles.sevBadge, { backgroundColor: sevColor + "20", borderColor: sevColor }]}>
                    <Text style={[styles.sevText, { color: sevColor }]}>{issue.severity || "medium"}</Text>
                  </View>
                </View>

                {/* What / Why Explanations */}
                <View style={styles.cardBody}>
                  {issue.what && (
                    <Text style={[styles.bodyText, { color: colors.textSecondary }]}>
                      <Text style={{ fontWeight: "700" }}>Finding: </Text>
                      {issue.what}
                    </Text>
                  )}
                  {issue.why && (
                    <Text style={[styles.bodyText, { color: colors.textMuted }]}>
                      <Text style={{ fontWeight: "700" }}>Impact: </Text>
                      {issue.why}
                    </Text>
                  )}
                  {issue.recommendation && (
                    <Text style={[styles.bodyText, { color: colors.primary }]}>
                      <Text style={{ fontWeight: "700" }}>Recommendation: </Text>
                      {issue.recommendation}
                    </Text>
                  )}
                </View>

                {/* Card Action Footer */}
                <View style={[styles.cardFooter, { borderTopColor: colors.border }]}>
                  <Text style={[styles.countNote, { color: colors.textMuted }]}>
                    {issue.count !== undefined ? `${issue.count} record(s) affected` : ""}
                  </Text>

                  <TouchableOpacity
                    style={[styles.btnFix, { backgroundColor: colors.primary }]}
                    onPress={() => handleQuickAction(issue)}
                    activeOpacity={0.8}
                  >
                    <Feather name="tool" size={13} color="#fff" />
                    <Text style={styles.btnFixText}>
                      {issue.action_hint ? `Fix: ${issue.action_hint.replace("_", " ")}` : "Open in Studio"}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Interactive Pre-flight Modal */}
      <PreflightModal
        visible={showPreflight}
        previewData={preflightData}
        onCancel={() => setShowPreflight(false)}
        onConfirm={handleConfirmPreflight}
        isApplying={isApplying}
      />
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
  headerCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 14,
  },
  headerLeft: {
    flex: 1,
    minWidth: 260,
  },
  heading: {
    fontSize: 18,
    fontWeight: "800",
  },
  subheading: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 17,
  },
  btnStudio: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
  },
  btnStudioText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "700",
  },
  tabsRow: {
    flexDirection: "row",
    gap: 8,
    paddingBottom: 14,
  },
  tabPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 20,
    borderWidth: 1,
  },
  tabLabel: {
    fontSize: 12,
  },
  countPill: {
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 10,
    minWidth: 18,
    alignItems: "center",
    justifyContent: "center",
  },
  countPillText: {
    fontSize: 10,
    fontWeight: "700",
  },
  emptyCard: {
    alignItems: "center",
    justifyContent: "center",
    padding: 40,
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: "700",
  },
  emptySub: {
    fontSize: 13,
  },
  issuesList: {
    gap: 12,
  },
  issueCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  cardTop: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 10,
    gap: 10,
  },
  cardTitleArea: {
    flex: 1,
    flexDirection: "row",
    alignItems: "center",
    flexWrap: "wrap",
    gap: 8,
  },
  issueTitle: {
    fontSize: 14,
    fontWeight: "700",
  },
  columnPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 6,
  },
  columnPillText: {
    fontSize: 11,
    fontWeight: "600",
  },
  sevBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    borderWidth: 1,
  },
  sevText: {
    fontSize: 10,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  cardBody: {
    gap: 6,
    marginBottom: 12,
  },
  bodyText: {
    fontSize: 12,
    lineHeight: 18,
  },
  cardFooter: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingTop: 10,
    borderTopWidth: 1,
  },
  countNote: {
    fontSize: 11,
  },
  btnFix: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
  },
  btnFixText: {
    color: "#fff",
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
});

