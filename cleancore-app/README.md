# CleanCore — High-Fidelity Mobile Container (React Native + Expo)

This mobile application wraps your **actual CleanCore web application** (`frontend/index.html`, `frontend/css/main.css`, and all original `frontend/js/*.js` modules) inside a native Android container using **React Native**, **Expo SDK 58**, and **`react-native-webview`**.

---

## 🎯 Design & Architecture

Unlike generic ports that redesign or alter UI layouts, this container:
* **Loads the actual original frontend:** All CSS variables, cards, sidebar, topbar, Light/Dark/Dim themes, 3D tilt effects, data tables, modals, and Plotly charts are loaded directly.
* **Preserves 100% of the original codebase:** Zero changes were made to `backend/`, `frontend/`, `tests/`, or `templates/`.
* **Native Android Bridge:**
  * **File Uploads (`.csv`, `.xlsx`, `.xls`):** Android WebView native file picker hooks into Android's native file selector.
  * **Excel Sheet Selector:** Your original multi-sheet modal (`frontend/js/upload.js`) displays seamlessly in the WebView.
  * **Downloads & Sharing:** Intercepts `/api/download/dataset`, `/api/download/missing-log`, `/api/report/pdf`, and `/api/report/html`. It uses `expo-file-system` to download the file to the phone and triggers `expo-sharing` so the Android native "Save to Downloads / Share via App" dialog opens immediately.
* **Server Address Switcher:** A discreet topbar pill displays server status and allows switching between Localhost, Android Emulator (`http://10.0.2.2:5000`), or your Computer's Local Wi-Fi IP (`http://192.168.1.X:5000`).

---

## 🚀 How to Run the App

### 1. Start the Flask Backend
From the root workspace directory:
```powershell
python run.py
```
*The Flask server runs on port 5000 and serves both the desktop browser and the mobile app.*

---

### 2. Run on Laptop Browser (Expo Web)
From the `cleancore-app/` directory:
```powershell
cd cleancore-app
npm run web
```
*Opens in your browser at `http://localhost:8081`.*

---

### 3. Run on Physical Android Phone (Expo Go)
1. Install **Expo Go** from Google Play Store on your phone.
2. Make sure your phone and computer are on the **same Wi-Fi network**.
3. In `cleancore-app/`, start Expo:
   ```powershell
   npx expo start
   ```
4. Scan the QR code in your terminal with Expo Go.
5. In the CleanCore topbar, tap the **Server Status Pill**, enter your computer's local Wi-Fi IP (e.g. `http://192.168.1.15:5000`), tap **Test Ping**, and click **Save & Connect**.

---

### 4. Run on Android Studio Emulator
1. Start an Android Virtual Device (AVD).
2. In `cleancore-app/`, run:
   ```powershell
   npm run android
   ```
*The app automatically maps to `http://10.0.2.2:5000` on Android emulators.*

---

## 📦 How to Generate an Installable Android APK

An `eas.json` build profile is pre-configured for direct standalone `.apk` output:

### Cloud Build (Recommended — No Android Studio or NDK needed):
```powershell
# 1. Install EAS CLI globally
npm install -g eas-cli

# 2. Login to your free Expo account
eas login

# 3. Build the standalone APK
eas build -p android --profile preview
```
*EAS compiles the APK in the cloud and prints a direct download link and QR code to install the APK directly on any Android phone.*

### Local Build (Requires Android Studio & SDK installed):
```powershell
npx expo run:android --variant release
```

---

## 📋 Verified Feature Checklist & Limitations

| Feature | Desktop Web (`:5000`) | Expo Web (`:8081`) | Android Native App | Notes |
| :--- | :---: | :---: | :---: | :--- |
| **Original UI & Layout** | Yes | Yes | Yes | 100% identical styling and CSS variables |
| **Light / Dark / Dim Themes** | Yes | Yes | Yes | Synchronized with Plotly charts |
| **CSV & Excel Uploads** | Yes | Yes | Yes | Native file picker enabled |
| **Multi-Sheet Excel Picker** | Yes | Yes | Yes | In-DOM modal displays natively |
| **0–100 Quality Scoring** | Yes | Yes | Yes | Real-time score & factor breakdown |
| **Issue Center (6 categories)**| Yes | Yes | Yes | Quick action buttons trigger modals |
| **Interactive Cleaning Studio**| Yes | Yes | Yes | Cell edits, imputations, type casts |
| **Pre-flight Confirmation** | Yes | Yes | Yes | Shows affected sample rows before apply |
| **Undo / Reset Rollback** | Yes | Yes | Yes | Restores previous states accurately |
| **Two-Dataset Comparison** | Yes | Yes | Yes | Record linkage and KS drift testing |
| **Interactive Plotly Charts** | Yes | Yes | Yes | Full zoom, pan, hover tooltips |
| **Cleaned CSV Download** | Yes | Yes | Yes | Uses `expo-sharing` on Android |
| **WeasyPrint PDF Report** | Yes | Yes | Yes | Streams PDF and opens Android share dialog |

### Known Limitations
* **Localhost on Android:** When testing on a physical phone, `localhost` refers to the phone itself, not the computer. Always use your computer's local Wi-Fi IP (e.g. `192.168.1.X:5000`).
* **Python Runtime:** Android does not run Pandas/NumPy/SciPy directly on the phone. The Flask server must remain running on your computer or be hosted on a cloud provider.
