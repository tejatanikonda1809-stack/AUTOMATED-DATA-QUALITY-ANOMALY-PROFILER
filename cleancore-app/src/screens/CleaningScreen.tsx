import React, { useState, useEffect } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  TextInput,
  ActivityIndicator,
  Modal,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import { DataTable } from "../components/DataTable";
import { PreflightModal, PreflightPreviewData } from "../components/PreflightModal";
import * as api from "../services/api";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

export const CleaningScreen: React.FC = () => {
  const { colors } = useTheme();
  const { activeDataset, analyses, refreshAnalysis } = useApp();

  const [activeTab, setActiveTab] = useState<"missing" | "type" | "duplicates" | "outliers" | "history">("missing");
  const [isProcessing, setIsProcessing] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);

  // Missing values tool state
  const [selectedMissingCol, setSelectedMissingCol] = useState("");
  const [imputeMethod, setImputeMethod] = useState("median");
  const [manualImputeVal, setManualImputeVal] = useState("");

  // Type repair tool state
  const [selectedTypeCol, setSelectedTypeCol] = useState("");
  const [targetType, setTargetType] = useState("float64");

  // Pre-flight confirmation modal state
  const [preflightData, setPreflightData] = useState<PreflightPreviewData | null>(null);
  const [showPreflight, setShowPreflight] = useState(false);
  const [pendingCleanAction, setPendingCleanAction] = useState<(() => Promise<void>) | null>(null);

  const analysis = analyses[activeDataset];
  const missingCols = analysis?.missing?.affected_columns || [];
  const typeIssues = analysis?.types?.type_issues || [];
  const duplicateCount = analysis?.duplicates?.total_duplicates || 0;
  const outlierDetails = analysis?.outliers?.outlier_details || [];
  const allColumns = analysis?.schema?.column_names || [];

  useEffect(() => {
    if (missingCols.length > 0 && !selectedMissingCol) {
      setSelectedMissingCol(missingCols[0].column);
      setImputeMethod(missingCols[0].is_numeric ? "median" : "mode");
    }
    if (typeIssues.length > 0 && !selectedTypeCol) {
      setSelectedTypeCol(typeIssues[0].column);
      setTargetType(typeIssues[0].proposed_type || "float64");
    } else if (allColumns.length > 0 && !selectedTypeCol) {
      setSelectedTypeCol(allColumns[0]);
    }
  }, [analysis]);

  const loadHistory = async () => {
    try {
      const res = await api.getHistory(activeDataset);
      setHistoryList(res.history || []);
    } catch (err) {
      console.error("Failed to load history:", err);
    }
  };

  useEffect(() => {
    if (activeTab === "history") {
      loadHistory();
    }
  }, [activeTab, activeDataset]);

  // ===== UNDO & RESET =====
  const handleUndo = async () => {
    setIsProcessing(true);
    try {
      await api.undo(activeDataset);
      await refreshAnalysis(activeDataset);
      await loadHistory();
    } catch (err: any) {
      alert("Undo failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  const handleReset = async () => {
    setIsProcessing(true);
    try {
      await api.reset(activeDataset);
      await refreshAnalysis(activeDataset);
      await loadHistory();
    } catch (err: any) {
      alert("Reset failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ===== MISSING VALUES IMPUTATION =====
  const handlePreviewMissing = async () => {
    if (!selectedMissingCol) {
      alert("Please select a column.");
      return;
    }
    setIsProcessing(true);
    try {
      const preview = await api.previewFillMissing(
        activeDataset,
        selectedMissingCol,
        imputeMethod,
        imputeMethod === "manual" ? manualImputeVal : undefined
      );

      setPreflightData({
        title: `Impute '${selectedMissingCol}' using ${imputeMethod}`,
        description: preview.description || `Fill ${preview.affected_rows_count} missing values.`,
        column: selectedMissingCol,
        actionMethod: imputeMethod,
        replacementValue: preview.replacement_value,
        affectedCount: preview.affected_rows_count || 0,
        sampleAffected: preview.sample_affected || [],
      });

      setPendingCleanAction(() => async () => {
        await api.fillMissing(
          activeDataset,
          selectedMissingCol,
          imputeMethod,
          imputeMethod === "manual" ? manualImputeVal : undefined
        );
      });

      setShowPreflight(true);
    } catch (err: any) {
      alert("Imputation preview failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ===== TYPE REPAIR =====
  const handlePreviewType = async () => {
    if (!selectedTypeCol) {
      alert("Please select a column.");
      return;
    }
    setIsProcessing(true);
    try {
      const preview = await api.previewType(activeDataset, selectedTypeCol, targetType);

      setPreflightData({
        title: `Convert '${selectedTypeCol}' to ${targetType}`,
        description: preview.description || `Cast column values to ${targetType}.`,
        column: selectedTypeCol,
        targetType,
        affectedCount: preview.total_values || 0,
        sampleAffected: (preview.sample_conversions || []).map((s: any) => ({
          row: s.row,
          original: s.original,
          new: s.converted,
        })),
      });

      setPendingCleanAction(() => async () => {
        await api.repairType(activeDataset, selectedTypeCol, targetType);
      });

      setShowPreflight(true);
    } catch (err: any) {
      alert("Type preview failed: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  // ===== REMOVE DUPLICATES =====
  const handleRemoveDuplicates = async () => {
    setPreflightData({
      title: "Remove Exact Duplicate Rows",
      description: `All ${duplicateCount} duplicate rows will be removed, preserving the first occurrence.`,
      affectedCount: duplicateCount,
      sampleAffected: [],
    });

    setPendingCleanAction(() => async () => {
      await api.removeDuplicates(activeDataset, "first");
    });

    setShowPreflight(true);
  };

  const handleConfirmPreflight = async () => {
    if (!pendingCleanAction) return;
    setIsProcessing(true);
    try {
      await pendingCleanAction();
      await refreshAnalysis(activeDataset);
      setShowPreflight(false);
      setPendingCleanAction(null);
      await loadHistory();
    } catch (err: any) {
      alert("Error applying clean action: " + err.message);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Studio Header Toolbar */}
      <View style={[styles.toolbarCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.toolbarLeft}>
          <Text style={[styles.toolbarTitle, { color: colors.text }]}>
            Cleaning Studio ({activeDataset.toUpperCase()})
          </Text>
          <Text style={[styles.toolbarSub, { color: colors.textMuted }]}>
            Apply guided transformations with pre-flight simulation, cell edits, and complete rollback capabilities.
          </Text>
        </View>

        <View style={styles.toolbarButtons}>
          <TouchableOpacity
            style={[styles.btnUndo, { borderColor: colors.border, backgroundColor: colors.bgSecondary }]}
            onPress={handleUndo}
            disabled={isProcessing}
          >
            <Feather name="rotate-ccw" size={14} color={colors.textSecondary} />
            <Text style={[styles.btnUndoText, { color: colors.textSecondary }]}>Undo</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnReset, { borderColor: colors.danger, backgroundColor: colors.dangerBg }]}
            onPress={handleReset}
            disabled={isProcessing}
          >
            <Feather name="refresh-ccw" size={14} color={colors.danger} />
            <Text style={[styles.btnResetText, { color: colors.danger }]}>Reset All</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Studio Tool Navigation Tabs */}
      <View style={[styles.tabBar, { borderBottomColor: colors.border }]}>
        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "missing" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("missing")}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === "missing" ? colors.primary : colors.textMuted }]}>
            Impute Missing ({missingCols.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "type" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("type")}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === "type" ? colors.primary : colors.textMuted }]}>
            Repair Types ({typeIssues.length})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "duplicates" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("duplicates")}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === "duplicates" ? colors.primary : colors.textMuted }]}>
            Deduplicate ({duplicateCount})
          </Text>
        </TouchableOpacity>

        <TouchableOpacity
          style={[styles.tabBtn, activeTab === "history" && { borderBottomColor: colors.primary, borderBottomWidth: 2 }]}
          onPress={() => setActiveTab("history")}
        >
          <Text style={[styles.tabBtnText, { color: activeTab === "history" ? colors.primary : colors.textMuted }]}>
            Audit History
          </Text>
        </TouchableOpacity>
      </View>

      {/* Active Tool Form Panel */}
      <View style={[styles.panelCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        {/* TAB 1: MISSING IMPUTATION */}
        {activeTab === "missing" && (
          <View style={styles.toolSection}>
            <Text style={[styles.toolTitle, { color: colors.text }]}>Fill / Impute Missing Values</Text>
            {missingCols.length === 0 ? (
              <Text style={[styles.noIssueText, { color: colors.success }]}>
                ✓ Zero missing values found in this dataset!
              </Text>
            ) : (
              <View style={styles.formRow}>
                {/* Column Selector */}
                <View style={styles.formCol}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Select Column:</Text>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 6 }}>
                    {missingCols.map((col: any) => (
                      <TouchableOpacity
                        key={col.column}
                        style={[
                          styles.chip,
                          {
                            backgroundColor: selectedMissingCol === col.column ? colors.primaryBg : colors.bgSecondary,
                            borderColor: selectedMissingCol === col.column ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => {
                          setSelectedMissingCol(col.column);
                          setImputeMethod(col.is_numeric ? "median" : "mode");
                        }}
                      >
                        <Text
                          style={[
                            styles.chipText,
                            { color: selectedMissingCol === col.column ? colors.primary : colors.textSecondary },
                          ]}
                        >
                          {col.column} ({col.missing_count} nulls)
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>

                {/* Method Selector */}
                <View style={styles.formCol}>
                  <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Imputation Strategy:</Text>
                  <View style={styles.methodsRow}>
                    {["median", "mean", "median_excl_outliers", "mode", "manual", "delete_row"].map((m) => (
                      <TouchableOpacity
                        key={m}
                        style={[
                          styles.methodPill,
                          {
                            backgroundColor: imputeMethod === m ? colors.primary : colors.bgSecondary,
                            borderColor: imputeMethod === m ? colors.primary : colors.border,
                          },
                        ]}
                        onPress={() => setImputeMethod(m)}
                      >
                        <Text style={[styles.methodPillText, { color: imputeMethod === m ? "#fff" : colors.textSecondary }]}>
                          {m.replace(/_/g, " ")}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>

                {imputeMethod === "manual" && (
                  <View style={styles.formCol}>
                    <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Custom Value:</Text>
                    <TextInput
                      style={[styles.textInput, { backgroundColor: colors.bgSecondary, borderColor: colors.border, color: colors.text }]}
                      value={manualImputeVal}
                      onChangeText={setManualImputeVal}
                      placeholder="Enter custom replacement value..."
                      placeholderTextColor={colors.textMuted}
                    />
                  </View>
                )}

                <TouchableOpacity
                  style={[styles.btnApply, { backgroundColor: colors.primary }]}
                  onPress={handlePreviewMissing}
                  disabled={isProcessing}
                >
                  <Feather name="eye" size={14} color="#fff" />
                  <Text style={styles.btnApplyText}>Preview & Impute</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* TAB 2: TYPE REPAIR */}
        {activeTab === "type" && (
          <View style={styles.toolSection}>
            <Text style={[styles.toolTitle, { color: colors.text }]}>Repair Column Data Types</Text>
            <View style={styles.formRow}>
              {/* Column Selector */}
              <View style={styles.formCol}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Select Column:</Text>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ flexDirection: "row", gap: 6 }}>
                  {allColumns.map((col: string) => (
                    <TouchableOpacity
                      key={col}
                      style={[
                        styles.chip,
                        {
                          backgroundColor: selectedTypeCol === col ? colors.primaryBg : colors.bgSecondary,
                          borderColor: selectedTypeCol === col ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setSelectedTypeCol(col)}
                    >
                      <Text
                        style={[
                          styles.chipText,
                          { color: selectedTypeCol === col ? colors.primary : colors.textSecondary },
                        ]}
                      >
                        {col}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              </View>

              {/* Target Type Selector */}
              <View style={styles.formCol}>
                <Text style={[styles.inputLabel, { color: colors.textSecondary }]}>Target Storage Type:</Text>
                <View style={styles.methodsRow}>
                  {["float64", "int64", "datetime64", "str"].map((t) => (
                    <TouchableOpacity
                      key={t}
                      style={[
                        styles.methodPill,
                        {
                          backgroundColor: targetType === t ? colors.primary : colors.bgSecondary,
                          borderColor: targetType === t ? colors.primary : colors.border,
                        },
                      ]}
                      onPress={() => setTargetType(t)}
                    >
                      <Text style={[styles.methodPillText, { color: targetType === t ? "#fff" : colors.textSecondary }]}>
                        {t}
                      </Text>
                    </TouchableOpacity>
                  ))}
                </View>
              </View>

              <TouchableOpacity
                style={[styles.btnApply, { backgroundColor: colors.primary }]}
                onPress={handlePreviewType}
                disabled={isProcessing}
              >
                <Feather name="eye" size={14} color="#fff" />
                <Text style={styles.btnApplyText}>Preview & Convert</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}

        {/* TAB 3: DEDUPLICATION */}
        {activeTab === "duplicates" && (
          <View style={styles.toolSection}>
            <Text style={[styles.toolTitle, { color: colors.text }]}>Exact Duplicate Row Removal</Text>
            {duplicateCount === 0 ? (
              <Text style={[styles.noIssueText, { color: colors.success }]}>
                ✓ Zero exact duplicate rows found in this dataset!
              </Text>
            ) : (
              <View style={styles.dedupBox}>
                <Text style={[styles.dedupDesc, { color: colors.textSecondary }]}>
                  {duplicateCount} complete-row exact duplicates detected. Removing them preserves original row order and keeps the first occurrence.
                </Text>
                <TouchableOpacity
                  style={[styles.btnApply, { backgroundColor: colors.danger, alignSelf: "flex-start" }]}
                  onPress={handleRemoveDuplicates}
                  disabled={isProcessing}
                >
                  <MaterialCommunityIcons name="delete-sweep" size={16} color="#fff" />
                  <Text style={styles.btnApplyText}>Remove All {duplicateCount} Duplicate Rows</Text>
                </TouchableOpacity>
              </View>
            )}
          </View>
        )}

        {/* TAB 4: AUDIT HISTORY */}
        {activeTab === "history" && (
          <View style={styles.toolSection}>
            <Text style={[styles.toolTitle, { color: colors.text }]}>Change Audit Trail ({historyList.length} actions)</Text>
            {historyList.length === 0 ? (
              <Text style={[styles.noIssueText, { color: colors.textMuted }]}>
                No transformations applied yet in this session.
              </Text>
            ) : (
              <View style={styles.historyList}>
                {historyList.map((entry, idx) => (
                  <View key={idx} style={[styles.historyCard, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                    <View style={styles.historyHeader}>
                      <Text style={[styles.historyAction, { color: colors.primary }]}>{entry.action}</Text>
                      <Text style={[styles.historyCol, { color: colors.textMuted }]}>
                        {entry.column ? `Column: ${entry.column}` : ""}
                      </Text>
                    </View>
                    <Text style={[styles.historyDesc, { color: colors.textSecondary }]}>{entry.description}</Text>
                  </View>
                ))}
              </View>
            )}
          </View>
        )}
      </View>

      {/* Live Data Grid */}
      <View style={[styles.gridCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.gridTitle, { color: colors.text }]}>Live Dataset Preview</Text>
        <DataTable datasetKey={activeDataset} which="working" onCellEdited={() => refreshAnalysis(activeDataset)} />
      </View>

      {/* Pre-flight Confirmation Simulation Modal */}
      <PreflightModal
        visible={showPreflight}
        previewData={preflightData}
        onCancel={() => setShowPreflight(false)}
        onConfirm={handleConfirmPreflight}
        isApplying={isProcessing}
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
    maxWidth: 1100,
    alignSelf: "center",
    width: "100%",
  },
  toolbarCard: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 16,
    borderRadius: 14,
    borderWidth: 1,
    marginBottom: 16,
    flexWrap: "wrap",
    gap: 12,
  },
  toolbarLeft: {
    flex: 1,
    minWidth: 260,
  },
  toolbarTitle: {
    fontSize: 17,
    fontWeight: "800",
  },
  toolbarSub: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 16,
  },
  toolbarButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  btnUndo: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnUndoText: {
    fontSize: 12,
    fontWeight: "600",
  },
  btnReset: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnResetText: {
    fontSize: 12,
    fontWeight: "600",
  },
  tabBar: {
    flexDirection: "row",
    borderBottomWidth: 1,
    marginBottom: 16,
    gap: 16,
  },
  tabBtn: {
    paddingVertical: 10,
    paddingHorizontal: 4,
  },
  tabBtnText: {
    fontSize: 13,
    fontWeight: "600",
  },
  panelCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 18,
    marginBottom: 16,
  },
  toolSection: {
    gap: 12,
  },
  toolTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  noIssueText: {
    fontSize: 13,
    fontWeight: "600",
    paddingVertical: 10,
  },
  formRow: {
    gap: 12,
  },
  formCol: {
    gap: 6,
  },
  inputLabel: {
    fontSize: 12,
    fontWeight: "600",
  },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  chipText: {
    fontSize: 12,
    fontWeight: "600",
  },
  methodsRow: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8,
  },
  methodPill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 6,
    borderWidth: 1,
  },
  methodPillText: {
    fontSize: 12,
    fontWeight: "600",
    textTransform: "capitalize",
  },
  textInput: {
    height: 40,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 13,
  },
  btnApply: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
    marginTop: 8,
    alignSelf: "flex-start",
  },
  btnApplyText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  dedupBox: {
    gap: 12,
  },
  dedupDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  historyList: {
    gap: 8,
  },
  historyCard: {
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    gap: 4,
  },
  historyHeader: {
    flexDirection: "row",
    justifyContent: "space-between",
  },
  historyAction: {
    fontSize: 12,
    fontWeight: "700",
  },
  historyCol: {
    fontSize: 11,
  },
  historyDesc: {
    fontSize: 12,
  },
  gridCard: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 16,
  },
  gridTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 8,
  },
});

