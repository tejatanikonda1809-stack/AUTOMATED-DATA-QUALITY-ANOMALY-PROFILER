import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import * as DocumentPicker from "expo-document-picker";
import * as api from "../services/api";
import { SheetSelectModal } from "../components/SheetSelectModal";
import { MaterialCommunityIcons, Feather } from "@expo/vector-icons";

export const UploadScreen: React.FC = () => {
  const { colors } = useTheme();
  const { mode, activeDataset, setActiveDataset, navigateTo, refreshAnalysis } = useApp();

  const [isUploading, setIsUploading] = useState(false);
  const [uploadStatus, setUploadStatus] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  // Multi-sheet Excel modal state
  const [excelSheets, setExcelSheets] = useState<string[]>([]);
  const [excelFilename, setExcelFilename] = useState("");
  const [showSheetModal, setShowSheetModal] = useState(false);

  const handlePickFile = async () => {
    setErrorMessage(null);
    setUploadStatus("Selecting file...");

    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: [
          "text/csv",
          "text/comma-separated-values",
          "application/vnd.ms-excel",
          "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
          "*/*",
        ],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        setUploadStatus(null);
        return;
      }

      const asset = result.assets[0];
      const filename = asset.name;
      const uri = asset.uri;
      const mimeType = asset.mimeType || (filename.endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
      const fileObject = (asset as any).file; // Available on Expo Web

      setIsUploading(true);
      setUploadStatus(`Uploading ${filename}...`);

      const res = await api.uploadFile(
        {
          uri,
          name: filename,
          type: mimeType,
          fileObject,
        },
        activeDataset
      );

      if (res.file_type === "excel" && res.sheets) {
        setExcelSheets(res.sheets);
        setExcelFilename(filename);
        setIsUploading(false);
        setUploadStatus(null);
        setShowSheetModal(true);
      } else {
        setUploadStatus("Profiling dataset...");
        await refreshAnalysis(activeDataset);
        setIsUploading(false);
        setUploadStatus(null);
        navigateTo("overview", { dataset: activeDataset });
      }
    } catch (err: any) {
      setIsUploading(false);
      setUploadStatus(null);
      setErrorMessage(err.message || "Failed to upload and profile dataset.");
    }
  };

  const handleSheetSelected = async (sheetName: string) => {
    setShowSheetModal(false);
    setIsUploading(true);
    setUploadStatus(`Loading sheet '${sheetName}' and profiling...`);
    try {
      await api.loadExcelSheet(sheetName, activeDataset);
      await refreshAnalysis(activeDataset);
      setIsUploading(false);
      setUploadStatus(null);
      navigateTo("overview", { dataset: activeDataset });
    } catch (err: any) {
      setIsUploading(false);
      setUploadStatus(null);
      setErrorMessage(err.message || "Failed to load selected Excel worksheet.");
    }
  };

  const getDatasetLabel = () => {
    if (mode === "compare") {
      return activeDataset === "ref" ? "Reference Dataset" : "Current Dataset";
    }
    return "Dataset";
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Target Dataset Switcher for Comparative Mode */}
      {mode === "compare" && (
        <View style={[styles.datasetPickerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Target Comparative Slot</Text>
          <View style={[styles.datasetToggleGroup, { backgroundColor: colors.bgSecondary, borderColor: colors.border }]}>
            <TouchableOpacity
              style={[
                styles.datasetToggleBtn,
                activeDataset === "ref" && { backgroundColor: colors.bgCard, elevation: 1 },
              ]}
              onPress={() => setActiveDataset("ref")}
            >
              <Text
                style={[
                  styles.datasetToggleText,
                  { color: activeDataset === "ref" ? colors.primary : colors.textMuted },
                ]}
              >
                1. Reference Dataset (Baseline)
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[
                styles.datasetToggleBtn,
                activeDataset === "cur" && { backgroundColor: colors.bgCard, elevation: 1 },
              ]}
              onPress={() => setActiveDataset("cur")}
            >
              <Text
                style={[
                  styles.datasetToggleText,
                  { color: activeDataset === "cur" ? colors.primary : colors.textMuted },
                ]}
              >
                2. Current Dataset (Comparison)
              </Text>
            </TouchableOpacity>
          </View>
        </View>
      )}

      {/* Main Upload Dropzone */}
      <View style={[styles.uploadCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={[styles.iconContainer, { backgroundColor: colors.primaryBg }]}>
          <MaterialCommunityIcons name="cloud-upload-outline" size={48} color={colors.primary} />
        </View>

        <Text style={[styles.uploadHeading, { color: colors.text }]}>
          Upload {getDatasetLabel()}
        </Text>
        <Text style={[styles.uploadSub, { color: colors.textMuted }]}>
          Select a CSV or Excel spreadsheet (.csv, .xlsx, .xls) up to 100 MB. CleanCore will automatically scan for missing values, duplicates, outliers, and type inconsistencies.
        </Text>

        {errorMessage && (
          <View style={[styles.errorBox, { backgroundColor: colors.dangerBg, borderColor: colors.danger }]}>
            <Feather name="alert-triangle" size={16} color={colors.danger} />
            <Text style={[styles.errorText, { color: colors.danger }]}>{errorMessage}</Text>
          </View>
        )}

        {isUploading ? (
          <View style={styles.loadingBox}>
            <ActivityIndicator size="large" color={colors.primary} />
            <Text style={[styles.statusText, { color: colors.primary }]}>{uploadStatus}</Text>
          </View>
        ) : (
          <TouchableOpacity
            style={[styles.uploadButton, { backgroundColor: colors.primary }]}
            onPress={handlePickFile}
            activeOpacity={0.8}
          >
            <Feather name="folder" size={18} color="#fff" />
            <Text style={styles.uploadButtonText}>Browse & Upload File</Text>
          </TouchableOpacity>
        )}

        <View style={[styles.formatNotice, { borderTopColor: colors.border }]}>
          <Text style={[styles.formatText, { color: colors.textMuted }]}>
            Supported file formats: <Text style={{ fontWeight: "700" }}>CSV</Text> (auto-encoding), <Text style={{ fontWeight: "700" }}>Excel XLSX/XLS</Text> (with worksheet selector).
          </Text>
        </View>
      </View>

      {/* Sheet Select Modal for Multi-sheet Excel files */}
      <SheetSelectModal
        visible={showSheetModal}
        sheets={excelSheets}
        filename={excelFilename}
        onSelectSheet={handleSheetSelected}
        onClose={() => setShowSheetModal(false)}
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
    maxWidth: 720,
    alignSelf: "center",
    width: "100%",
  },
  datasetPickerCard: {
    borderRadius: 14,
    borderWidth: 1,
    padding: 16,
    marginBottom: 20,
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: "700",
    marginBottom: 10,
  },
  datasetToggleGroup: {
    flexDirection: "row",
    borderRadius: 8,
    borderWidth: 1,
    padding: 3,
  },
  datasetToggleBtn: {
    flex: 1,
    paddingVertical: 10,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 6,
  },
  datasetToggleText: {
    fontSize: 12,
    fontWeight: "600",
  },
  uploadCard: {
    borderRadius: 16,
    borderWidth: 1,
    padding: 32,
    alignItems: "center",
    textAlign: "center",
  },
  iconContainer: {
    width: 80,
    height: 80,
    borderRadius: 20,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 20,
  },
  uploadHeading: {
    fontSize: 20,
    fontWeight: "800",
    marginBottom: 8,
    textAlign: "center",
  },
  uploadSub: {
    fontSize: 13,
    lineHeight: 19,
    textAlign: "center",
    maxWidth: 480,
    marginBottom: 24,
  },
  errorBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 12,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
    width: "100%",
  },
  errorText: {
    fontSize: 12,
    flex: 1,
  },
  loadingBox: {
    padding: 24,
    alignItems: "center",
    gap: 12,
  },
  statusText: {
    fontSize: 14,
    fontWeight: "600",
  },
  uploadButton: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    paddingHorizontal: 28,
    paddingVertical: 14,
    borderRadius: 10,
    marginBottom: 24,
    ...Platform.select({
      ios: { shadowColor: "#2563eb", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8 },
      android: { elevation: 4 },
      web: { boxShadow: "0 4px 14px rgba(37,99,235,0.3)" },
    }),
  },
  uploadButtonText: {
    color: "#fff",
    fontSize: 14,
    fontWeight: "700",
  },
  formatNotice: {
    borderTopWidth: 1,
    paddingTop: 16,
    width: "100%",
    alignItems: "center",
  },
  formatText: {
    fontSize: 12,
    textAlign: "center",
  },
});

