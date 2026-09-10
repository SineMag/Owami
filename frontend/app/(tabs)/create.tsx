import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useRouter } from "expo-router";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { colors, radii, spacing } from "@/src/theme";
import { useAuth } from "@/src/hooks/useAuth";

export default function Create() {
  const insets = useSafeAreaInsets();
  const router = useRouter();
  const { user } = useAuth();
  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, paddingBottom: 120 }}>
      <Text style={styles.h1}>Create</Text>
      <Text style={styles.sub}>Add a recipe by hand, or let Owami suggest one from what you have.</Text>

      <Pressable testID="create-manual" style={styles.card} onPress={() => router.push("/create/new")}>
        <View style={styles.iconBox}><MDIcon name="book-plus" size={26} color={colors.onBrandPrimary} /></View>
        <View style={{ flex: 1 }}>
          <Text style={styles.cardTitle}>Create a recipe</Text>
          <Text style={styles.cardSub}>Add ingredients, steps, and a photo.</Text>
        </View>
        <MDIcon name="chevron-right" size={24} color={colors.muted} />
      </Pressable>

      <Pressable testID="create-ai" style={styles.card} onPress={() => router.push("/create/from-ingredients")}>
        <View style={[styles.iconBox, { backgroundColor: colors.brandSecondary }]}>
          <MDIcon name="silverware-fork-knife" size={26} color={colors.onBrandSecondary} />
        </View>
        <View style={{ flex: 1 }}>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 6 }}>
            <Text style={styles.cardTitle}>What's in my kitchen?</Text>
            <View style={styles.plusBadge}><Text style={styles.plusBadgeText}>Owami+</Text></View>
          </View>
          <Text style={styles.cardSub}>List your ingredients — get a recipe in seconds.</Text>
        </View>
        <MDIcon name="chevron-right" size={24} color={colors.muted} />
      </Pressable>

      {!user?.is_premium && (
        <Pressable testID="create-upgrade" style={styles.upgrade} onPress={() => router.push("/paywall")}>
          <MDIcon name="star-four-points" size={20} color={colors.onBrandPrimary} />
          <Text style={styles.upgradeText}>Unlock Owami+ · Unlimited AI, Cookist, scaling, substitutions.</Text>
        </Pressable>
      )}
    </ScrollView>
  );
}
const styles = StyleSheet.create({
  h1: { fontSize: 28, color: colors.onSurface, fontWeight: "700" },
  sub: { color: colors.muted, marginTop: 4, marginBottom: spacing.xl },
  card: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: colors.surfaceSecondary, padding: spacing.lg, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border, marginBottom: spacing.md },
  iconBox: { width: 50, height: 50, borderRadius: radii.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  cardTitle: { color: colors.onSurface, fontSize: 17, fontWeight: "700" },
  cardSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  plusBadge: { backgroundColor: colors.brandPrimary, borderRadius: radii.pill, paddingHorizontal: 8, paddingVertical: 2 },
  plusBadgeText: { color: colors.onBrandPrimary, fontSize: 10, fontWeight: "700", letterSpacing: 0.5 },
  upgrade: { marginTop: spacing.xl, flexDirection: "row", alignItems: "center", gap: 10, backgroundColor: colors.brandPrimary, padding: spacing.lg, borderRadius: radii.lg },
  upgradeText: { flex: 1, color: colors.onBrandPrimary, fontWeight: "500", fontSize: 14 },
});
