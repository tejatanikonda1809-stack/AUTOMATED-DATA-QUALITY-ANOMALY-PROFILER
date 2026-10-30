import { Platform } from "react-native";
import AsyncStorage from "@react-native-async-storage/async-storage";

const BACKEND_URL_STORAGE_KEY = "cleancore_backend_url";

export const getDefaultBackendUrl = (): string => {
  if (Platform.OS === "web") {
    if (typeof window !== "undefined" && window.location && window.location.hostname) {
      const host = window.location.hostname;
      return `http://${host}:5000`;
    }
    return "http://127.0.0.1:5000";
  } else if (Platform.OS === "android") {
    // 10.0.2.2 is the standard loopback alias to host machine from Android Emulator
    return "http://10.0.2.2:5000";
  } else {
    return "http://127.0.0.1:5000";
  }
};

let currentBackendUrl = getDefaultBackendUrl();

export const getBackendUrl = (): string => currentBackendUrl;

export const setBackendUrl = async (url: string): Promise<void> => {
  const cleanUrl = url.trim().replace(/\/+$/, "");
  currentBackendUrl = cleanUrl;
  await AsyncStorage.setItem(BACKEND_URL_STORAGE_KEY, cleanUrl);
};

export const initBackendUrl = async (): Promise<string> => {
  try {
    const saved = await AsyncStorage.getItem(BACKEND_URL_STORAGE_KEY);
    if (saved && saved.startsWith("http")) {
      currentBackendUrl = saved.trim().replace(/\/+$/, "");
    } else {
      currentBackendUrl = getDefaultBackendUrl();
    }
  } catch {
    currentBackendUrl = getDefaultBackendUrl();
  }
  return currentBackendUrl;
};

