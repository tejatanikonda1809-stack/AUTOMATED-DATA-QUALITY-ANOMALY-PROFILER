import React from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Feather } from "@expo/vector-icons";

export interface PreflightPreviewData {
  title: string;
  description: string;
  column?: string;
  actionMethod?: string;
  replacementValue?: any;
  targetType?: string;
  affectedCount: number;
  sampleAffected?: Array<{
    row: number;
    original: any;
    new: any;
  }>;
}

interface PreflightModalProps {
  visible: boolean;
  previewData: PreflightPreviewData | null;
  onCancel: () => void;
  onConfirm: () => void;
  isApplying?: boolean;
}

export const PreflightModal: React.FC<PreflightModalProps> = ({
  visible,
  previewData,
  onCancel,
  onConfirm,
  isApplying = false,
}) => {
  const { colors } = useTheme();

  if (!previewData) return null;

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onCancel}>
      <View style={[styles.backdrop, { backgroundColor: colors.modalBackdrop }]}>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          {/* Header */}
          <View style={styles.header}>
            <View style={{ flex: 1 }}>
              <Text style={[styles.title, { color: colors.text }]}>{previewData.title}</Text>
              <Text style={[styles.sub, { color: colors.textMuted }]}>{previewData.description}</Text>
            </View>
            <TouchableOpacity onPress={onCancel} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          {/* Stats Bar */}
          <View style={[styles.statsRow, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <View style={styles.statItem}>
              <Text style={[styles.statLabel, { color: colors.textMuted }]}>Affected Rows</Text>
              <Text style={[styles.statValue, { color: colors.primary }]}>{previewData.affectedCount}</Text>
            </View>
            {previewData.targetType && (
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Target Type</Text>
                <Text style={[styles.statValue, { color: colors.text }]}>{previewData.targetType}</Text>
              </View>
            )}
            {previewData.replacementValue !== undefined && (
              <View style={styles.statItem}>
                <Text style={[styles.statLabel, { color: colors.textMuted }]}>Replacement</Text>
                <Text style={[styles.statValue, { color: colors.success }]}>
                  {String(previewData.replacementValue)}
                </Text>
              </View>
            )}
          </View>

          {/* Sample Affected Rows Table */}
          {previewData.sampleAffected && previewData.sampleAffected.length > 0 && (
            <View style={styles.tableSection}>
              <Text style={[styles.tableTitle, { color: colors.textSecondary }]}>
                Sample Affected Rows (First {previewData.sampleAffected.length})
              </Text>
              <View style={[styles.tableContainer, { borderColor: colors.border }]}>
                <View style={[styles.tableHeader, { backgroundColor: colors.tableHeaderBg, borderBottomColor: colors.border }]}>
                  <Text style={[styles.colHeader, { flex: 0.8, color: colors.textSecondary }]}>Row #</Text>
                  <Text style={[styles.colHeader, { flex: 2, color: colors.danger }]}>Original Value</Text>
                  <Text style={[styles.colHeader, { flex: 2, color: colors.success }]}>New Value</Text>
                </View>

                <ScrollView style={{ maxHeight: 220 }} showsVerticalScrollIndicator={true}>
                  {previewData.sampleAffected.map((item, idx) => (
                    <View
                      key={idx}
                      style={[
                        styles.tableRow,
                        {
                          backgroundColor: idx % 2 === 1 ? colors.tableRowAlt : colors.bgCard,
                          borderBottomColor: colors.border,
                        },
                      ]}
                    >
                      <Text style={[styles.rowText, { flex: 0.8, color: colors.textMuted }]}>{item.row}</Text>
                      <Text style={[styles.rowText, { flex: 2, color: colors.textSecondary }]} numberOfLines={1}>
                        {item.original === null || item.original === undefined || item.original === "" ? "Missing" : String(item.original)}
                      </Text>
                      <Text style={[styles.rowText, { flex: 2, color: colors.success, fontWeight: "600" }]} numberOfLines={1}>
                        {String(item.new)}
                      </Text>
                    </View>
                  ))}
                </ScrollView>
              </View>
            </View>
          )}

          {/* Footer Action Buttons */}
          <View style={styles.footer}>
            <TouchableOpacity
              style={[styles.btnCancel, { borderColor: colors.border }]}
              onPress={onCancel}
              disabled={isApplying}
            >
              <Text style={[styles.btnCancelText, { color: colors.textSecondary }]}>Cancel</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnConfirm, { backgroundColor: colors.primary }]}
              onPress={onConfirm}
              disabled={isApplying}
            >
              {isApplying ? (
                <ActivityIndicator size="small" color="#fff" />
              ) : (
                <Text style={styles.btnConfirmText}>Apply Changes</Text>
              )}
            </TouchableOpacity>
          </View>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  backdrop: {
    flex: 1,
    justifyContent: "center",
    alignItems: "center",
    padding: 20,
  },
  card: {
    width: "100%",
    maxWidth: 540,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "flex-start",
    justifyContent: "space-between",
    marginBottom: 16,
    gap: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
    marginBottom: 4,
  },
  sub: {
    fontSize: 13,
    lineHeight: 18,
  },
  statsRow: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    padding: 12,
    marginBottom: 16,
    gap: 16,
  },
  statItem: {
    flex: 1,
  },
  statLabel: {
    fontSize: 11,
    fontWeight: "600",
    marginBottom: 2,
    textTransform: "uppercase",
  },
  statValue: {
    fontSize: 15,
    fontWeight: "700",
  },
  tableSection: {
    marginBottom: 20,
  },
  tableTitle: {
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 8,
  },
  tableContainer: {
    borderRadius: 8,
    borderWidth: 1,
    overflow: "hidden",
  },
  tableHeader: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  colHeader: {
    fontSize: 11,
    fontWeight: "700",
    textTransform: "uppercase",
  },
  tableRow: {
    flexDirection: "row",
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
  },
  rowText: {
    fontSize: 12,
  },
  footer: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  btnCancel: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnCancelText: {
    fontSize: 13,
    fontWeight: "600",
  },
  btnConfirm: {
    paddingVertical: 9,
    paddingHorizontal: 18,
    borderRadius: 8,
    minWidth: 120,
    alignItems: "center",
    justifyContent: "center",
  },
  btnConfirmText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});

