import { Image } from "expo-image";
import { Pressable, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { LinearGradient } from "expo-linear-gradient";
import { colors, radii, spacing } from "@/src/theme";
import type { Recipe } from "@/src/api/client";
import { fileUrl } from "@/src/api/client";

export function RecipeCard({ recipe, size = "md" }: { recipe: Recipe; size?: "sm" | "md" | "lg" }) {
  const router = useRouter();
  const dims = size === "lg" ? { w: 300, h: 220 } : size === "sm" ? { w: 160, h: 200 } : { w: 220, h: 240 };
  return (
    <Pressable
      testID={`recipe-card-${recipe.id}`}
      onPress={() => router.push(`/recipe/${recipe.id}`)}
      style={[styles.card, { width: dims.w }]}
    >
      <View style={{ width: "100%", height: dims.h, borderRadius: radii.lg, overflow: "hidden", backgroundColor: colors.surfaceTertiary }}>
        <Image source={{ uri: fileUrl(recipe.image_url) }} style={{ flex: 1 }} contentFit="cover" transition={200} />
        <LinearGradient
          colors={["transparent", "rgba(45,30,25,0.85)"]}
          locations={[0.5, 1]}
          style={StyleSheet.absoluteFillObject}
        />
        <View style={styles.overlay}>
          <Text numberOfLines={2} style={styles.title}>{recipe.title}</Text>
          <View style={styles.metaRow}>
            <Text style={styles.meta}>{(recipe.prep_time || 0) + (recipe.cook_time || 0)} min</Text>
            <View style={styles.dot} />
            <Text style={styles.meta}>{recipe.difficulty}</Text>
          </View>
        </View>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: { marginRight: spacing.md },
  overlay: { position: "absolute", bottom: 0, padding: spacing.md, gap: 4 },
  title: { color: "#FDFBF7", fontSize: 17, fontWeight: "700" },
  metaRow: { flexDirection: "row", alignItems: "center", gap: 6 },
  meta: { color: "#F4EDE4", fontSize: 12, fontWeight: "500" },
  dot: { width: 3, height: 3, borderRadius: 2, backgroundColor: "#F4EDE4", opacity: 0.7 },
});
