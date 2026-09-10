import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import { useRouter } from "expo-router";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/src/theme";

export default function Welcome() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  return (
    <View style={styles.root}>
      <Image
        source={{ uri: "https://images.unsplash.com/photo-1761662826410-3218852da3bf?w=1200&q=80" }}
        style={StyleSheet.absoluteFillObject}
        contentFit="cover"
      />
      <LinearGradient
        colors={["rgba(45,30,25,0.2)", "rgba(45,30,25,0.85)", "rgba(45,30,25,0.96)"]}
        locations={[0, 0.55, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View style={[styles.content, { paddingTop: insets.top + spacing.lg, paddingBottom: insets.bottom + spacing.xl }]}>
        <View style={styles.top}>
          <View style={styles.logoDot} />
          <Text style={styles.brandName}>Owami</Text>
        </View>
        <View>
          <Text style={styles.title}>Your personal cookbook{"\n"}that cooks with you.</Text>
          <Text style={styles.tag}>Save recipes, create meals, and cook hands-free.</Text>
          <Pressable testID="welcome-signup-button" style={styles.cta} onPress={() => router.push("/auth/register")}>
            <Text style={styles.ctaText}>Create your cookbook</Text>
          </Pressable>
          <Pressable testID="welcome-signin-button" style={styles.ghost} onPress={() => router.push("/auth/login")}>
            <Text style={styles.ghostText}>I already have an account</Text>
          </Pressable>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.surfaceInverse },
  content: { flex: 1, justifyContent: "space-between", paddingHorizontal: spacing.xl },
  top: { flexDirection: "row", alignItems: "center", gap: spacing.sm },
  logoDot: { width: 12, height: 12, borderRadius: 6, backgroundColor: colors.brandSecondary },
  brandName: { fontSize: 20, color: colors.onSurfaceInverse, fontWeight: "600", letterSpacing: 0.5 },
  title: { fontSize: 36, lineHeight: 42, color: colors.onSurfaceInverse, fontWeight: "700", marginBottom: spacing.md },
  tag: { color: "#F4EDE4", opacity: 0.9, fontSize: 16, marginBottom: spacing.xl },
  cta: { backgroundColor: colors.brandPrimary, paddingVertical: 18, borderRadius: radii.lg, alignItems: "center", marginBottom: spacing.md },
  ctaText: { color: colors.onBrandPrimary, fontSize: 17, fontWeight: "600" },
  ghost: { paddingVertical: 14, alignItems: "center" },
  ghostText: { color: colors.onSurfaceInverse, fontSize: 15, fontWeight: "500" },
});
