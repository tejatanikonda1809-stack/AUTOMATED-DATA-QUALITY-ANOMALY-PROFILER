import React from "react";
import { Modal, View, Text, StyleSheet, TouchableOpacity, ScrollView } from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

interface SheetSelectModalProps {
  visible: boolean;
  sheets: string[];
  filename: string;
  onSelectSheet: (sheetName: string) => void;
  onClose: () => void;
}

export const SheetSelectModal: React.FC<SheetSelectModalProps> = ({
  visible,
  sheets,
  filename,
  onSelectSheet,
  onClose,
}) => {
  const { colors } = useTheme();

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.modalBackdrop }]}>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
              <MaterialCommunityIcons name="file-excel-box" size={24} color="#10b981" />
              <View>
                <Text style={[styles.title, { color: colors.text }]}>Select Worksheet</Text>
                <Text style={[styles.sub, { color: colors.textMuted }]} numberOfLines={1}>
                  {filename}
                </Text>
              </View>
            </View>
            <TouchableOpacity onPress={onClose}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.instruction, { color: colors.textSecondary }]}>
            This Excel workbook contains multiple sheets. Choose which sheet you want to profile and clean:
          </Text>

          <ScrollView style={{ maxHeight: 280 }} showsVerticalScrollIndicator={true}>
            <View style={styles.sheetList}>
              {sheets.map((sheet, idx) => (
                <TouchableOpacity
                  key={idx}
                  style={[
                    styles.sheetItem,
                    {
                      backgroundColor: colors.bgSecondary,
                      borderColor: colors.border,
                    },
                  ]}
                  onPress={() => onSelectSheet(sheet)}
                  activeOpacity={0.7}
                >
                  <View style={{ flexDirection: "row", alignItems: "center", gap: 10 }}>
                    <MaterialCommunityIcons name="table" size={18} color={colors.primary} />
                    <Text style={[styles.sheetName, { color: colors.text }]}>{sheet}</Text>
                  </View>
                  <Feather name="chevron-right" size={16} color={colors.textMuted} />
                </TouchableOpacity>
              ))}
            </View>
          </ScrollView>
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
    maxWidth: 440,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 14,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  sub: {
    fontSize: 12,
    marginTop: 2,
    maxWidth: 300,
  },
  instruction: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 14,
  },
  sheetList: {
    gap: 8,
  },
  sheetItem: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
  },
  sheetName: {
    fontSize: 14,
    fontWeight: "600",
  },
});

