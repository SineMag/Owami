import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import { View } from "react-native";
import { useEffect, useState } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { StatusBar } from "expo-status-bar";
import * as Font from "expo-font";
import MDIcon from "@react-native-vector-icons/material-design-icons";

import { ErrorBoundary } from "@/src/components/error-boundary";
import { queryClient } from "@/src/query-client";
import { AuthProvider } from "@/src/hooks/useAuth";
import { initializeRevenueCat, SubscriptionProvider } from "@/src/lib/revenuecat";
import { RevenueCatIdentityBinder } from "@/src/components/revenuecat-identity-binder";

// Initialize RevenueCat SDK at module scope (never inside a component), guarded so
// missing keys / web preview never crash the app.
try { initializeRevenueCat(); } catch (err) { console.warn("RevenueCat unavailable:", err); }

export default function RootLayout() {
  const [ready, setReady] = useState(false);
  useEffect(() => {
    (async () => {
      try {
        const f = (MDIcon as any)?.font;
        if (f) await Font.loadAsync(f);
      } catch {}
      setReady(true);
    })();
  }, []);
  if (!ready) return <View style={{ flex: 1, backgroundColor: "#FDFBF7" }} />;
  return (
    <ErrorBoundary>
      <GestureHandlerRootView style={{ flex: 1 }}>
        <SafeAreaProvider>
          <QueryClientProvider client={queryClient}>
            <AuthProvider>
              <SubscriptionProvider>
                <RevenueCatIdentityBinder />
                <StatusBar style="dark" />
                <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: "#FDFBF7" } }} />
              </SubscriptionProvider>
            </AuthProvider>
          </QueryClientProvider>
        </SafeAreaProvider>
      </GestureHandlerRootView>
    </ErrorBoundary>
  );
}
