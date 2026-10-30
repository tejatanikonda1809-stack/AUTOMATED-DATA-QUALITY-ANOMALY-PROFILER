import React, { useState } from "react";
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
  Linking,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import * as api from "../services/api";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { MaterialCommunityIcons, Feather, Ionicons } from "@expo/vector-icons";

export const ReportsScreen: React.FC = () => {
  const { colors } = useTheme();
  const { activeDataset, mode, sessionId, analyses } = useApp();

  const [isDownloading, setIsDownloading] = useState<string | null>(null);
  const [downloadMsg, setDownloadMsg] = useState<string | null>(null);

  const analysis = analyses[activeDataset];
  const quality = analysis?.quality_score || {};

  // Download & Share Helper
  const handleDownloadFile = async (
    type: "csv" | "missing-log" | "pdf" | "html",
    title: string
  ) => {
    setIsDownloading(type);
    setDownloadMsg(`Preparing ${title}...`);

    try {
      if (Platform.OS === "web") {
        let url = "";
        if (type === "csv") {
          url = api.getDownloadDatasetUrl(activeDataset);
        } else if (type === "missing-log") {
          url = api.getDownloadMissingLogUrl(activeDataset);
        } else if (type === "pdf") {
          const blob = await api.fetchReportPdfBlob(mode, mode === "compare" ? "comparison" : "analysis");
          url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `cleancore_${mode}_report.pdf`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setDownloadMsg(`Downloaded ${title} successfully.`);
          setIsDownloading(null);
          return;
        } else if (type === "html") {
          const htmlContent = await api.fetchReportHtml(mode, mode === "compare" ? "comparison" : "analysis");
          const blob = new Blob([htmlContent], { type: "text/html" });
          url = window.URL.createObjectURL(blob);
          const a = document.createElement("a");
          a.href = url;
          a.download = `cleancore_${mode}_report.html`;
          document.body.appendChild(a);
          a.click();
          a.remove();
          setDownloadMsg(`Downloaded ${title} successfully.`);
          setIsDownloading(null);
          return;
        }

        if (url) {
          window.open(url, "_blank");
          setDownloadMsg(`Downloaded ${title} successfully.`);
        }
      } else {
        // Native Android: Download to cache / doc directory & share
        let downloadUrl = "";
        let filename = "";

        if (type === "csv") {
          downloadUrl = api.getDownloadDatasetUrl(activeDataset);
          filename = `cleaned_dataset_${activeDataset}.csv`;
        } else if (type === "missing-log") {
          downloadUrl = api.getDownloadMissingLogUrl(activeDataset);
          filename = `missing_log_${activeDataset}.csv`;
        }

        if (downloadUrl) {
          const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || "";
          const fileUri = `${cacheDir}${filename}`;
          const downloadRes = await (FileSystem as any).downloadAsync(downloadUrl, fileUri);

          if (await Sharing.isAvailableAsync()) {
            await Sharing.shareAsync(downloadRes.uri, {
              mimeType: "text/csv",
              dialogTitle: `Save / Share ${title}`,
            });
          }
          setDownloadMsg(`Saved & shared ${filename}.`);
        } else {
          // For PDF/HTML via POST on mobile
          setDownloadMsg("Please use browser/web mode for PDF rendering or download from web view.");
        }
      }
    } catch (err: any) {
      alert(`Download error: ${err.message || String(err)}`);
    } finally {
      setIsDownloading(null);
    }
  };

  return (
    <ScrollView style={[styles.container, { backgroundColor: colors.bg }]} contentContainerStyle={styles.content}>
      {/* Top Banner */}
      <View style={[styles.headerCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
        <View style={{ flex: 1 }}>
          <Text style={[styles.heading, { color: colors.text }]}>Reports & Export Center</Text>
          <Text style={[styles.subheading, { color: colors.textMuted }]}>
            Download sanitized datasets, granular transformation logs, and enterprise-grade PDF & HTML audit reports.
          </Text>
        </View>

        {downloadMsg && (
          <View style={[styles.msgBox, { backgroundColor: colors.successBg, borderColor: colors.success }]}>
            <Feather name="check" size={14} color={colors.success} />
            <Text style={[styles.msgText, { color: colors.success }]}>{downloadMsg}</Text>
          </View>
        )}
      </View>

      {/* Export Options Grid */}
      <View style={styles.grid}>
        {/* 1. Cleaned CSV */}
        <View style={[styles.exportCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.successBg }]}>
            <MaterialCommunityIcons name="file-delimited-outline" size={26} color={colors.success} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Cleaned Dataset (CSV)</Text>
          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
            Export the current working dataset with all imputed values, deduplicated records, and type casts applied.
          </Text>
          <TouchableOpacity
            style={[styles.btnDownload, { backgroundColor: colors.success }]}
            onPress={() => handleDownloadFile("csv", "Cleaned CSV")}
            disabled={isDownloading !== null}
          >
            {isDownloading === "csv" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="download" size={15} color="#fff" />
                <Text style={styles.btnDownloadText}>Download Cleaned CSV</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 2. WeasyPrint PDF Audit Report */}
        <View style={[styles.exportCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.dangerBg }]}>
            <MaterialCommunityIcons name="file-pdf-box" size={26} color={colors.danger} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>WeasyPrint PDF Report</Text>
          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
            Complete publication-grade vector PDF audit report containing quality score breakdown, issue findings, and charts.
          </Text>
          <TouchableOpacity
            style={[styles.btnDownload, { backgroundColor: colors.danger }]}
            onPress={() => handleDownloadFile("pdf", "PDF Audit Report")}
            disabled={isDownloading !== null}
          >
            {isDownloading === "pdf" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="download" size={15} color="#fff" />
                <Text style={styles.btnDownloadText}>Export Vector PDF</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 3. Standalone Interactive HTML Report */}
        <View style={[styles.exportCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.primaryBg }]}>
            <MaterialCommunityIcons name="language-html5" size={26} color={colors.primary} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Standalone HTML Report</Text>
          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
            Self-contained HTML report with embedded styles, responsive tables, and interactive Plotly visualization charts.
          </Text>
          <TouchableOpacity
            style={[styles.btnDownload, { backgroundColor: colors.primary }]}
            onPress={() => handleDownloadFile("html", "HTML Report")}
            disabled={isDownloading !== null}
          >
            {isDownloading === "html" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="download" size={15} color="#fff" />
                <Text style={styles.btnDownloadText}>Download HTML Report</Text>
              </>
            )}
          </TouchableOpacity>
        </View>

        {/* 4. Missing Values Audit Log */}
        <View style={[styles.exportCard, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={[styles.iconWrap, { backgroundColor: colors.warningBg }]}>
            <MaterialCommunityIcons name="clipboard-text-clock-outline" size={26} color={colors.warning} />
          </View>
          <Text style={[styles.cardTitle, { color: colors.text }]}>Missing Values Audit Log</Text>
          <Text style={[styles.cardDesc, { color: colors.textMuted }]}>
            Granular CSV log containing all cells that were missing and the specific mathematical imputation methods applied.
          </Text>
          <TouchableOpacity
            style={[styles.btnDownload, { backgroundColor: colors.warning }]}
            onPress={() => handleDownloadFile("missing-log", "Missing Values Log")}
            disabled={isDownloading !== null}
          >
            {isDownloading === "missing-log" ? (
              <ActivityIndicator size="small" color="#fff" />
            ) : (
              <>
                <Feather name="download" size={15} color="#fff" />
                <Text style={styles.btnDownloadText}>Download Missing Log (CSV)</Text>
              </>
            )}
          </TouchableOpacity>
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
    gap: 16,
  },
  headerCard: {
    padding: 20,
    borderRadius: 14,
    borderWidth: 1,
    gap: 12,
  },
  heading: {
    fontSize: 18,
    fontWeight: "800",
  },
  subheading: {
    fontSize: 12,
    marginTop: 2,
    lineHeight: 18,
  },
  msgBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
  },
  msgText: {
    fontSize: 12,
    fontWeight: "600",
  },
  grid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 16,
  },
  exportCard: {
    flex: 1,
    minWidth: 260,
    borderRadius: 14,
    borderWidth: 1,
    padding: 20,
    gap: 10,
  },
  iconWrap: {
    width: 48,
    height: 48,
    borderRadius: 12,
    alignItems: "center",
    justifyContent: "center",
    marginBottom: 4,
  },
  cardTitle: {
    fontSize: 15,
    fontWeight: "700",
  },
  cardDesc: {
    fontSize: 12,
    lineHeight: 17,
    flex: 1,
    marginBottom: 8,
  },
  btnDownload: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "center",
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 8,
  },
  btnDownloadText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "700",
  },
});
