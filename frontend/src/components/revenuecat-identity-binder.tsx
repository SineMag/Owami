import { useEffect, useState } from "react";
import { View, Text, StyleSheet } from "react-native";
import { useQueryClient } from "@tanstack/react-query";
import { useAuth } from "@/src/hooks/useAuth";
import { bindRevenueCatIdentity, rcEnabled } from "@/src/lib/revenuecat";
import { colors, radii, spacing } from "@/src/theme";

/**
 * Binds the RevenueCat SDK identity to the app's authenticated user on every auth
 * change (sign-in, sign-up, session restore, sign-out). If binding fails we render
 * a non-blocking banner — anonymous purchases would never map to the buyer.
 */
export function RevenueCatIdentityBinder() {
  const { user, loading } = useAuth();
  const queryClient = useQueryClient();
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!rcEnabled || loading) return;
    (async () => {
      try {
        await bindRevenueCatIdentity(user?.id ?? null, queryClient);
        setErr(null);
      } catch (e: any) {
        setErr(String(e?.message || e));
      }
    })();
  }, [user?.id, loading, queryClient]);

  if (!err) return null;
  return (
    <View style={styles.banner} pointerEvents="none">
      <Text style={styles.bannerT} numberOfLines={2}>Purchases unavailable: {err}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  banner: { position: "absolute", top: 44, left: spacing.md, right: spacing.md, backgroundColor: colors.error, padding: spacing.sm, borderRadius: radii.md, zIndex: 999 },
  bannerT: { color: colors.onError, fontSize: 12, fontWeight: "600", textAlign: "center" },
});
