import { useQuery } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/hooks/useAuth";
import { RecipeCard } from "@/src/components/recipe-card";
import { colors, radii, spacing } from "@/src/theme";

export default function Home() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();

  const popular = useQuery({ queryKey: ["popular"], queryFn: () => api.popular() });
  const recommended = useQuery({ queryKey: ["recommended"], queryFn: () => api.recommended() });
  const history = useQuery({ queryKey: ["history"], queryFn: () => api.history() });

  const greet = () => {
    const h = new Date().getHours();
    if (h < 12) return "Good morning";
    if (h < 18) return "Good afternoon";
    return "Good evening";
  };

  return (
    <ScrollView style={{ flex: 1, backgroundColor: colors.surface }} contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingBottom: spacing.xxxl }}>
      <View style={styles.header}>
        <View>
          <View style={{ flexDirection: "row", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
            <Text style={styles.greet}>{greet()}, {user?.display_name?.split(" ")[0] || "Cookist"}</Text>
            <MDIcon name="chef-hat" size={22} color={colors.brandPrimary} />
          </View>
          <Text style={styles.sub}>Save recipes, create meals, and cook hands-free.</Text>
        </View>
        <Pressable testID="home-profile-button" onPress={() => router.push("/(tabs)/profile")} style={styles.avatar}>
          <MDIcon name="account" size={22} color={colors.onBrandSecondary} />
        </Pressable>
      </View>

      <Pressable testID="home-hero-cta" style={styles.hero} onPress={() => router.push("/(tabs)/create")}>
        <Image source={{ uri: "https://images.unsplash.com/photo-1766596737206-214abffe65bf?w=800&q=80" }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
        <LinearGradient colors={["rgba(192,74,44,0.15)", "rgba(45,30,25,0.9)"]} locations={[0, 1]} style={StyleSheet.absoluteFillObject} />
        <View style={styles.heroContent}>
          <Text style={styles.heroKicker}>What's cooking today?</Text>
          <Text style={styles.heroTitle}>Turn what's{"\n"}in your kitchen{"\n"}into dinner.</Text>
          <View style={styles.heroPill}>
            <MDIcon name="chef-hat" size={16} color={colors.onBrandPrimary} />
            <Text style={styles.heroPillText}>Let's cook</Text>
          </View>
        </View>
      </Pressable>

      <Section title="Recommended for you">
        {recommended.isLoading ? <Loading /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hpad}>
            {(recommended.data || []).map(r => <RecipeCard key={r.id} recipe={r} />)}
            {!(recommended.data || []).length && <EmptyText text="Like a few recipes to get personalized picks." />}
          </ScrollView>
        )}
      </Section>

      <Pressable testID="home-kitchen-card" style={styles.kitchenCard} onPress={() => router.push("/create/from-ingredients")}>
        <View style={{ flex: 1 }}>
          <Text style={styles.kitchenKicker}>Owami+ · AI</Text>
          <Text style={styles.kitchenTitle}>What's in my kitchen?</Text>
          <Text style={styles.kitchenSub}>Tell me your ingredients, I'll suggest a meal.</Text>
        </View>
        <MDIcon name="silverware-fork-knife" size={44} color={colors.brandPrimary} />
      </Pressable>

      {(history.data?.length || 0) > 0 && (
        <Section title="Continue cooking">
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hpad}>
            {history.data!.map((h, i) => <RecipeCard key={h.recipe.id + i} recipe={h.recipe} size="sm" />)}
          </ScrollView>
        </Section>
      )}

      <Section title="Popular in Owami">
        {popular.isLoading ? <Loading /> : (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.hpad}>
            {(popular.data || []).map(r => <RecipeCard key={r.id} recipe={r} />)}
          </ScrollView>
        )}
      </Section>
    </ScrollView>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <View style={{ marginTop: spacing.xl }}>
      <Text style={styles.sectionTitle}>{title}</Text>
      {children}
    </View>
  );
}
function Loading() { return <View style={{ padding: spacing.lg }}><ActivityIndicator color={colors.brandPrimary} /></View>; }
function EmptyText({ text }: { text: string }) { return <Text style={{ color: colors.muted, paddingHorizontal: spacing.xl }}>{text}</Text>; }

const styles = StyleSheet.create({
  header: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", paddingHorizontal: spacing.xl, marginBottom: spacing.lg },
  greet: { fontSize: 22, color: colors.onSurface, fontWeight: "700" },
  sub: { color: colors.muted, fontSize: 13, marginTop: 2 },
  avatar: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.brandSecondary, alignItems: "center", justifyContent: "center" },
  hero: { height: 240, marginHorizontal: spacing.xl, borderRadius: radii.lg, overflow: "hidden" },
  heroContent: { flex: 1, padding: spacing.lg, justifyContent: "flex-end" },
  heroKicker: { color: "#F4EDE4", fontSize: 12, letterSpacing: 1.2, textTransform: "uppercase", fontWeight: "600", marginBottom: 6 },
  heroTitle: { color: "#FDFBF7", fontSize: 30, fontWeight: "700", lineHeight: 34 },
  heroPill: { flexDirection: "row", alignItems: "center", gap: 6, alignSelf: "flex-start", backgroundColor: colors.brandPrimary, paddingHorizontal: 14, paddingVertical: 8, borderRadius: radii.pill, marginTop: spacing.md },
  heroPillText: { color: colors.onBrandPrimary, fontWeight: "600" },
  sectionTitle: { fontSize: 20, color: colors.onSurface, fontWeight: "700", paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  hpad: { paddingHorizontal: spacing.xl, paddingRight: spacing.xxl },
  kitchenCard: { marginTop: spacing.xl, marginHorizontal: spacing.xl, flexDirection: "row", alignItems: "center", gap: spacing.md,
    backgroundColor: colors.surfaceSecondary, borderRadius: radii.lg, padding: spacing.lg, borderWidth: 1, borderColor: colors.border },
  kitchenKicker: { color: colors.brandPrimary, fontWeight: "700", fontSize: 11, letterSpacing: 1, marginBottom: 4 },
  kitchenTitle: { color: colors.onSurface, fontSize: 18, fontWeight: "700" },
  kitchenSub: { color: colors.muted, fontSize: 13, marginTop: 2 },
});
