import React, { createContext, useContext, useState, useEffect, useCallback } from "react";
import * as api from "../services/api";
import { initBackendUrl, getBackendUrl } from "../services/apiConfig";

export type AppMode = "single" | "compare";
export type DatasetKey = "single" | "ref" | "cur";
export type ScreenName =
  | "home"
  | "upload"
  | "overview"
  | "issues"
  | "cleaning"
  | "review"
  | "comparison"
  | "visualization"
  | "reports";

interface AppContextType {
  sessionId: string | null;
  mode: AppMode;
  setMode: (mode: AppMode) => void;
  activeDataset: DatasetKey;
  setActiveDataset: (ds: DatasetKey) => void;
  currentScreen: ScreenName;
  navigateTo: (screen: ScreenName, opts?: { dataset?: DatasetKey; tab?: string }) => void;
  screenOpts: Record<string, any>;
  datasetStates: Record<DatasetKey, string>;
  analyses: Record<DatasetKey, any>;
  comparisonData: any;
  isLoading: boolean;
  setIsLoading: (loading: boolean) => void;
  backendOnline: boolean;
  backendUrl: string;
  refreshBackendUrl: () => Promise<void>;
  initNewSession: () => Promise<void>;
  refreshAnalysis: (dataset?: DatasetKey) => Promise<any>;
  runComparisonAnalysis: () => Promise<any>;
  error: string | null;
  setError: (err: string | null) => void;
}

const AppContext = createContext<AppContextType>({} as AppContextType);

export const AppProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [mode, setMode] = useState<AppMode>("single");
  const [activeDataset, setActiveDataset] = useState<DatasetKey>("single");
  const [currentScreen, setCurrentScreen] = useState<ScreenName>("home");
  const [screenOpts, setScreenOpts] = useState<Record<string, any>>({});
  const [datasetStates, setDatasetStates] = useState<Record<DatasetKey, string>>({
    single: "empty",
    ref: "empty",
    cur: "empty",
  });
  const [analyses, setAnalyses] = useState<Record<DatasetKey, any>>({
    single: null,
    ref: null,
    cur: null,
  });
  const [comparisonData, setComparisonData] = useState<any>(null);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [backendOnline, setBackendOnline] = useState<boolean>(false);
  const [backendUrl, setBackendUrlState] = useState<string>("");
  const [error, setError] = useState<string | null>(null);

  const checkConnection = useCallback(async () => {
    const res = await api.pingBackend();
    setBackendOnline(res.ok);
    return res.ok;
  }, []);

  const refreshBackendUrl = useCallback(async () => {
    const url = await initBackendUrl();
    setBackendUrlState(url);
    await checkConnection();
  }, [checkConnection]);

  const initNewSession = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      await refreshBackendUrl();
      const res = await api.newSession();
      setSessionId(res.session_id);
      setDatasetStates({ single: "empty", ref: "empty", cur: "empty" });
      setAnalyses({ single: null, ref: null, cur: null });
      setComparisonData(null);
    } catch (err: any) {
      setError(err.message || "Failed to initialize session with backend.");
    } finally {
      setIsLoading(false);
    }
  }, [refreshBackendUrl]);

  useEffect(() => {
    initNewSession();
  }, [initNewSession]);

  const navigateTo = (screen: ScreenName, opts?: { dataset?: DatasetKey; tab?: string }) => {
    if (opts?.dataset) {
      setActiveDataset(opts.dataset);
    }
    setScreenOpts(opts || {});
    setCurrentScreen(screen);
  };

  const refreshAnalysis = async (dataset: DatasetKey = activeDataset) => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.getAnalysis(dataset);
      const stateRes = await api.getDatasetState(dataset).catch(() => ({}));
      setAnalyses((prev) => ({ ...prev, [dataset]: res.analysis }));
      setDatasetStates((prev) => ({
        ...prev,
        [dataset]: stateRes.state || (res.analysis ? "analyzed" : "empty"),
      }));
      return res.analysis;
    } catch (err: any) {
      setError(err.message || "Failed to refresh analysis.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  const runComparisonAnalysis = async () => {
    setIsLoading(true);
    setError(null);
    try {
      const res = await api.runComparison();
      setComparisonData(res.comparison);
      return res.comparison;
    } catch (err: any) {
      setError(err.message || "Comparison analysis failed.");
      return null;
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <AppContext.Provider
      value={{
        sessionId,
        mode,
        setMode,
        activeDataset,
        setActiveDataset,
        currentScreen,
        navigateTo,
        screenOpts,
        datasetStates,
        analyses,
        comparisonData,
        isLoading,
        setIsLoading,
        backendOnline,
        backendUrl,
        refreshBackendUrl,
        initNewSession,
        refreshAnalysis,
        runComparisonAnalysis,
        error,
        setError,
      }}
    >
      {children}
    </AppContext.Provider>
  );
};

export const useApp = () => useContext(AppContext);

