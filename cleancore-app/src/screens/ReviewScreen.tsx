import React, { useState, useEffect } from "react";
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, ActivityIndicator } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import * as api from "../services/api";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

export const ReviewScreen: React.FC = () => {
  const { colors } = useTheme();
  const { activeDataset, analyses, refreshAnalysis, navigateTo, datasetStates } = useApp();

  const [isFinalizing, setIsFinalizing] = useState(false);
  const [historyList, setHistoryList] = useState<any[]>([]);
  const isFinalized = datasetStates[activeDataset] === "finalized";

  const analysis = analyses[activeDataset];
  const quality = analysis?.quality_score || {};
  const issues = analysis?.issue_center || [];

  useEffect(() => {
    api.getHistory(activeDataset).then((res) => {
      setHistoryList(res.history || []);
    });
  }, [activeDataset]);

  const handleFinalize = async () => {
    setIsFinalizing(true);
    try {
      await api.finalize(activeDataset);
      await refreshAnalysis(activeDataset);
      alert(`Dataset '${activeDataset.toUpperCase()}' has been finalized successfully!`);
    } catch (err: any) {
      alert("Finalization failed: " + err.message);
    } finally {
      setIsFinalizing(false);
    }
  };

  const score = Math.round(quality.score || 0);

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Top Banner */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={styles.topRow}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]}>
              Review & Finalize ({activeDataset.toUpperCase()})
            </Text>
            <Text style={[styles.sub, { color: colors.textMuted }]}>
              Audit all transformations, verify remaining data issues, and finalize the dataset for reporting or comparison.
            </Text>
          </View>

          <View style={[styles.statePill, { backgroundColor: isFinalized ? colors.successBg : colors.warningBg }]}>
            <Text style={[styles.stateText, { color: isFinalized ? colors.success : colors.warning }]}>
              {isFinalized ? "Finalized" : "Working / In-Progress"}
            </Text>
          </View>
        </View>

        {/* Score Card */}
        <View style={[styles.scoreBox, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
          <View style={styles.scoreLeft}>
            <Text style={[styles.scoreValue, { color: colors.primary }]}>{score}</Text>
            <Text style={[styles.scoreMax, { color: colors.textMuted }]}>/ 100</Text>
          </View>
          <View style={styles.scoreRight}>
            <Text style={[styles.scoreLabel, { color: colors.text }]}>Current Quality Score ({quality.label || "Good"})</Text>
            <Text style={[styles.scoreDesc, { color: colors.textMuted }]}>
              {historyList.length > 0
                ? `${historyList.length} cleaning operations applied. Score updated dynamically.`
                : "No cleaning operations applied yet."}
            </Text>
          </View>
        </View>

        {/* Action Buttons */}
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={[
              styles.btnFinalize,
              { backgroundColor: isFinalized ? colors.bgSecondary : colors.success },
            ]}
            onPress={handleFinalize}
            disabled={isFinalizing || isFinalized}
          >
            {isFinalizing ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name={isFinalized ? "lock" : "check"} size={16} color={isFinalized ? colors.textMuted : "#fff"} />
                <Text style={[styles.btnFinalizeText, { color: isFinalized ? colors.textMuted : "#fff" }]}>
                  {isFinalized ? "Dataset Already Finalized" : "Finalize & Lock Dataset"}
                </Text>
              </>
            )}
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.btnReports, { backgroundColor: colors.primary }]}
            onPress={() => navigateTo("reports", { dataset: activeDataset })}
          >
            <Feather name="file-text" size={16} color="#fff" />
            <Text style={styles.btnReportsText}>Proceed to Export Reports →</Text>
          </TouchableOpacity>
        </View>
      </View>

      {/* Applied Changes Audit List */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>Applied Transformation History</Text>
        <Text style={[styles.sectionSub, { color: colors.textMuted }]}>
          Every cell edit, row drop, imputation, and type conversion applied during this session.
        </Text>

        {historyList.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.textMuted }]}>
            No operations have been applied to this dataset yet.
          </Text>
        ) : (
          <View style={styles.historyList}>
            {historyList.map((item, idx) => (
              <View key={idx} style={[styles.historyRow, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
                <View style={[styles.stepNum, { backgroundColor: colors.primaryBg }]}>
                  <Text style={[styles.stepNumText, { color: colors.primary }]}>{idx + 1}</Text>
                </View>
                <View style={{ flex: 1, gap: 2 }}>
                  <View style={{ flexDirection: "row", justifyContent: "space-between" }}>
                    <Text style={[styles.actionTitle, { color: colors.text }]}>{item.action}</Text>
                    {item.column && (
                      <Text style={[styles.actionCol, { color: colors.textMuted }]}>Column: {item.column}</Text>
                    )}
                  </View>
                  <Text style={[styles.actionDesc, { color: colors.textSecondary }]}>{item.description}</Text>
                </View>
              </View>
            ))}
          </View>
        )}
      </View>

      {/* Remaining Issues List */}
      <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Remaining Issues ({issues.length})
        </Text>
        {issues.length === 0 ? (
          <Text style={[styles.emptyText, { color: colors.success }]}>
            ✓ Outstanding! Zero issues remain in this dataset.
          </Text>
        ) : (
          <View style={{ gap: 8, marginTop: 10 }}>
            {issues.slice(0, 5).map((iss: any, i: number) => (
              <View key={i} style={[styles.issueMini, { backgroundColor: colors.bgSecondary }]}>
                <Feather name="alert-circle" size={14} color={colors.warning} />
                <Text style={[styles.issueMiniText, { color: colors.textSecondary }]} numberOfLines={1}>
                  {iss.title || iss.description}
                </Text>
              </View>
            ))}
            {issues.length > 5 && (
              <TouchableOpacity onPress={() => navigateTo("issues", { dataset: activeDataset })}>
                <Text style={[styles.linkText, { color: colors.primary }]}>
                  + {issues.length - 5} more issues. View in Issue Center →
                </Text>
              </TouchableOpacity>
            )}
          </View>
        )}
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
    maxWidth: 960,
    alignSelf: "center",
    width: "100%",
    gap: 16,
  },
  card: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
  },
  topRow: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "flex-start",
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 18,
    fontWeight: "800",
  },
  sub: {
    fontSize: 13,
    marginTop: 2,
    lineHeight: 18,
  },
  statePill: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  stateText: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  scoreBox: {
    flexDirection: "row",
    alignItems: "center",
    padding: 16,
    borderRadius: 10,
    borderWidth: 1,
    gap: 16,
    marginBottom: 18,
  },
  scoreLeft: {
    flexDirection: "row",
    alignItems: "baseline",
    gap: 2,
  },
  scoreValue: {
    fontSize: 36,
    fontWeight: "800",
  },
  scoreMax: {
    fontSize: 14,
    fontWeight: "600",
  },
  scoreRight: {
    flex: 1,
  },
  scoreLabel: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 2,
  },
  scoreDesc: {
    fontSize: 12,
  },
  actionsRow: {
    flexDirection: "row",
    gap: 12,
    flexWrap: "wrap",
  },
  btnFinalize: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnFinalizeText: {
    fontSize: 13,
    fontWeight: "700",
  },
  btnReports: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnReportsText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: "700",
    marginBottom: 4,
  },
  sectionSub: {
    fontSize: 12,
    marginBottom: 14,
  },
  emptyText: {
    fontSize: 13,
    paddingVertical: 10,
  },
  historyList: {
    gap: 8,
  },
  historyRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  stepNum: {
    width: 26,
    height: 26,
    borderRadius: 13,
    alignItems: "center",
    justifyContent: "center",
  },
  stepNumText: {
    fontSize: 12,
    fontWeight: "700",
  },
  actionTitle: {
    fontSize: 13,
    fontWeight: "700",
  },
  actionCol: {
    fontSize: 11,
  },
  actionDesc: {
    fontSize: 12,
  },
  issueMini: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 6,
  },
  issueMiniText: {
    fontSize: 12,
    flex: 1,
  },
  linkText: {
    fontSize: 12,
    fontWeight: "600",
    paddingTop: 4,
  },
});
