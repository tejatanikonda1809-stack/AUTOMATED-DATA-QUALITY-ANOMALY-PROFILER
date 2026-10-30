import React, { useState, useEffect, useRef } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  SafeAreaView,
  Platform,
  Alert,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system";
import * as Sharing from "expo-sharing";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

// Conditionally import WebView on native platforms
let WebView: any = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch (e) {
    console.warn("react-native-webview load error:", e);
  }
}

const STORAGE_KEY = "cleancore_server_url";

const getDefaultUrl = () => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location?.hostname) {
      return `http://${window.location.hostname}:5000`;
    }
    return "http://127.0.0.1:5000";
  } else if (Platform.OS === "android") {
    // 10.0.2.2 = Android emulator alias. Physical phones need laptop's LAN IP (192.168.x.x).
    // We deliberately return empty string here so first-time users are shown the
    // "no server configured" screen and prompted to set their own IP.
    return "";
  }
  return "http://127.0.0.1:5000";
};

export default function App() {
  const [serverUrl, setServerUrl] = useState<string>(getDefaultUrl());
  const [inputUrl, setInputUrl] = useState<string>("");
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  // Tracks whether the WebView itself (after successfully reaching server) is still loading
  const [webViewLoading, setWebViewLoading] = useState<boolean>(true);
  // True when the WebView fires onError / onHttpError (network-level failure)
  const [webViewError, setWebViewError] = useState<string | null>(null);

  const webViewRef = useRef<any>(null);

  // Initialize saved server URL
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      if (saved && saved.startsWith("http")) {
        const clean = saved.trim().replace(/\/+$/, "");
        setServerUrl(clean);
        checkServer(clean);
      } else {
        const def = getDefaultUrl();
        if (def) {
          setServerUrl(def);
          checkServer(def);
        } else {
          // No default URL (physical Android device, never configured)
          setServerUrl("");
          setIsChecking(false);
          setIsOnline(false);
          // Open the config modal immediately so user can set their server IP
          setIsConfigOpen(true);
        }
      }
    });
  }, []);

  const checkServer = async (urlToCheck: string) => {
    setIsChecking(true);
    try {
      const clean = urlToCheck.trim().replace(/\/+$/, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 4000);
      const res = await fetch(`${clean}/`, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  const handleTestPing = async () => {
    setIsTesting(true);
    setTestMessage(null);
    try {
      const clean = inputUrl.trim().replace(/\/+$/, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), 5000);
      const res = await fetch(`${clean}/`, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      if (res.ok) {
        setTestMessage({ ok: true, text: "Successfully connected to CleanCore Flask server!" });
      } else {
        setTestMessage({ ok: false, text: `Server returned HTTP ${res.status}` });
      }
    } catch (err: any) {
      setTestMessage({ ok: false, text: `Connection failed: ${err.message || "Unreachable"}` });
    } finally {
      setIsTesting(false);
    }
  };

  const handleSaveUrl = async () => {
    const clean = inputUrl.trim().replace(/\/+$/, "");
    setServerUrl(clean);
    await AsyncStorage.setItem(STORAGE_KEY, clean);
    setIsConfigOpen(false);
    setWebViewError(null);
    setWebViewLoading(true);
    checkServer(clean);
    if (webViewRef.current) {
      webViewRef.current.reload();
    }
  };

  const openConfig = () => {
    setInputUrl(serverUrl);
    setTestMessage(null);
    setIsConfigOpen(true);
  };

  // ===== NATIVE DOWNLOAD BRIDGE FOR ANDROID =====
  // Intercepts download routes: /api/download/dataset, /api/download/missing-log, /api/report/pdf, /api/report/html
  const handleDownload = async (url: string) => {
    try {
      let filename = "cleancore_export";
      let mimeType = "application/octet-stream";

      if (url.includes("/api/download/dataset")) {
        filename = "cleancore_cleaned_dataset.csv";
        mimeType = "text/csv";
      } else if (url.includes("/api/download/missing-log")) {
        filename = "cleancore_missing_log.csv";
        mimeType = "text/csv";
      } else if (url.includes("/api/report/pdf")) {
        filename = "cleancore_quality_report.pdf";
        mimeType = "application/pdf";
      } else if (url.includes("/api/report/html")) {
        filename = "cleancore_quality_report.html";
        mimeType = "text/html";
      }

      setDownloadingFile(filename);

      const cacheDir = (FileSystem as any).cacheDirectory || (FileSystem as any).documentDirectory || "";
      const targetUri = `${cacheDir}${filename}`;

      const downloadResult = await (FileSystem as any).downloadAsync(url, targetUri);

      setDownloadingFile(null);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType,
          dialogTitle: `Save / Share ${filename}`,
        });
      } else {
        Alert.alert("File Downloaded", `Saved to: ${downloadResult.uri}`);
      }
    } catch (err: any) {
      setDownloadingFile(null);
      Alert.alert("Download Error", err.message || "Failed to download file.");
    }
  };

  // Injected JavaScript inside the original web app to bridge downloads and window.open calls to native
  const injectedJs = `
    (function() {
      // Intercept window.open
      const originalOpen = window.open;
      window.open = function(url) {
        if (url && (url.includes('/api/download/') || url.includes('/api/report/'))) {
          window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DOWNLOAD', url: url }));
          return null;
        }
        return originalOpen.apply(this, arguments);
      };

      // Intercept dynamic link clicks for downloads
      document.addEventListener('click', function(e) {
        const link = e.target.closest('a');
        if (link && link.href) {
          if (link.href.includes('/api/download/') || link.href.includes('/api/report/')) {
            e.preventDefault();
            window.ReactNativeWebView.postMessage(JSON.stringify({ type: 'DOWNLOAD', url: link.href }));
          }
        }
      }, true);
    })();
    true;
  `;

  // ── Body renderer ──────────────────────────────────────────────
  // State machine for the body area so it is NEVER blank:
  //   isChecking          → fullscreen loading spinner (pinging server)
  //   !serverUrl          → "no server configured" prompt
  //   !isOnline           → "server unreachable" error + settings shortcut
  //   webViewError        → WebView reported a network-level failure
  //   otherwise           → WebView (with per-page loading overlay)

  const renderBody = () => {
    // 1. Still doing the initial ping
    if (isChecking) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.centerTitle}>Connecting to CleanCore…</Text>
          <Text style={styles.centerSub}>{serverUrl || "Checking server…"}</Text>
        </View>
      );
    }

    // 2. No URL configured at all (first launch on physical device)
    if (!serverUrl) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="server-network-off" size={52} color="#38bdf8" />
          <Text style={styles.centerTitle}>No Server Configured</Text>
          <Text style={styles.centerSub}>
            Enter your laptop's local IP address so CleanCore Mobile can reach the Flask backend.
          </Text>
          <TouchableOpacity style={[styles.btnPrimary, { marginTop: 8 }]} onPress={openConfig}>
            <Feather name="settings" size={14} color="#fff" />
            <Text style={styles.btnPrimaryText}>Set Server IP</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 3. Server ping failed
    if (!isOnline) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="server-network-off" size={52} color="#ef4444" />
          <Text style={styles.centerTitle}>Cannot Reach Server</Text>
          <Text style={styles.centerSub}>
            Could not connect to{"\n"}
            <Text style={{ fontWeight: "700", color: "#38bdf8" }}>{serverUrl}</Text>
          </Text>
          <View style={styles.troubleshootBox}>
            <Text style={styles.troubleshootHeader}>Checklist:</Text>
            <Text style={styles.troubleshootItem}>① Run  python run.py  on your laptop</Text>
            <Text style={styles.troubleshootItem}>② Phone &amp; laptop must share the same Wi-Fi</Text>
            <Text style={styles.troubleshootItem}>③ Use your laptop's LAN IP, e.g. 192.168.1.X</Text>
            <Text style={styles.troubleshootItem}>④ Tap "Server Settings" to update the URL</Text>
          </View>
          <View style={styles.errorBtnRow}>
            <TouchableOpacity style={styles.btnSecondary} onPress={openConfig}>
              <Feather name="settings" size={14} color="#f8fafc" />
              <Text style={styles.btnSecondaryText}>Server Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                setWebViewError(null);
                checkServer(serverUrl);
              }}
            >
              <Feather name="refresh-cw" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Retry</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // 4. WebView reported a network error after the initial ping passed
    if (webViewError) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="web-off" size={52} color="#f59e0b" />
          <Text style={styles.centerTitle}>Page Load Failed</Text>
          <Text style={styles.centerSub}>{webViewError}</Text>
          <View style={styles.errorBtnRow}>
            <TouchableOpacity style={styles.btnSecondary} onPress={openConfig}>
              <Feather name="settings" size={14} color="#f8fafc" />
              <Text style={styles.btnSecondaryText}>Settings</Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={styles.btnPrimary}
              onPress={() => {
                setWebViewError(null);
                setWebViewLoading(true);
                if (webViewRef.current) webViewRef.current.reload();
              }}
            >
              <Feather name="refresh-cw" size={14} color="#fff" />
              <Text style={styles.btnPrimaryText}>Reload</Text>
            </TouchableOpacity>
          </View>
        </View>
      );
    }

    // 5. Server reachable — show WebView (with loading overlay until page paints)
    if (Platform.OS === "web") {
      return (
        <iframe
          src={serverUrl}
          style={{ width: "100%", height: "100%", border: "none" } as any}
          title="CleanCore Original Application"
        />
      );
    }

    if (!WebView) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.centerTitle}>WebView unavailable</Text>
          <Text style={styles.centerSub}>
            react-native-webview could not be loaded on this platform.{"\n"}
            Try opening the app with a development build instead of Expo Go.
          </Text>
        </View>
      );
    }

    return (
      <>
        <WebView
          ref={webViewRef}
          source={{ uri: serverUrl }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          originWhitelist={["*"]}
          mixedContentMode="always"
          injectedJavaScript={injectedJs}
          onLoadStart={() => setWebViewLoading(true)}
          onLoadEnd={() => setWebViewLoading(false)}
          onError={(e: any) => {
            const desc = e?.nativeEvent?.description || "Unknown error";
            setWebViewLoading(false);
            setWebViewError(`WebView error: ${desc}`);
          }}
          onHttpError={(e: any) => {
            const code = e?.nativeEvent?.statusCode ?? "?";
            setWebViewLoading(false);
            setWebViewError(`HTTP ${code} from server`);
          }}
          onMessage={(event: any) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "DOWNLOAD" && data.url) {
                const fullUrl = data.url.startsWith("http")
                  ? data.url
                  : `${serverUrl}${data.url.startsWith("/") ? "" : "/"}${data.url}`;
                handleDownload(fullUrl);
              }
            } catch (e) {
              console.error("WebView message error:", e);
            }
          }}
          renderError={(errorName: any) => (
            // renderError fires for WebView render-level crashes (not network errors)
            <View style={styles.centerBox}>
              <MaterialCommunityIcons name="server-network-off" size={48} color="#ef4444" />
              <Text style={styles.centerTitle}>Render Error: {errorName}</Text>
              <Text style={styles.centerSub}>The WebView could not display this page.</Text>
              <TouchableOpacity
                style={[styles.btnPrimary, { marginTop: 8 }]}
                onPress={() => {
                  if (webViewRef.current) webViewRef.current.reload();
                }}
              >
                <Feather name="refresh-cw" size={14} color="#fff" />
                <Text style={styles.btnPrimaryText}>Reload</Text>
              </TouchableOpacity>
            </View>
          )}
        />

        {/* Page loading overlay — shown while WebView is fetching/painting */}
        {webViewLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.centerSub}>Loading CleanCore…</Text>
          </View>
        )}
      </>
    );
  };

  return (
    <SafeAreaView style={styles.container}>
      <StatusBar style="light" />

      {/* ── Top bar: brand + server pill ── */}
      <View style={styles.statusBar}>
        <View style={styles.brandRow}>
          <View style={styles.brandBadge}>
            <MaterialCommunityIcons name="layers-triple-outline" size={16} color="#38bdf8" />
          </View>
          <Text style={styles.brandText}>CleanCore Mobile</Text>
        </View>

        <TouchableOpacity style={styles.serverPill} onPress={openConfig} activeOpacity={0.8}>
          {isChecking ? (
            <ActivityIndicator size="small" color="#38bdf8" style={{ marginRight: 4 }} />
          ) : (
            <View style={[styles.dot, { backgroundColor: isOnline ? "#10b981" : "#ef4444" }]} />
          )}
          <Text style={styles.serverUrlText} numberOfLines={1}>
            {serverUrl ? serverUrl.replace(/^https?:\/\//, "") : "Not configured"}
          </Text>
          <Feather name="settings" size={13} color="#94a3b8" />
        </TouchableOpacity>
      </View>

      {/* ── Body ── */}
      <View style={styles.content}>
        {renderBody()}

        {/* Download overlay */}
        {downloadingFile && (
          <View style={styles.downloadOverlay}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.downloadText}>Downloading & Preparing {downloadingFile}…</Text>
          </View>
        )}
      </View>

      {/* ── Server Configuration Modal ── */}
      <Modal visible={isConfigOpen} transparent animationType="fade" onRequestClose={() => setIsConfigOpen(false)}>
        <View style={styles.modalBackdrop}>
          <View style={styles.modalCard}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                <MaterialCommunityIcons name="server-network" size={20} color="#38bdf8" />
                <Text style={styles.modalTitle}>CleanCore Server Configuration</Text>
              </View>
              <TouchableOpacity onPress={() => setIsConfigOpen(false)}>
                <Feather name="x" size={20} color="#94a3b8" />
              </TouchableOpacity>
            </View>

            <Text style={styles.modalDesc}>
              CleanCore's Python Flask backend runs on your laptop (port 5000).{"\n"}
              Enter your laptop's local IP address below.
            </Text>

            <View style={styles.quickOptions}>
              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => setInputUrl("http://10.0.2.2:5000")}
              >
                <Text style={styles.quickBtnText}>Emulator (10.0.2.2)</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={styles.quickBtn}
                onPress={() => setInputUrl("http://localhost:5000")}
              >
                <Text style={styles.quickBtnText}>Localhost (Web)</Text>
              </TouchableOpacity>
            </View>

            <TextInput
              style={styles.modalInput}
              value={inputUrl}
              onChangeText={setInputUrl}
              placeholder="http://192.168.1.X:5000"
              placeholderTextColor="#64748b"
              autoCapitalize="none"
              autoCorrect={false}
              keyboardType="url"
            />

            {testMessage && (
              <View
                style={[
                  styles.testMsgBox,
                  { backgroundColor: testMessage.ok ? "rgba(16,185,129,0.15)" : "rgba(239,68,68,0.15)" },
                ]}
              >
                <Feather
                  name={testMessage.ok ? "check-circle" : "alert-triangle"}
                  size={15}
                  color={testMessage.ok ? "#10b981" : "#ef4444"}
                />
                <Text style={[styles.testMsgText, { color: testMessage.ok ? "#10b981" : "#ef4444" }]}>
                  {testMessage.text}
                </Text>
              </View>
            )}

            <View style={styles.modalFooter}>
              <TouchableOpacity style={styles.btnTest} onPress={handleTestPing} disabled={isTesting}>
                {isTesting ? (
                  <ActivityIndicator size="small" color="#38bdf8" />
                ) : (
                  <Text style={styles.btnTestText}>Test Ping</Text>
                )}
              </TouchableOpacity>

              <TouchableOpacity style={styles.btnSave} onPress={handleSaveUrl}>
                <Text style={styles.btnSaveText}>Save & Connect</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  statusBar: {
    height: 48,
    backgroundColor: "#1e293b",
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    paddingHorizontal: 12,
    borderBottomWidth: 1,
    borderBottomColor: "#334155",
  },
  brandRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
  },
  brandBadge: {
    width: 26,
    height: 26,
    borderRadius: 6,
    backgroundColor: "rgba(56, 189, 248, 0.15)",
    alignItems: "center",
    justifyContent: "center",
  },
  brandText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "700",
  },
  serverPill: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#0f172a",
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 14,
    borderWidth: 1,
    borderColor: "#334155",
    maxWidth: 200,
  },
  dot: {
    width: 7,
    height: 7,
    borderRadius: 4,
  },
  serverUrlText: {
    color: "#cbd5e1",
    fontSize: 11,
    fontWeight: "500",
  },
  content: {
    flex: 1,
    position: "relative",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  // ── Centred full-screen states (loading / no-server / error) ──
  centerBox: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 28,
    gap: 12,
  },
  centerTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  centerSub: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 19,
  },
  // Loading overlay that sits on top of the WebView while page paints
  loadingOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    gap: 14,
    zIndex: 10,
  },
  // Keep the old names so nothing else breaks
  errorContainer: {
    flex: 1,
    backgroundColor: "#0f172a",
    alignItems: "center",
    justifyContent: "center",
    padding: 24,
    gap: 12,
  },
  errorTitle: {
    color: "#f8fafc",
    fontSize: 18,
    fontWeight: "700",
    textAlign: "center",
  },
  errorSub: {
    color: "#94a3b8",
    fontSize: 13,
    textAlign: "center",
    lineHeight: 18,
  },
  troubleshootBox: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    width: "100%",
    maxWidth: 380,
    gap: 6,
    marginVertical: 12,
  },
  troubleshootHeader: {
    color: "#cbd5e1",
    fontSize: 12,
    fontWeight: "700",
    marginBottom: 2,
  },
  troubleshootItem: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 16,
  },
  errorBtnRow: {
    flexDirection: "row",
    gap: 12,
  },
  btnSecondary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#334155",
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnSecondaryText: {
    color: "#f8fafc",
    fontSize: 13,
    fontWeight: "600",
  },
  btnPrimary: {
    flexDirection: "row",
    alignItems: "center",
    gap: 6,
    backgroundColor: "#2563eb",
    paddingHorizontal: 18,
    paddingVertical: 10,
    borderRadius: 8,
  },
  btnPrimaryText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
  downloadOverlay: {
    position: "absolute",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(15, 23, 42, 0.8)",
    alignItems: "center",
    justifyContent: "center",
    gap: 12,
    zIndex: 999,
  },
  downloadText: {
    color: "#f8fafc",
    fontSize: 14,
    fontWeight: "600",
  },
  modalBackdrop: {
    flex: 1,
    backgroundColor: "rgba(0,0,0,0.75)",
    alignItems: "center",
    justifyContent: "center",
    padding: 20,
  },
  modalCard: {
    width: "100%",
    maxWidth: 460,
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 14,
    padding: 20,
    gap: 12,
  },
  modalHeader: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  modalTitle: {
    color: "#f8fafc",
    fontSize: 15,
    fontWeight: "700",
  },
  modalDesc: {
    color: "#94a3b8",
    fontSize: 12,
    lineHeight: 17,
  },
  quickOptions: {
    flexDirection: "row",
    gap: 8,
    flexWrap: "wrap",
  },
  quickBtn: {
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 6,
  },
  quickBtnText: {
    color: "#38bdf8",
    fontSize: 11,
    fontWeight: "600",
  },
  modalInput: {
    height: 42,
    backgroundColor: "#0f172a",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 12,
    color: "#f8fafc",
    fontSize: 13,
  },
  testMsgBox: {
    flexDirection: "row",
    alignItems: "center",
    gap: 8,
    padding: 10,
    borderRadius: 6,
  },
  testMsgText: {
    fontSize: 12,
    flex: 1,
  },
  modalFooter: {
    flexDirection: "row",
    justifyContent: "flex-end",
    gap: 10,
    marginTop: 6,
  },
  btnTest: {
    borderColor: "#38bdf8",
    borderWidth: 1,
    paddingHorizontal: 14,
    paddingVertical: 9,
    borderRadius: 8,
    minWidth: 80,
    alignItems: "center",
  },
  btnTestText: {
    color: "#38bdf8",
    fontSize: 13,
    fontWeight: "600",
  },
  btnSave: {
    backgroundColor: "#2563eb",
    paddingHorizontal: 16,
    paddingVertical: 9,
    borderRadius: 8,
    alignItems: "center",
  },
  btnSaveText: {
    color: "#fff",
    fontSize: 13,
    fontWeight: "600",
  },
});
