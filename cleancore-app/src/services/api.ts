import { Platform } from "react-native";
import { getBackendUrl } from "./apiConfig";

let activeSessionId: string | null = null;

export const setSessionId = (sid: string) => {
  activeSessionId = sid;
};

export const getSessionId = () => activeSessionId;

export interface RequestOptions extends RequestInit {
  timeoutMs?: number;
}

export async function apiFetch<T = any>(path: string, options: RequestOptions = {}): Promise<T> {
  const baseUrl = getBackendUrl();
  const url = `${baseUrl}${path.startsWith("/") ? "" : "/"}${path}`;

  const defaultHeaders: Record<string, string> = {};
  if (activeSessionId) {
    defaultHeaders["X-Session-Id"] = activeSessionId;
  }

  const isFormData = options.body instanceof FormData;
  if (!isFormData) {
    defaultHeaders["Content-Type"] = "application/json";
  }

  const timeoutMs = options.timeoutMs ?? 25000;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  const fetchOptions: RequestInit = {
    ...options,
    headers: {
      ...defaultHeaders,
      ...(options.headers as Record<string, string>),
    },
    signal: controller.signal,
  };

  try {
    const res = await fetch(url, fetchOptions);
    clearTimeout(timer);

    if (!res.ok) {
      let errMsg = `Server returned HTTP ${res.status}`;
      try {
        const errorJson = await res.json();
        errMsg = errorJson.error || errMsg;
      } catch {
        try {
          const errorText = await res.text();
          if (errorText) errMsg = errorText;
        } catch {}
      }
      throw new Error(errMsg);
    }

    const contentType = res.headers.get("content-type") || "";
    if (contentType.includes("application/json")) {
      return (await res.json()) as T;
    }
    if (contentType.includes("text/html") || contentType.includes("text/csv") || contentType.includes("text/plain")) {
      return (await res.text()) as unknown as T;
    }
    return (await res.blob()) as unknown as T;
  } catch (err: any) {
    clearTimeout(timer);
    if (err.name === "AbortError") {
      throw new Error(`Request to ${url} timed out after ${Math.round(timeoutMs / 1000)}s.`);
    }
    if (err.message && (err.message.includes("Network request failed") || err.message.includes("Failed to fetch"))) {
      throw new Error(
        `Cannot reach Flask backend at ${baseUrl}. Ensure Flask server is running and check IP in Connection Settings.`
      );
    }
    throw err;
  }
}

// ===== SESSION =====
export async function newSession(): Promise<{ session_id: string }> {
  const res = await apiFetch<{ session_id: string }>("/api/session/new", { method: "POST" });
  setSessionId(res.session_id);
  return res;
}

// ===== PING =====
export async function pingBackend(): Promise<{ ok: boolean; message: string }> {
  try {
    const res = await apiFetch<any>("/", { method: "GET", timeoutMs: 5000 });
    return { ok: true, message: "Backend is online and accessible." };
  } catch (err: any) {
    return { ok: false, message: err.message };
  }
}

// ===== UPLOAD =====
export interface FileUploadPayload {
  uri: string;
  name: string;
  type?: string;
  fileObject?: any;
}

export async function uploadFile(
  file: FileUploadPayload,
  dataset: "single" | "ref" | "cur" = "single"
): Promise<any> {
  const fd = new FormData();
  fd.append("dataset", dataset);

  if (activeSessionId) {
    fd.append("session_id", activeSessionId);
  }

  if (Platform.OS === "web" && file.fileObject) {
    fd.append("file", file.fileObject, file.name);
  } else {
    // React Native format for file upload
    const cleanType = file.type || (file.name.endsWith(".csv") ? "text/csv" : "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
    fd.append("file", {
      uri: file.uri,
      name: file.name,
      type: cleanType,
    } as any);
  }

  return apiFetch("/api/upload/file", {
    method: "POST",
    body: fd,
    timeoutMs: 60000,
  });
}

export async function loadExcelSheet(sheet: string, dataset = "single"): Promise<any> {
  return apiFetch("/api/upload/excel/load", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      sheet,
    }),
  });
}

// ===== ANALYSIS =====
export async function analyze(dataset = "single"): Promise<any> {
  return apiFetch("/api/analyze", {
    method: "POST",
    body: JSON.stringify({ session_id: activeSessionId, dataset }),
    timeoutMs: 45000,
  });
}

export async function getAnalysis(dataset = "single"): Promise<any> {
  return apiFetch(`/api/analysis/result?session_id=${activeSessionId}&dataset=${dataset}&_t=${Date.now()}`);
}

export async function getDatasetState(dataset = "single"): Promise<any> {
  return apiFetch(`/api/dataset/state?session_id=${activeSessionId}&dataset=${dataset}&_t=${Date.now()}`);
}

export async function getDatasetPreview(
  dataset = "single",
  params: {
    page?: number;
    pageSize?: number;
    search?: string;
    sortCol?: string;
    sortAsc?: boolean;
    which?: "working" | "original" | "finalized";
  } = {}
): Promise<any> {
  const q = new URLSearchParams({
    session_id: activeSessionId || "",
    dataset,
    page: String(params.page ?? 0),
    page_size: String(params.pageSize ?? 50),
    search: params.search ?? "",
    sort_col: params.sortCol ?? "",
    sort_asc: String(params.sortAsc ?? true),
    which: params.which ?? "working",
    _t: String(Date.now()),
  });
  return apiFetch(`/api/dataset/preview?${q.toString()}`);
}

export async function getAffectedRows(dataset: string, indices: number[]): Promise<any> {
  return apiFetch("/api/dataset/affected-rows", {
    method: "POST",
    body: JSON.stringify({ session_id: activeSessionId, dataset, indices }),
  });
}

// ===== CLEANING =====
export async function editCell(dataset: string, rowIndex: number, column: string, newValue: any): Promise<any> {
  return apiFetch("/api/clean/edit-cell", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      row_index: rowIndex,
      column,
      new_value: newValue,
    }),
  });
}

export async function deleteRows(dataset: string, rowIndices: number[]): Promise<any> {
  return apiFetch("/api/clean/delete-rows", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      row_indices: rowIndices,
    }),
  });
}

export async function deleteColumns(dataset: string, columns: string[]): Promise<any> {
  return apiFetch("/api/clean/delete-columns", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      columns,
    }),
  });
}

export async function renameColumn(dataset: string, oldName: string, newName: string): Promise<any> {
  return apiFetch("/api/clean/rename-column", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      old_name: oldName,
      new_name: newName,
    }),
  });
}

export async function previewFillMissing(dataset: string, column: string, method: string, manualValue?: any): Promise<any> {
  return apiFetch("/api/clean/preview-fill-missing", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      column,
      method,
      manual_value: manualValue,
    }),
  });
}

export async function fillMissing(dataset: string, column: string, method: string, manualValue?: any): Promise<any> {
  return apiFetch("/api/clean/fill-missing", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      column,
      method,
      manual_value: manualValue,
    }),
  });
}

export async function removeDuplicates(dataset: string, keep: "first" | "last" = "first"): Promise<any> {
  return apiFetch("/api/clean/remove-duplicates", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      keep,
    }),
  });
}

export async function previewType(dataset: string, column: string, targetType: string): Promise<any> {
  return apiFetch("/api/clean/preview-type", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      column,
      target_type: targetType,
    }),
  });
}

export async function repairType(dataset: string, column: string, targetType: string): Promise<any> {
  return apiFetch("/api/clean/repair-type", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      column,
      target_type: targetType,
    }),
  });
}

export async function resolveOutlier(
  dataset: string,
  rowIndex: number,
  column: string,
  resolution: "keep" | "delete_row" | "correct" | "replace",
  imputeMethod?: string,
  manualValue?: any
): Promise<any> {
  return apiFetch("/api/clean/resolve-outlier", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      row_index: rowIndex,
      column,
      resolution,
      impute_method: imputeMethod,
      manual_value: manualValue,
    }),
  });
}

export async function resolveSuspicious(
  dataset: string,
  rowIndex: number,
  column: string,
  resolution: "delete_row" | "keep" | "correct" | "replace",
  manualValue?: any,
  imputeMethod?: string
): Promise<any> {
  return apiFetch("/api/clean/resolve-suspicious", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      row_index: rowIndex,
      column,
      resolution,
      manual_value: manualValue,
      impute_method: imputeMethod,
    }),
  });
}

export async function undo(dataset: string): Promise<any> {
  return apiFetch("/api/clean/undo", {
    method: "POST",
    body: JSON.stringify({ session_id: activeSessionId, dataset }),
  });
}

export async function reset(dataset: string): Promise<any> {
  return apiFetch("/api/clean/reset", {
    method: "POST",
    body: JSON.stringify({ session_id: activeSessionId, dataset }),
  });
}

export async function finalize(dataset: string): Promise<any> {
  return apiFetch("/api/clean/finalize", {
    method: "POST",
    body: JSON.stringify({ session_id: activeSessionId, dataset }),
  });
}

export async function getHistory(dataset: string): Promise<any> {
  return apiFetch(`/api/clean/history?session_id=${activeSessionId}&dataset=${dataset}&_t=${Date.now()}`);
}

// ===== COMPARISON =====
export async function runComparison(): Promise<any> {
  return apiFetch("/api/compare/run", {
    method: "POST",
    body: JSON.stringify({ session_id: activeSessionId }),
    timeoutMs: 45000,
  });
}

export async function previewComparison(): Promise<any> {
  return apiFetch("/api/compare/preview", {
    method: "POST",
    body: JSON.stringify({ session_id: activeSessionId }),
    timeoutMs: 45000,
  });
}

export async function getComparison(): Promise<any> {
  return apiFetch(`/api/compare/result?session_id=${activeSessionId}&_t=${Date.now()}`);
}

// ===== VISUALIZATION =====
export async function getAvailableCharts(dataset = "single"): Promise<any> {
  return apiFetch(`/api/viz/available?session_id=${activeSessionId}&dataset=${dataset}&_t=${Date.now()}`);
}

export async function getDatasetOverview(dataset = "single", which: "working" | "original" | "finalized" = "working"): Promise<any> {
  return apiFetch(`/api/viz/dataset-overview?session_id=${activeSessionId}&dataset=${dataset}&which=${which}&_t=${Date.now()}`);
}

export async function generateChart(
  dataset = "single",
  chartType: string,
  config: Record<string, any>,
  which: "working" | "original" | "finalized" = "working"
): Promise<any> {
  return apiFetch("/api/viz/generate", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      dataset,
      chart_type: chartType,
      config,
      which,
    }),
  });
}

// ===== REPORTS & DOWNLOADS =====
export const getDownloadDatasetUrl = (dataset = "single") => {
  return `${getBackendUrl()}/api/download/dataset?session_id=${activeSessionId}&dataset=${dataset}`;
};

export const getDownloadMissingLogUrl = (dataset = "single") => {
  return `${getBackendUrl()}/api/download/missing-log?session_id=${activeSessionId}&dataset=${dataset}`;
};

export async function fetchReportHtml(mode = "single", reportType = "analysis"): Promise<string> {
  return apiFetch<string>("/api/report/html", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      mode,
      report_type: reportType,
    }),
    timeoutMs: 45000,
  });
}

export async function fetchReportPdfBlob(mode = "single", reportType = "analysis"): Promise<Blob> {
  return apiFetch<Blob>("/api/report/pdf", {
    method: "POST",
    body: JSON.stringify({
      session_id: activeSessionId,
      mode,
      report_type: reportType,
    }),
    timeoutMs: 60000,
  });
}

