import { useEffect, useState } from "react";
import { ActivityIndicator, Platform, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import * as Linking from "expo-linking";
import { useRouter } from "expo-router";
import { useQuery } from "@tanstack/react-query";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { useAuth } from "@/src/hooks/useAuth";
import { api } from "@/src/api/client";
import { useSubscription } from "@/src/lib/revenuecat";
import { ConfirmModal } from "@/src/components/confirm-modal";
import { colors, radii, spacing } from "@/src/theme";

// react-native-purchases-ui is native-only. Try to load it; on web this stays null.
let RevenueCatUI: any = null;
try { RevenueCatUI = require("react-native-purchases-ui").default ?? require("react-native-purchases-ui"); } catch {}

const FEATURES = [
  { icon: "microphone-message", title: "Unlimited Cookist Mode", sub: "Hands-free voice cooking, every recipe." },
  { icon: "silverware-fork-knife", title: "AI recipe creation", sub: "From what's in your kitchen, in seconds." },
  { icon: "heart-outline", title: "Personalized recommendations", sub: "Owami learns what you love." },
  { icon: "resize", title: "Scale any recipe", sub: "Perfect portions for any number of people." },
  { icon: "swap-horizontal", title: "Smart substitutions", sub: "Missing an ingredient? I have you." },
  { icon: "calendar-month-outline", title: "Advanced meal planning", sub: "A week of meals, planned in a tap." },
];

export default function Paywall() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh, user } = useAuth();
  const paystackEnabled = process.env.EXPO_PUBLIC_PAYSTACK_ENABLED === "true";
  const paystackStatus = useQuery({
    queryKey: ["paystack", "subscription-status"],
    queryFn: api.subStatus,
    enabled: paystackEnabled,
  });
  const { refetch: refetchPaystackStatus } = paystackStatus;
  const { currentOffering, isSubscribed: revenueCatSubscribed, identityReady: revenueCatIdentityReady, isLoading: revenueCatLoading, purchase, restore, isPurchasing, isRestoring } = useSubscription();
  const [confirmPkg, setConfirmPkg] = useState<any>(null);
  const [err, setErr] = useState<string | null>(null);
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const paystackPackages = (paystackStatus.data?.offerings ?? []).map((plan: any) => ({
    identifier: plan.id,
    product: { title: plan.title, priceString: plan.price, description: plan.period },
    packageType: plan.period === "year" ? "ANNUAL" : "MONTHLY",
  }));
  const packages = paystackEnabled ? paystackPackages : (currentOffering?.availablePackages ?? []);
  const selectedPkg = packages.find(p => p.identifier === selectedId) ?? packages[0] ?? null;
  const isSubscribed = paystackEnabled ? !!paystackStatus.data?.is_premium : revenueCatSubscribed;
  const identityReady = paystackEnabled ? !!user?.id : revenueCatIdentityReady;
  const isLoading = paystackEnabled ? paystackStatus.isLoading : revenueCatLoading;

  useEffect(() => {
    if (!paystackEnabled) return;
    const verifyUrl = async (url: string | null) => {
      if (!url) return;
      const queryParams = Linking.parse(url).queryParams ?? {};
      const reference = queryParams.reference ?? queryParams.trxref;
      if (typeof reference === "string") {
        try { await api.paystackVerify(reference); await refetchPaystackStatus(); await refresh(); }
        catch (e: any) { setErr(String(e?.message || e)); }
      }
    };
    Linking.getInitialURL().then(verifyUrl);
    const subscription = Linking.addEventListener("url", ({ url }) => verifyUrl(url));
    return () => subscription.remove();
  }, [paystackEnabled, refresh, refetchPaystackStatus, user?.id]);

  // Prefer RevenueCat's hosted paywall on native — it uses whatever offering the customer designed.
  if (!paystackEnabled && Platform.OS !== "web" && RevenueCatUI?.Paywall) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surfaceInverse }}>
        <RevenueCatUI.Paywall
          options={{ offering: currentOffering ?? undefined, displayCloseButton: true }}
          onDismiss={() => router.back()}
          onPurchaseCompleted={async () => { await refresh(); router.back(); }}
          onRestoreCompleted={async () => { await refresh(); }}
        />
      </View>
    );
  }

  // Web / preview: coded paywall driven by RevenueCat offerings.
  const onPurchase = async () => {
    if (!selectedPkg) return;
    if (!identityReady) { setErr("Sign in first, then try again."); return; }
    setConfirmPkg(selectedPkg);
  };
  const confirmPurchase = async () => {
    if (!confirmPkg) return;
    setErr(null);
    try {
      if (paystackEnabled) {
        const checkout = await api.paystackCheckout(confirmPkg.identifier);
        await Linking.openURL(checkout.url);
        setConfirmPkg(null);
        return;
      } else {
        await purchase(confirmPkg);
      }
      await refresh();
      setConfirmPkg(null);
      router.back();
    } catch (e: any) {
      const msg = String(e?.message || e);
      if (/userCancelled|user_cancelled/i.test(msg)) { setConfirmPkg(null); return; }
      setErr(msg);
      setConfirmPkg(null);
    }
  };
  const onRestore = async () => {
    setErr(null);
    try {
      await restore();
      await refresh();
    }
    catch (e: any) { setErr(String(e?.message || e)); }
  };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceInverse }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 220 }}>
        <View style={{ height: 340 }}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1770926005888-1503cab85fcd?w=1200&q=80" }} style={StyleSheet.absoluteFill} contentFit="cover" />
          <LinearGradient colors={["rgba(45,30,25,0.3)", "rgba(45,30,25,0.75)", colors.surfaceInverse]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFill} />
          <Pressable testID="paywall-close" onPress={() => router.back()} style={[styles.close, { top: insets.top + spacing.sm }]}>
            <MDIcon name="close" size={22} color={colors.onSurfaceInverse} />
          </Pressable>
          <View style={styles.heroContent}>
            <View style={styles.badge}><MDIcon name="star-four-points" size={12} color={colors.onBrandPrimary} /><Text style={styles.badgeT}>Owami+</Text></View>
            <Text style={styles.hero}>Cook smarter with Owami+</Text>
            <Text style={styles.subhero}>Save recipes, create meals, and cook hands-free — with Owami by your side.</Text>
            {isSubscribed && (
              <View testID="paywall-active-badge" style={styles.activeBadge}>
                <MDIcon name="check-circle" size={14} color={colors.onSuccess} />
                <Text style={styles.activeT}>You&apos;re subscribed</Text>
              </View>
            )}
          </View>
        </View>

        <View style={{ padding: spacing.xl }}>
          {FEATURES.map((f, i) => (
            <View key={i} style={styles.featRow}>
              <View style={styles.featIcon}><MDIcon name={f.icon as any} size={20} color={colors.brandSecondary} /></View>
              <View style={{ flex: 1 }}>
                <Text style={styles.featT}>{f.title}</Text>
                <Text style={styles.featS}>{f.sub}</Text>
              </View>
              <MDIcon name="check-circle" size={20} color={colors.brandSecondary} />
            </View>
          ))}

          <Text style={styles.pickH}>Choose your plan</Text>
          {isLoading ? (
            <ActivityIndicator color={colors.brandSecondary} />
          ) : packages.length === 0 ? (
            <View style={styles.emptyBox}>
              <Text style={styles.emptyT}>Subscription options are unavailable right now.</Text>
              <Text style={styles.emptyS}>Please try again later.</Text>
            </View>
          ) : (
            packages.map((p) => {
              const active = (selectedId ?? packages[0]?.identifier) === p.identifier;
              return (
                <Pressable key={p.identifier} testID={`paywall-option-${p.identifier}`} onPress={() => setSelectedId(p.identifier)}
                  style={[styles.plan, active && { borderColor: colors.brandSecondary, backgroundColor: "rgba(222,143,66,0.1)" }]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.planT}>{p.product.title || p.identifier}</Text>
                      {p.packageType === "ANNUAL" && <View style={styles.saveBadge}><Text style={styles.saveBadgeT}>Best value</Text></View>}
                    </View>
                    <Text style={styles.planS}>{p.product.priceString} · {p.product.description || p.packageType.toLowerCase()}</Text>
                  </View>
                  <View style={[styles.radio, active && { borderColor: colors.brandSecondary, backgroundColor: colors.brandSecondary }]}>
                    {active && <MDIcon name="check" size={14} color={colors.onBrandSecondary} />}
                  </View>
                </Pressable>
              );
            })
          )}
          {err && <Text style={styles.err} testID="paywall-error">{err}</Text>}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="paywall-subscribe" onPress={onPurchase} disabled={isPurchasing || !selectedPkg}
          style={[styles.cta, (isPurchasing || !selectedPkg) && { opacity: 0.6 }]}>
          {isPurchasing ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaT}>Start cooking with Owami+</Text>}
        </Pressable>
        <View style={styles.legalRow}>
          <Pressable testID="paywall-restore" onPress={onRestore}>
            <Text style={styles.legalL}>{isRestoring ? "Restoring…" : "Restore purchases"}</Text>
          </Pressable>
          <Text style={styles.legalD}>·</Text>
          <Pressable onPress={() => router.push("/policy?type=terms")}><Text style={styles.legalL}>Terms</Text></Pressable>
          <Text style={styles.legalD}>·</Text>
          <Pressable onPress={() => router.push("/policy")}><Text style={styles.legalL}>Privacy</Text></Pressable>
        </View>
      </View>

      {/* Confirm modal (Test Store deliberate confirmation) */}
      <ConfirmModal
        testID="paywall-confirm"
        visible={!!confirmPkg}
        icon="star-four-points"
        title="Confirm your subscription"
        message={confirmPkg ? `${confirmPkg.product.title} · ${confirmPkg.product.priceString}` : undefined}
        confirmText={isPurchasing ? "Subscribing…" : "Subscribe"}
        cancelText="Not now"
        loading={isPurchasing}
        onCancel={() => setConfirmPkg(null)}
        onConfirm={confirmPurchase}
      />
    </View>
  );
}
const styles = StyleSheet.create({
  close: { position: "absolute", right: spacing.lg, width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(45,30,25,0.55)", alignItems: "center", justifyContent: "center" },
  heroContent: { position: "absolute", bottom: 0, padding: spacing.xl },
  badge: { flexDirection: "row", alignItems: "center", gap: 4, alignSelf: "flex-start", backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 4, borderRadius: radii.pill, marginBottom: 10 },
  badgeT: { color: colors.onBrandPrimary, fontSize: 11, fontWeight: "700", letterSpacing: 0.5 },
  hero: { color: colors.onSurfaceInverse, fontSize: 34, fontWeight: "700", lineHeight: 38 },
  subhero: { color: "#F4EDE4", fontSize: 15, marginTop: 6, opacity: 0.9 },
  activeBadge: { flexDirection: "row", gap: 6, alignItems: "center", alignSelf: "flex-start", backgroundColor: colors.success, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill, marginTop: 10 },
  activeT: { color: colors.onSuccess, fontWeight: "700", fontSize: 12 },
  featRow: { flexDirection: "row", alignItems: "center", gap: 14, paddingVertical: 12, borderBottomWidth: 1, borderBottomColor: "rgba(253,251,247,0.08)" },
  featIcon: { width: 36, height: 36, borderRadius: 18, backgroundColor: "rgba(222,143,66,0.15)", alignItems: "center", justifyContent: "center" },
  featT: { color: colors.onSurfaceInverse, fontWeight: "600", fontSize: 15 },
  featS: { color: "#CDBCA7", fontSize: 12, marginTop: 2 },
  pickH: { color: colors.onSurfaceInverse, fontSize: 20, fontWeight: "700", marginTop: spacing.xxl, marginBottom: spacing.md },
  plan: { flexDirection: "row", alignItems: "center", gap: spacing.md, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 2, borderColor: "rgba(253,251,247,0.1)", marginBottom: spacing.sm },
  planT: { color: colors.onSurfaceInverse, fontWeight: "700", fontSize: 16 },
  planS: { color: "#CDBCA7", fontSize: 13, marginTop: 3 },
  saveBadge: { backgroundColor: colors.brandSecondary, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  saveBadgeT: { color: colors.onBrandSecondary, fontSize: 10, fontWeight: "700" },
  radio: { width: 24, height: 24, borderRadius: 12, borderWidth: 2, borderColor: "rgba(253,251,247,0.3)", alignItems: "center", justifyContent: "center" },
  emptyBox: { padding: spacing.lg, backgroundColor: "rgba(253,251,247,0.06)", borderRadius: radii.md },
  emptyT: { color: colors.onSurfaceInverse, fontWeight: "700" },
  emptyS: { color: "#CDBCA7", fontSize: 13, marginTop: 4 },
  err: { color: colors.error, marginTop: spacing.md },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surfaceInverse, borderTopWidth: 1, borderTopColor: "rgba(253,251,247,0.08)" },
  cta: { backgroundColor: colors.brandPrimary, padding: 18, borderRadius: radii.lg, alignItems: "center" },
  ctaT: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
  legalRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 10 },
  legalL: { color: "#CDBCA7", fontSize: 12 },
  legalD: { color: "#CDBCA7", fontSize: 12 },
  confirmBackdrop: { position: "absolute", inset: 0 as any, backgroundColor: "rgba(45,30,25,0.6)", alignItems: "center", justifyContent: "center", padding: spacing.xl },
  confirmCard: { backgroundColor: colors.surface, padding: spacing.xl, borderRadius: radii.lg, alignItems: "center", width: "100%", maxWidth: 340 },
  confirmH: { color: colors.onSurface, fontSize: 20, fontWeight: "700", marginTop: 8 },
  confirmS: { color: colors.muted, marginTop: 4, textAlign: "center" },
  confirmBtn: { flex: 1, padding: 14, borderRadius: radii.md, alignItems: "center", justifyContent: "center" },
  confirmBtnGhost: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
});
