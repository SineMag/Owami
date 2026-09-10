import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useQuery } from "@tanstack/react-query";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/hooks/useAuth";
import { colors, radii, spacing } from "@/src/theme";

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
  const { refresh } = useAuth();
  const sub = useQuery({ queryKey: ["sub"], queryFn: () => api.subStatus() });
  const [selected, setSelected] = useState<string>("owami_plus_yearly");
  const [busy, setBusy] = useState(false);

  const purchase = async () => {
    setBusy(true);
    try { await api.mockPurchase(); await refresh(); router.back(); }
    catch (e) { setBusy(false); }
  };
  const restore = async () => { await api.restore(); await refresh(); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surfaceInverse }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 200 }}>
        <View style={{ height: 380 }}>
          <Image source={{ uri: "https://images.unsplash.com/photo-1770926005888-1503cab85fcd?w=1200&q=80" }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={["rgba(45,30,25,0.3)", "rgba(45,30,25,0.75)", colors.surfaceInverse]} locations={[0, 0.5, 1]} style={StyleSheet.absoluteFillObject} />
          <Pressable testID="paywall-close" onPress={() => router.back()} style={[styles.close, { top: insets.top + spacing.sm }]}>
            <MDIcon name="close" size={22} color={colors.onSurfaceInverse} />
          </Pressable>
          <View style={styles.heroContent}>
            <View style={styles.badge}><MDIcon name="star-four-points" size={12} color={colors.onBrandPrimary} /><Text style={styles.badgeT}>Owami+</Text></View>
            <Text style={styles.hero}>Cook smarter with Owami+</Text>
            <Text style={styles.subhero}>Save recipes, create meals, and cook hands-free — with Owami by your side.</Text>
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
          {sub.isLoading ? <ActivityIndicator color={colors.brandSecondary} /> : (
            (sub.data?.offerings || []).map((o: any) => {
              const active = selected === o.id;
              return (
                <Pressable key={o.id} testID={`paywall-option-${o.id}`} onPress={() => setSelected(o.id)}
                  style={[styles.plan, active && { borderColor: colors.brandSecondary, backgroundColor: "rgba(222,143,66,0.1)" }]}
                >
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: "row", alignItems: "center", gap: 8 }}>
                      <Text style={styles.planT}>{o.title}</Text>
                      {o.badge && <View style={styles.saveBadge}><Text style={styles.saveBadgeT}>{o.badge}</Text></View>}
                    </View>
                    <Text style={styles.planS}>{o.price} · billed per {o.period}</Text>
                  </View>
                  <View style={[styles.radio, active && { borderColor: colors.brandSecondary, backgroundColor: colors.brandSecondary }]}>
                    {active && <MDIcon name="check" size={14} color={colors.onBrandSecondary} />}
                  </View>
                </Pressable>
              );
            })
          )}
        </View>
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="paywall-subscribe" onPress={purchase} style={[styles.cta, { opacity: busy ? 0.6 : 1 }]} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaT}>Start cooking with Owami+</Text>}
        </Pressable>
        <View style={styles.legalRow}>
          <Pressable testID="paywall-restore" onPress={restore}><Text style={styles.legalL}>Restore purchases</Text></Pressable>
          <Text style={styles.legalD}>·</Text>
          <Pressable onPress={() => router.push("/policy?type=terms")}><Text style={styles.legalL}>Terms</Text></Pressable>
          <Text style={styles.legalD}>·</Text>
          <Pressable onPress={() => router.push("/policy")}><Text style={styles.legalL}>Privacy</Text></Pressable>
        </View>
      </View>
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
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surfaceInverse, borderTopWidth: 1, borderTopColor: "rgba(253,251,247,0.08)" },
  cta: { backgroundColor: colors.brandPrimary, padding: 18, borderRadius: radii.lg, alignItems: "center" },
  ctaT: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
  legalRow: { flexDirection: "row", justifyContent: "center", gap: 10, marginTop: 10 },
  legalL: { color: "#CDBCA7", fontSize: 12 },
  legalD: { color: "#CDBCA7", fontSize: 12 },
});
