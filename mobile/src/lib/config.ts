import Constants from "expo-constants";
import { Platform } from "react-native";

// where the Aynix backend is
// 1. EXPO_PUBLIC_API_URL if you set it (use this in production)
// 2. on a phone with Expo Go: the same computer that runs "npx expo start", port 3000
// 3. in a web browser: this computer, port 3000
const guessApiUrl = () => {
  const fromEnv = process.env.EXPO_PUBLIC_API_URL;
  if (fromEnv) return fromEnv.replace(/\/$/, "");

  if (Platform.OS === "web" && typeof window !== "undefined") {
    return `${window.location.protocol}//${window.location.hostname}:3000`;
  }

  // hostUri looks like "192.168.1.20:8081" (the computer running Expo)
  const host = Constants.expoConfig?.hostUri?.split(":")[0];
  return `http://${host ?? "localhost"}:3000`;
};

export const API_URL = guessApiUrl();
