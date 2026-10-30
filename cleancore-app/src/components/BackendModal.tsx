import React, { useState, useEffect } from "react";
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  Platform,
} from "react-native";
import { useTheme } from "../theme/ThemeContext";
import { useApp } from "../context/AppContext";
import { setBackendUrl, getBackendUrl, getDefaultBackendUrl } from "../services/apiConfig";
import * as api from "../services/api";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

interface BackendModalProps {
  visible: boolean;
  onClose: () => void;
}

export const BackendModal: React.FC<BackendModalProps> = ({ visible, onClose }) => {
  const { colors } = useTheme();
  const { backendOnline, refreshBackendUrl, initNewSession } = useApp();
  const [urlInput, setUrlInput] = useState("");
  const [isTesting, setIsTesting] = useState(false);
  const [testResult, setTestResult] = useState<{ ok: boolean; msg: string } | null>(null);

  useEffect(() => {
    if (visible) {
      setUrlInput(getBackendUrl());
      setTestResult(null);
    }
  }, [visible]);

  const handleTest = async () => {
    setIsTesting(true);
    setTestResult(null);
    try {
      await setBackendUrl(urlInput);
      const res = await api.pingBackend();
      setTestResult({ ok: res.ok, msg: res.ok ? "Connected successfully to Flask backend!" : res.message });
      if (res.ok) {
        await refreshBackendUrl();
      }
    } catch (err: any) {
      setTestResult({ ok: false, msg: err.message || "Failed to reach server." });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveAndReconnect = async () => {
    await setBackendUrl(urlInput);
    await refreshBackendUrl();
    await initNewSession();
    onClose();
  };

  const handleResetDefault = () => {
    const def = getDefaultBackendUrl();
    setUrlInput(def);
  };

  return (
    <Modal visible={visible} transparent animationType="fade" onRequestClose={onClose}>
      <View style={[styles.backdrop, { backgroundColor: colors.modalBackdrop }]}>
        <View style={[styles.card, { backgroundColor: colors.bgCard, borderColor: colors.border }]}>
          <View style={styles.header}>
            <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
              <MaterialCommunityIcons name="server-network" size={20} color={colors.primary} />
              <Text style={[styles.title, { color: colors.text }]}>Flask Backend Configuration</Text>
            </View>
            <TouchableOpacity onPress={onClose} hitSlop={{ top: 10, bottom: 10, left: 10, right: 10 }}>
              <Feather name="x" size={20} color={colors.textMuted} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.hint, { color: colors.textMuted }]}>
            CleanCore connects to your Python Flask backend (`run.py` on port 5000). On Android emulators use{" "}
            <Text style={{ fontWeight: "700" }}>http://10.0.2.2:5000</Text>. On physical Android phones, use your computer's local Wi-Fi IP (e.g.{" "}
            <Text style={{ fontWeight: "700" }}>http://192.168.1.X:5000</Text>).
          </Text>

          <View style={styles.inputContainer}>
            <Text style={[styles.label, { color: colors.textSecondary }]}>Backend Base URL</Text>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: colors.bgSecondary,
                  borderColor: colors.border,
                  color: colors.text,
                },
              ]}
              value={urlInput}
              onChangeText={setUrlInput}
              autoCapitalize="none"
              autoCorrect={false}
              placeholder="http://127.0.0.1:5000"
              placeholderTextColor={colors.textMuted}
            />
          </View>

          {testResult && (
            <View
              style={[
                styles.resultBox,
                {
                  backgroundColor: testResult.ok ? colors.successBg : colors.dangerBg,
                  borderColor: testResult.ok ? colors.success : colors.danger,
                },
              ]}
            >
              <Feather
                name={testResult.ok ? "check-circle" : "alert-triangle"}
                size={16}
                color={testResult.ok ? colors.success : colors.danger}
              />
              <Text
                style={[
                  styles.resultText,
                  { color: testResult.ok ? colors.success : colors.danger },
                ]}
              >
                {testResult.msg}
              </Text>
            </View>
          )}

          <View style={styles.buttonRow}>
            <TouchableOpacity
              style={[styles.btnSecondary, { borderColor: colors.border }]}
              onPress={handleResetDefault}
            >
              <Text style={[styles.btnSecondaryText, { color: colors.textSecondary }]}>Reset Default</Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnOutline, { borderColor: colors.primary }]}
              onPress={handleTest}
              disabled={isTesting}
            >
              {isTesting ? (
                <ActivityIndicator size="small" color={colors.primary} />
              ) : (
                <Text style={[styles.btnOutlineText, { color: colors.primary }]}>Test Ping</Text>
              )}
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.btnPrimary, { backgroundColor: colors.primary }]}
              onPress={handleSaveAndReconnect}
            >
              <Text style={styles.btnPrimaryText}>Save & Connect</Text>
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
    maxWidth: 520,
    borderRadius: 12,
    borderWidth: 1,
    padding: 20,
    ...Platform.select({
      ios: { shadowColor: "#000", shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.2, shadowRadius: 8 },
      android: { elevation: 6 },
      web: { boxShadow: "0 10px 25px rgba(0,0,0,0.2)" },
    }),
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  title: {
    fontSize: 16,
    fontWeight: "700",
  },
  hint: {
    fontSize: 13,
    lineHeight: 18,
    marginBottom: 16,
  },
  inputContainer: {
    marginBottom: 16,
  },
  label: {
    fontSize: 12,
    fontWeight: "600",
    marginBottom: 6,
  },
  input: {
    height: 42,
    borderRadius: 8,
    borderWidth: 1,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  resultBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    marginBottom: 16,
  },
  resultText: {
    fontSize: 12,
    flex: 1,
  },
  buttonRow: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
  },
  btnSecondary: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
  },
  btnSecondaryText: {
    fontSize: 13,
    fontWeight: "600",
  },
  btnOutline: {
    paddingVertical: 9,
    paddingHorizontal: 14,
    borderRadius: 8,
    borderWidth: 1,
    minWidth: 80,
    alignItems: "center",
    justifyContent: "center",
  },
  btnOutlineText: {
    fontSize: 13,
    fontWeight: "600",
  },
  btnPrimary: {
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
  },
  btnPrimaryText: {
    color: "#ffffff",
    fontSize: 13,
    fontWeight: "600",
  },
});

