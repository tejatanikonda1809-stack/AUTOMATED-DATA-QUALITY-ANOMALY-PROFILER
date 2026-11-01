import React, { useState, useEffect, useRef, useCallback } from "react";
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Modal,
  TextInput,
  ActivityIndicator,
  Platform,
  Alert,
  BackHandler,
  Linking,
} from "react-native";
import { StatusBar } from "expo-status-bar";
import { SafeAreaProvider, SafeAreaView } from "react-native-safe-area-context";
import AsyncStorage from "@react-native-async-storage/async-storage";
import * as FileSystem from "expo-file-system/legacy";
import * as Sharing from "expo-sharing";
import { Feather, MaterialCommunityIcons } from "@expo/vector-icons";

// ── Conditionally import WebView (only on native) ──────────────────────────
let WebView: any = null;
if (Platform.OS !== "web") {
  try {
    WebView = require("react-native-webview").WebView;
  } catch (e) {
    console.warn("react-native-webview load error:", e);
  }
}

// ── Constants ──────────────────────────────────────────────────────────────
const STORAGE_KEY = "cleancore_server_url";

/**
 * Default production server (Render free tier).
 * Used on first launch when AsyncStorage has no saved URL.
 * Do NOT add a trailing slash.
 */
const DEFAULT_SERVER_URL = "https://cleancore.onrender.com";

/**
 * Render free-tier servers sleep after inactivity and can take up to 60 s
 * to wake. All ping / fetch operations use this timeout.
 */
const PING_TIMEOUT_MS = 60_000;

/** Returns the URL to load on first launch (no saved value). */
const getDefaultUrl = (): string => {
  if (Platform.OS === "web") {
    // If Expo Web is served from localhost alongside a local Flask server, use that.
    if (typeof window !== "undefined") {
      const h = window.location?.hostname ?? "";
      if (h === "localhost" || h === "127.0.0.1") {
        return "http://127.0.0.1:5000";
      }
    }
  }
  // Android (emulator, physical device) and all other platforms → hosted server
  return DEFAULT_SERVER_URL;
};

// ── App ────────────────────────────────────────────────────────────────────
export default function App() {
  const [serverUrl, setServerUrl] = useState<string>(getDefaultUrl());
  const [inputUrl, setInputUrl] = useState<string>("");
  const [isConfigOpen, setIsConfigOpen] = useState<boolean>(false);
  const [isOnline, setIsOnline] = useState<boolean>(false);
  const [isChecking, setIsChecking] = useState<boolean>(true);
  const [isTesting, setIsTesting] = useState<boolean>(false);
  const [testMessage, setTestMessage] = useState<{ ok: boolean; text: string } | null>(null);
  const [downloadingFile, setDownloadingFile] = useState<string | null>(null);
  /** True while the WebView page is still fetching/painting after a successful ping. */
  const [webViewLoading, setWebViewLoading] = useState<boolean>(true);
  /** Non-null when the WebView fires onError / onHttpError. */
  const [webViewError, setWebViewError] = useState<string | null>(null);

  const webViewRef = useRef<any>(null);

  // ── 1. Initialise server URL from AsyncStorage ─────────────────────────
  useEffect(() => {
    AsyncStorage.getItem(STORAGE_KEY).then((saved) => {
      const url = saved && saved.startsWith("http")
        ? saved.trim().replace(/\/+$/, "")
        : getDefaultUrl();
      setServerUrl(url);
      checkServer(url);
      // No modal on first launch — the default URL is a valid hosted server.
    });
  }, []);

  // ── 2. Android hardware back button — go back in WebView history ───────
  useEffect(() => {
    if (Platform.OS !== "android") return;
    const onBack = () => {
      if (webViewRef.current) {
        webViewRef.current.goBack();
        return true; // consumed — do not exit app
      }
      return false; // let the OS handle it (exit app)
    };
    const sub = BackHandler.addEventListener("hardwareBackPress", onBack);
    return () => sub.remove();
  }, []);

  // ── Server connectivity check (60 s timeout) ───────────────────────────
  const checkServer = async (urlToCheck: string) => {
    setIsChecking(true);
    try {
      const clean = urlToCheck.trim().replace(/\/+$/, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      const res = await fetch(`${clean}/`, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      setIsOnline(res.ok);
    } catch {
      setIsOnline(false);
    } finally {
      setIsChecking(false);
    }
  };

  // ── Test Ping (modal) — 60 s timeout ──────────────────────────────────
  const handleTestPing = async () => {
    setIsTesting(true);
    setTestMessage(null);
    try {
      const clean = inputUrl.trim().replace(/\/+$/, "");
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), PING_TIMEOUT_MS);
      const res = await fetch(`${clean}/`, { signal: controller.signal, cache: "no-store" });
      clearTimeout(timer);
      if (res.ok) {
        setTestMessage({ ok: true, text: "Connected to CleanCore server successfully!" });
      } else {
        setTestMessage({ ok: false, text: `Server returned HTTP ${res.status}` });
      }
    } catch (err: any) {
      setTestMessage({ ok: false, text: `Connection failed: ${err.message || "Unreachable"}` });
    } finally {
      setIsTesting(false);
    }
  };

  // ── Save URL from config modal ─────────────────────────────────────────
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

  // ── Native download bridge ─────────────────────────────────────────────
  const getBaseDir = () => {
    const dir = FileSystem.cacheDirectory || FileSystem.documentDirectory || "";
    return dir.endsWith("/") ? dir : `${dir}/`;
  };

  const handleSaveBase64 = async (
    base64Data: string,
    filename: string,
    mimeType?: string
  ) => {
    try {
      const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_") || "cleancore_export";
      setDownloadingFile(cleanName);

      let cleanMime = mimeType || "application/octet-stream";
      if (!mimeType || mimeType === "application/octet-stream") {
        if (cleanName.endsWith(".pdf")) cleanMime = "application/pdf";
        else if (cleanName.endsWith(".html") || cleanName.endsWith(".htm")) cleanMime = "text/html";
        else if (cleanName.endsWith(".csv")) cleanMime = "text/csv";
        else if (cleanName.endsWith(".xlsx"))
          cleanMime = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      }

      const baseDir = getBaseDir();
      const targetUri = `${baseDir}${cleanName}`;

      await FileSystem.writeAsStringAsync(targetUri, base64Data, {
        encoding: FileSystem.EncodingType.Base64,
      });

      setDownloadingFile(null);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(targetUri, {
          mimeType: cleanMime,
          dialogTitle: `Save / Share ${cleanName}`,
        });
      } else {
        Alert.alert("File Downloaded", `Saved to: ${targetUri}`);
      }
    } catch (err: any) {
      setDownloadingFile(null);
      Alert.alert("Download Error", err?.message || "Failed to save file.");
    }
  };

  const handleDownloadUrl = async (url: string, preferredFilename?: string) => {
    try {
      let filename = preferredFilename || "cleancore_export";
      let mimeType = "application/octet-stream";

      if (url.includes("/api/download/dataset") || url.endsWith(".csv")) {
        filename = preferredFilename || "cleancore_cleaned_dataset.csv";
        mimeType = "text/csv";
      } else if (url.includes("/api/download/missing-log") || url.endsWith(".xlsx")) {
        filename = preferredFilename || "cleancore_missing_values_log.xlsx";
        mimeType = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";
      } else if (url.includes("/api/report/pdf") || url.endsWith(".pdf")) {
        filename = preferredFilename || "cleancore_quality_report.pdf";
        mimeType = "application/pdf";
      } else if (url.includes("/api/report/html") || url.endsWith(".html")) {
        filename = preferredFilename || "cleancore_quality_report.html";
        mimeType = "text/html";
      }

      const cleanName = filename.replace(/[^a-zA-Z0-9._-]/g, "_");
      setDownloadingFile(cleanName);

      const baseDir = getBaseDir();
      const targetUri = `${baseDir}${cleanName}`;

      const downloadResult = await FileSystem.downloadAsync(url, targetUri);
      setDownloadingFile(null);

      if (await Sharing.isAvailableAsync()) {
        await Sharing.shareAsync(downloadResult.uri, {
          mimeType,
          dialogTitle: `Save / Share ${cleanName}`,
        });
      } else {
        Alert.alert("File Downloaded", `Saved to: ${downloadResult.uri}`);
      }
    } catch (fsErr: any) {
      setDownloadingFile(null);
      try {
        const canOpen = await Linking.canOpenURL(url);
        if (canOpen) {
          await Linking.openURL(url);
        } else {
          Alert.alert("Download Error", fsErr.message || "Failed to download file.");
        }
      } catch {
        Alert.alert("Download Error", fsErr.message || "Failed to download file.");
      }
    }
  };

  // ── Helpers for mobileUrl ──────────────────────────────────────────────
  /** Appends ?app=mobile so the web frontend adds html.mobile-app and shows the hamburger. */
  const mobileUrl = (base: string): string => {
    if (!base) return base;
    try {
      const u = new URL(base);
      u.searchParams.set("app", "mobile");
      return u.toString();
    } catch {
      const sep = base.includes("?") ? "&" : "?";
      return `${base}${sep}app=mobile`;
    }
  };

  // ── Scripts injected into the WebView ─────────────────────────────────
  /** Runs BEFORE any page script — sets the window flag immediately and hooks URL object methods early. */
  const injectedJsBeforeContent = `
    (function() {
      try { window.__CLEANCORE_MOBILE_APP__ = true; } catch(e) {}

      try {
        if (!window.__blobMap) {
          window.__blobMap = new Map();
        }

        // Hook URL.createObjectURL to retain blobs in memory for native bridge
        var origCreateObjectURL = URL.createObjectURL;
        if (origCreateObjectURL && !URL.__hooked) {
          URL.createObjectURL = function(blob) {
            var url = origCreateObjectURL.apply(this, arguments);
            try {
              if (url && blob) {
                window.__blobMap.set(url, blob);
              }
            } catch(e) {}
            return url;
          };
          URL.__hooked = true;
        }

        // Delay URL.revokeObjectURL to give the native bridge ample time to read the blob
        var origRevoke = URL.revokeObjectURL;
        if (origRevoke && !URL.__revokeHooked) {
          URL.revokeObjectURL = function(url) {
            setTimeout(function() {
              try {
                if (window.__blobMap) window.__blobMap.delete(url);
                origRevoke.call(URL, url);
              } catch(e) {}
            }, 30000);
          };
          URL.__revokeHooked = true;
        }
      } catch(e) {}
    })();
    true;
  `;

  /** Runs after page load — bridges downloads, anchor clicks, and window.open calls. */
  const injectedJs = `
    (function() {
      if (window.__CLEANCORE_DOWNLOAD_BRIDGE__) return;
      window.__CLEANCORE_DOWNLOAD_BRIDGE__ = true;

      function postToNative(msg) {
        if (window.ReactNativeWebView && window.ReactNativeWebView.postMessage) {
          window.ReactNativeWebView.postMessage(JSON.stringify(msg));
        }
      }

      function sendBlobAsBase64(blob, filename, mimeType) {
        try {
          var reader = new FileReader();
          reader.onloadend = function() {
            try {
              var result = reader.result || '';
              var commaIdx = result.indexOf(',');
              var base64 = commaIdx !== -1 ? result.substring(commaIdx + 1) : result;
              var detectedMime = mimeType || blob.type || 'application/octet-stream';
              if (!detectedMime || detectedMime === 'application/octet-stream') {
                if (filename.endsWith('.pdf')) detectedMime = 'application/pdf';
                else if (filename.endsWith('.html') || filename.endsWith('.htm')) detectedMime = 'text/html';
                else if (filename.endsWith('.csv')) detectedMime = 'text/csv';
                else if (filename.endsWith('.xlsx')) detectedMime = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
              }
              postToNative({
                type: 'DOWNLOAD_BASE64',
                base64: base64,
                filename: filename,
                mimeType: detectedMime
              });
            } catch (err) {
              postToNative({
                type: 'DOWNLOAD_ERROR',
                error: 'Encoding error: ' + (err.message || String(err))
              });
            }
          };
          reader.onerror = function() {
            postToNative({
              type: 'DOWNLOAD_ERROR',
              error: 'Failed to read file data.'
            });
          };
          reader.readAsDataURL(blob);
        } catch (e) {
          postToNative({
            type: 'DOWNLOAD_ERROR',
            error: 'FileReader error: ' + (e.message || String(e))
          });
        }
      }

      function fetchInWebView(url, filename, mimeType) {
        fetch(url, { credentials: 'include' })
          .then(function(res) {
            if (!res.ok) throw new Error('HTTP ' + res.status);
            var disp = res.headers.get('content-disposition') || '';
            var match = disp.match(/filename\\*?=(?:UTF-8'')?["']?([^"';]+)["']?/i);
            if (match && match[1]) {
              filename = decodeURIComponent(match[1].trim());
            }
            var ctype = res.headers.get('content-type') || mimeType;
            return res.blob().then(function(blob) {
              return { blob: blob, ctype: ctype, filename: filename };
            });
          })
          .then(function(data) {
            sendBlobAsBase64(data.blob, data.filename, data.ctype);
          })
          .catch(function(err) {
            // Fallback to sending direct DOWNLOAD message with url for native downloadAsync
            postToNative({
              type: 'DOWNLOAD',
              url: url,
              filename: filename
            });
          });
      }

      function handleDownloadTarget(href, downloadAttr) {
        if (!href) return false;

        var isDownload =
          downloadAttr ||
          href.startsWith('blob:') ||
          href.includes('/api/download/') ||
          href.includes('/api/report/') ||
          href.endsWith('.pdf') ||
          href.endsWith('.xlsx') ||
          href.endsWith('.csv') ||
          (href.endsWith('.html') && href.includes('/report'));

        if (!isDownload) return false;

        var filename = downloadAttr || '';
        if (!filename) {
          if (href.includes('.pdf') || href.includes('/pdf')) filename = 'data_quality_report.pdf';
          else if (href.includes('.html') || href.includes('/html')) filename = 'data_quality_report.html';
          else if (href.includes('missing-log') || href.endsWith('.xlsx')) filename = 'missing_values_log.xlsx';
          else if (href.includes('dataset') || href.endsWith('.csv')) filename = 'cleaned_dataset.csv';
          else filename = 'cleancore_export';
        }

        if (href.startsWith('blob:')) {
          var blob = window.__blobMap ? window.__blobMap.get(href) : null;
          if (blob) {
            sendBlobAsBase64(blob, filename);
            return true;
          }
          // Fetch the blob URL directly inside this context if not in map
          fetch(href)
            .then(function(r) { return r.blob(); })
            .then(function(b) {
              sendBlobAsBase64(b, filename);
            })
            .catch(function(err) {
              postToNative({
                type: 'DOWNLOAD_ERROR',
                error: 'Could not access report blob: ' + (err.message || String(err))
              });
            });
          return true;
        }

        var fullUrl = href;
        if (!href.startsWith('http://') && !href.startsWith('https://')) {
          var origin = window.location.origin || '';
          fullUrl = origin + (href.startsWith('/') ? '' : '/') + href;
        }

        fetchInWebView(fullUrl, filename);
        return true;
      }

      // Hook HTMLAnchorElement.prototype.click (called by api.js a.click())
      var origClick = HTMLAnchorElement.prototype.click;
      HTMLAnchorElement.prototype.click = function() {
        var handled = false;
        try {
          var href = this.getAttribute('href') || this.href || '';
          var dl = this.getAttribute('download') || this.download || '';
          handled = handleDownloadTarget(href, dl);
        } catch (e) {}
        if (handled) return;
        return origClick.apply(this, arguments);
      };

      // Intercept capturing clicks on <a> elements
      document.addEventListener('click', function(e) {
        var link = e.target && e.target.closest ? e.target.closest('a') : null;
        if (link) {
          var href = link.getAttribute('href') || link.href || '';
          var dl = link.getAttribute('download') || link.download || '';
          if (handleDownloadTarget(href, dl)) {
            e.preventDefault();
            e.stopPropagation();
          }
        }
      }, true);

      // Intercept window.open
      var origOpen = window.open;
      window.open = function(url) {
        if (url && handleDownloadTarget(url, '')) {
          return null;
        }
        return origOpen.apply(this, arguments);
      };
    })();
    true;
  `;

  // ── Body state-machine ─────────────────────────────────────────────────
  // Never blank: always shows one of loading / no-server / error / webview.
  const renderBody = () => {
    // 1. Pinging server (can take up to 60 s for a sleeping Render server)
    if (isChecking) {
      return (
        <View style={styles.centerBox}>
          <ActivityIndicator size="large" color="#38bdf8" />
          <Text style={styles.centerTitle}>Connecting to server...</Text>
          <Text style={styles.centerSub}>{serverUrl}</Text>
          <Text style={styles.centerHint}>
            Free servers wake up in ~30–60 s after inactivity. Please wait.
          </Text>
        </View>
      );
    }

    // 2. No URL at all
    if (!serverUrl) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="server-network-off" size={52} color="#38bdf8" />
          <Text style={styles.centerTitle}>No Server Configured</Text>
          <Text style={styles.centerSub}>
            Tap the gear icon to set the CleanCore server URL.
          </Text>
          <TouchableOpacity style={[styles.btnPrimary, { marginTop: 8 }]} onPress={openConfig}>
            <Feather name="settings" size={14} color="#fff" />
            <Text style={styles.btnPrimaryText}>Configure Server</Text>
          </TouchableOpacity>
        </View>
      );
    }

    // 3. Ping failed → cannot reach server
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
            <Text style={styles.troubleshootHeader}>Possible causes:</Text>
            <Text style={styles.troubleshootItem}>① Server is still waking up — tap Retry</Text>
            <Text style={styles.troubleshootItem}>② No internet connection on this device</Text>
            <Text style={styles.troubleshootItem}>③ Wrong server URL — tap Server Settings</Text>
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

    // 4. WebView reported a network-level error after the ping succeeded
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

    // 5. Expo Web — use an iframe (no native WebView available)
    if (Platform.OS === "web") {
      return (
        <iframe
          src={mobileUrl(serverUrl)}
          style={{ width: "100%", height: "100%", border: "none" } as any}
          title="CleanCore"
        />
      );
    }

    // 6. react-native-webview unavailable (e.g. web-only build)
    if (!WebView) {
      return (
        <View style={styles.centerBox}>
          <MaterialCommunityIcons name="alert-circle-outline" size={48} color="#ef4444" />
          <Text style={styles.centerTitle}>WebView unavailable</Text>
          <Text style={styles.centerSub}>
            react-native-webview could not be loaded.{"\n"}
            Use a development build instead of Expo Go.
          </Text>
        </View>
      );
    }

    // 7. All good — render the WebView
    return (
      <>
        <WebView
          ref={webViewRef}
          // ?app=mobile triggers html.mobile-app class → hamburger appears
          source={{ uri: mobileUrl(serverUrl) }}
          style={styles.webview}
          javaScriptEnabled={true}
          domStorageEnabled={true}
          // File upload support
          allowFileAccess={true}
          allowFileAccessFromFileURLs={true}
          allowUniversalAccessFromFileURLs={true}
          // Mixed content (HTTPS page loading HTTP sub-resources) allowed
          mixedContentMode="always"
          originWhitelist={["*"]}
          // Mobile-app detection signals
          applicationNameForUserAgent="CleanCoreMobile"
          injectedJavaScriptBeforeContentLoaded={injectedJsBeforeContent}
          injectedJavaScript={injectedJs}
          // Loading lifecycle
          onLoadStart={() => setWebViewLoading(true)}
          onLoadEnd={() => setWebViewLoading(false)}
          // Network-level errors
          onError={(e: any) => {
            const desc = e?.nativeEvent?.description || "Unknown error";
            setWebViewLoading(false);
            setWebViewError(`Connection error: ${desc}`);
          }}
          onHttpError={(e: any) => {
            const code = e?.nativeEvent?.statusCode ?? "?";
            setWebViewLoading(false);
            // 404/500 from the server are shown in the WebView itself, not an error screen
            if (code >= 500) setWebViewError(`Server error: HTTP ${code}`);
          }}
          // Intercept navigation requests to treat report/download URLs as downloads, never page navigations
          onShouldStartLoadWithRequest={(request: any) => {
            const url = request?.url || "";
            if (!url) return true;

            const isReportOrDownload =
              url.startsWith("blob:") ||
              url.includes("/api/download/") ||
              url.includes("/api/report/") ||
              url.endsWith(".pdf") ||
              url.endsWith(".xlsx") ||
              url.endsWith(".csv") ||
              (url.endsWith(".html") && url.includes("/report"));

            if (isReportOrDownload) {
              if (url.startsWith("blob:")) {
                webViewRef.current?.injectJavaScript(`
                  (function() {
                    try {
                      fetch("${url}").then(function(r) { return r.blob(); }).then(function(b) {
                        var reader = new FileReader();
                        reader.onloadend = function() {
                          var res = reader.result || '';
                          var b64 = res.indexOf(',') !== -1 ? res.split(',')[1] : res;
                          window.ReactNativeWebView.postMessage(JSON.stringify({
                            type: 'DOWNLOAD_BASE64',
                            base64: b64,
                            filename: '${url.includes(".pdf") ? "data_quality_report.pdf" : "data_quality_report.html"}',
                            mimeType: b.type || '${url.includes(".pdf") ? "application/pdf" : "text/html"}'
                          }));
                        };
                        reader.readAsDataURL(b);
                      });
                    } catch(e) {}
                  })();
                  true;
                `);
              } else {
                const fullUrl = url.startsWith("http")
                  ? url
                  : `${serverUrl}${url.startsWith("/") ? "" : "/"}${url}`;
                handleDownloadUrl(fullUrl);
              }
              return false; // Stop page navigation inside WebView
            }
            return true;
          }}
          // Native Android file download hook
          onFileDownload={({ nativeEvent: { downloadUrl } }: any) => {
            if (downloadUrl) {
              const fullUrl = downloadUrl.startsWith("http")
                ? downloadUrl
                : `${serverUrl}${downloadUrl.startsWith("/") ? "" : "/"}${downloadUrl}`;
              handleDownloadUrl(fullUrl);
            }
          }}
          // Messages from injectedJs (download interception & Base64 transfer)
          onMessage={(event: any) => {
            try {
              const data = JSON.parse(event.nativeEvent.data);
              if (data.type === "DOWNLOAD_BASE64" && data.base64) {
                handleSaveBase64(data.base64, data.filename || "cleancore_export", data.mimeType);
              } else if (data.type === "DOWNLOAD_ERROR") {
                setDownloadingFile(null);
                Alert.alert("Download Error", data.error || "An error occurred while downloading.");
              } else if (data.type === "DOWNLOAD" && data.url) {
                const fullUrl = data.url.startsWith("http")
                  ? data.url
                  : `${serverUrl}${data.url.startsWith("/") ? "" : "/"}${data.url}`;
                handleDownloadUrl(fullUrl, data.filename);
              }
            } catch (e) {
              console.error("WebView message error:", e);
            }
          }}
          // Render-level WebView crash (distinct from network errors)
          renderError={(errorName: any) => (
            <View style={styles.centerBox}>
              <MaterialCommunityIcons name="server-network-off" size={48} color="#ef4444" />
              <Text style={styles.centerTitle}>Render Error</Text>
              <Text style={styles.centerSub}>{errorName}</Text>
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

        {/* Dark overlay while page is painting (hidden after onLoadEnd) */}
        {webViewLoading && (
          <View style={styles.loadingOverlay}>
            <ActivityIndicator size="large" color="#38bdf8" />
            <Text style={styles.centerSub}>Loading CleanCore…</Text>
          </View>
        )}
      </>
    );
  };

  // ── Render ─────────────────────────────────────────────────────────────
  return (
    <SafeAreaProvider>
      <SafeAreaView style={styles.container} edges={["top", "left", "right"]}>
        <StatusBar style="light" />

        {/* ── Top bar: logo + title (left) · gear + status dot (right) ── */}
        <View style={styles.statusBar}>
          {/* Left: logo badge + "CleanCore" wordmark */}
          <View style={styles.brandRow}>
            <View style={styles.brandBadge}>
              <MaterialCommunityIcons name="layers-triple-outline" size={16} color="#38bdf8" />
            </View>
            <Text style={styles.brandText}>CleanCore</Text>
          </View>

          {/* Right: gear button with small status dot overlay */}
          <TouchableOpacity
            style={styles.gearBtn}
            onPress={openConfig}
            activeOpacity={0.75}
            accessibilityLabel="Server settings"
            accessibilityRole="button"
          >
            <Feather name="settings" size={20} color="#94a3b8" />
            {/* Status dot overlaid on the gear — grey while checking */}
            <View
              style={[
                styles.gearDot,
                {
                  backgroundColor: isChecking
                    ? "#64748b"
                    : isOnline
                    ? "#10b981"
                    : "#ef4444",
                },
              ]}
            />
          </TouchableOpacity>
        </View>

        {/* ── Body ── */}
        <View style={styles.content}>
          {renderBody()}

          {/* Download progress overlay */}
          {downloadingFile && (
            <View style={styles.downloadOverlay}>
              <ActivityIndicator size="large" color="#38bdf8" />
              <Text style={styles.downloadText}>Downloading {downloadingFile}…</Text>
            </View>
          )}
        </View>

        {/* ── Server Configuration Modal ── */}
        <Modal
          visible={isConfigOpen}
          transparent
          animationType="fade"
          onRequestClose={() => setIsConfigOpen(false)}
        >
          <View style={styles.modalBackdrop}>
            <View style={styles.modalCard}>
              <View style={styles.modalHeader}>
                <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                  <MaterialCommunityIcons name="server-network" size={20} color="#38bdf8" />
                  <Text style={styles.modalTitle}>Server Configuration</Text>
                </View>
                <TouchableOpacity onPress={() => setIsConfigOpen(false)}>
                  <Feather name="x" size={20} color="#94a3b8" />
                </TouchableOpacity>
              </View>

              <Text style={styles.modalDesc}>
                The CleanCore backend runs at the URL below. Change it only if you
                are running a local Flask server on the same Wi-Fi network.
              </Text>

              <View style={styles.quickOptions}>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => setInputUrl(DEFAULT_SERVER_URL)}
                >
                  <Text style={styles.quickBtnText}>Render (default)</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => setInputUrl("http://10.0.2.2:5000")}
                >
                  <Text style={styles.quickBtnText}>Emulator local</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={styles.quickBtn}
                  onPress={() => setInputUrl("http://localhost:5000")}
                >
                  <Text style={styles.quickBtnText}>Localhost</Text>
                </TouchableOpacity>
              </View>

              <TextInput
                style={styles.modalInput}
                value={inputUrl}
                onChangeText={setInputUrl}
                placeholder="https://cleancore.onrender.com"
                placeholderTextColor="#64748b"
                autoCapitalize="none"
                autoCorrect={false}
                keyboardType="url"
              />

              {testMessage && (
                <View
                  style={[
                    styles.testMsgBox,
                    {
                      backgroundColor: testMessage.ok
                        ? "rgba(16,185,129,0.15)"
                        : "rgba(239,68,68,0.15)",
                    },
                  ]}
                >
                  <Feather
                    name={testMessage.ok ? "check-circle" : "alert-triangle"}
                    size={15}
                    color={testMessage.ok ? "#10b981" : "#ef4444"}
                  />
                  <Text
                    style={[
                      styles.testMsgText,
                      { color: testMessage.ok ? "#10b981" : "#ef4444" },
                    ]}
                  >
                    {testMessage.text}
                  </Text>
                </View>
              )}

              {isTesting && (
                <Text style={[styles.centerHint, { textAlign: "left" }]}>
                  Waiting up to 60 s for server to wake…
                </Text>
              )}

              <View style={styles.modalFooter}>
                <TouchableOpacity
                  style={styles.btnTest}
                  onPress={handleTestPing}
                  disabled={isTesting}
                >
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
    </SafeAreaProvider>
  );
}

// ── Styles ─────────────────────────────────────────────────────────────────
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
    // kept so nothing crashes if referenced elsewhere, but no longer rendered
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
    flexShrink: 1,
  },
  // ── Gear button (replaces old server pill) ──
  gearBtn: {
    width: 44,
    height: 44,
    alignItems: "center",
    justifyContent: "center",
    borderRadius: 10,
    position: "relative",
  },
  gearDot: {
    position: "absolute",
    top: 8,
    right: 8,
    width: 8,
    height: 8,
    borderRadius: 4,
    borderWidth: 1.5,
    borderColor: "#1e293b", // matches statusBar background so it looks inset
  },
  content: {
    flex: 1,
    position: "relative",
  },
  webview: {
    flex: 1,
    backgroundColor: "#0f172a",
  },
  // ── Centred states ──
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
  centerHint: {
    color: "#64748b",
    fontSize: 11,
    textAlign: "center",
    lineHeight: 16,
    maxWidth: 280,
  },
  // ── Loading overlay (on top of WebView while page paints) ──
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
  troubleshootBox: {
    backgroundColor: "#1e293b",
    borderColor: "#334155",
    borderWidth: 1,
    borderRadius: 10,
    padding: 14,
    width: "100%",
    maxWidth: 380,
    gap: 6,
    marginVertical: 8,
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
    flexWrap: "wrap",
    justifyContent: "center",
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
    gap: 6,
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
    marginTop: 4,
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
