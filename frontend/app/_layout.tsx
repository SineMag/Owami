import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { LogBox, Platform } from "react-native";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import MDIcon from "@react-native-vector-icons/material-design-icons";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider } from "@/src/hooks/useAuth";

LogBox.ignoreAllLogs(true);

// Prewarm the icon font so it never renders as boxed placeholders in Expo Go on Android.
// This has to be done at the top level and awaited before UI mounts icons.
async function prewarmIcons() {
  try {
    const fontFile = (MDIcon as any)?.font;
    if (fontFile) {
      await Font.loadAsync(fontFile);
    }
  } catch {}
}

export default function RootLayout() {
  useEffect(() => { prewarmIcons(); }, []);
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FDFBF7" } }} />
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
