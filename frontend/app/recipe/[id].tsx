import { useLocalSearchParams, useRouter } from "expo-router";
import { ActivityIndicator, Pressable, ScrollView, Share, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import { LinearGradient } from "expo-linear-gradient";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { useState } from "react";
import { api, fileUrl } from "@/src/api/client";
import { colors, radii, spacing } from "@/src/theme";

export default function RecipeDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const qc = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [saved, setSaved] = useState(false);
  const { data: r, isLoading } = useQuery({ queryKey: ["recipe", id], queryFn: () => api.getRecipe(id!), enabled: !!id });

  const onLike = async () => { const res = await api.likeToggle(id!); setLiked(res.liked); qc.invalidateQueries({ queryKey: ["likes"] }); };
  const onSave = async () => { const res = await api.saveToggle(id!); setSaved(res.saved); qc.invalidateQueries({ queryKey: ["saves"] }); };
  const onShare = async () => { if (r) await Share.share({ message: `Cook "${r.title}" with me on Owami — ${r.description}` }); };
  const onStart = async () => { await api.recordHistory(id!, "started"); router.push(`/cookist/${id}`); };

  if (isLoading || !r) return <View style={{ flex: 1, backgroundColor: colors.surface, alignItems: "center", justifyContent: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingBottom: 140 }}>
        <View style={{ height: 340 }}>
          <Image source={{ uri: fileUrl(r.image_url) }} style={StyleSheet.absoluteFillObject} contentFit="cover" />
          <LinearGradient colors={["rgba(45,30,25,0.4)", "transparent", "rgba(45,30,25,0.8)"]} locations={[0, 0.4, 1]} style={StyleSheet.absoluteFillObject} />
          <View style={[styles.topRow, { top: insets.top + spacing.sm }]}>
            <Pressable testID="recipe-back" onPress={() => router.back()} style={styles.iconBtn}><MDIcon name="arrow-left" size={22} color={colors.onSurfaceInverse} /></Pressable>
            <View style={{ flexDirection: "row", gap: spacing.sm }}>
              <Pressable testID="recipe-share" onPress={onShare} style={styles.iconBtn}><MDIcon name="share-variant" size={22} color={colors.onSurfaceInverse} /></Pressable>
              <Pressable testID="recipe-like" onPress={onLike} style={styles.iconBtn}><MDIcon name={liked ? "heart" : "heart-outline"} size={22} color={liked ? colors.brand : colors.onSurfaceInverse} /></Pressable>
              <Pressable testID="recipe-save" onPress={onSave} style={styles.iconBtn}><MDIcon name={saved ? "bookmark" : "bookmark-outline"} size={22} color={colors.onSurfaceInverse} /></Pressable>
            </View>
          </View>
          <View style={styles.heroTitleWrap}>
            <Text style={styles.category}>{r.category?.toUpperCase()}</Text>
            <Text style={styles.title}>{r.title}</Text>
          </View>
        </View>

        <View style={{ padding: spacing.xl }}>
          <Text style={styles.desc}>{r.description}</Text>
          <View style={styles.metaRow}>
            <Meta icon="timer-sand" label="Prep" value={`${r.prep_time}m`} />
            <Meta icon="fire" label="Cook" value={`${r.cook_time}m`} />
            <Meta icon="account-group" label="Serves" value={`${r.servings}`} />
            <Meta icon="chef-hat" label="Level" value={r.difficulty} />
          </View>

          <Text style={styles.h2}>Ingredients</Text>
          {r.ingredients.map((i, idx) => (
            <View key={idx} style={styles.ingRow}>
              <View style={styles.ingDot} />
              <Text style={styles.ingName}>{i.name}</Text>
              <Text style={styles.ingQty}>{i.quantity} {i.unit}</Text>
            </View>
          ))}

          <Text style={styles.h2}>Instructions</Text>
          {r.instructions.map((s, i) => (
            <View key={i} style={styles.stepRow}>
              <View style={styles.stepNum}><Text style={styles.stepNumT}>{i + 1}</Text></View>
              <Text style={styles.stepText}>{s}</Text>
            </View>
          ))}
        </View>
      </ScrollView>

      <View style={[styles.ctaBar, { paddingBottom: insets.bottom + spacing.md }]}>
        <Pressable testID="recipe-start-cooking" onPress={onStart} style={styles.startBtn}>
          <MDIcon name="chef-hat" size={22} color={colors.onBrandPrimary} />
          <Text style={styles.startText}>Start Cooking</Text>
        </Pressable>
      </View>
    </View>
  );
}
function Meta({ icon, label, value }: any) {
  return (
    <View style={styles.metaCell}>
      <MDIcon name={icon} size={18} color={colors.brandPrimary} />
      <Text style={styles.metaLabel}>{label}</Text>
      <Text style={styles.metaValue}>{value}</Text>
    </View>
  );
}
const styles = StyleSheet.create({
  topRow: { position: "absolute", left: spacing.lg, right: spacing.lg, flexDirection: "row", justifyContent: "space-between" },
  iconBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: "rgba(45,30,25,0.55)", alignItems: "center", justifyContent: "center" },
  heroTitleWrap: { position: "absolute", left: spacing.xl, right: spacing.xl, bottom: spacing.lg },
  category: { color: "#F4EDE4", fontSize: 11, fontWeight: "700", letterSpacing: 1.5, marginBottom: 4 },
  title: { color: "#FDFBF7", fontSize: 32, fontWeight: "700", lineHeight: 36 },
  desc: { color: colors.onSurface, fontSize: 15, lineHeight: 22, marginBottom: spacing.lg },
  metaRow: { flexDirection: "row", justifyContent: "space-between", backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: spacing.md, marginBottom: spacing.xl },
  metaCell: { alignItems: "center", flex: 1 },
  metaLabel: { color: colors.muted, fontSize: 11, marginTop: 4 },
  metaValue: { color: colors.onSurface, fontWeight: "700", fontSize: 14, marginTop: 2 },
  h2: { color: colors.onSurface, fontSize: 22, fontWeight: "700", marginTop: spacing.md, marginBottom: spacing.md },
  ingRow: { flexDirection: "row", alignItems: "center", gap: 10, paddingVertical: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  ingDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandPrimary },
  ingName: { flex: 1, color: colors.onSurface, fontSize: 15 },
  ingQty: { color: colors.muted, fontWeight: "600" },
  stepRow: { flexDirection: "row", gap: 12, marginBottom: spacing.md },
  stepNum: { width: 28, height: 28, borderRadius: 14, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  stepNumT: { color: colors.onBrandPrimary, fontWeight: "700" },
  stepText: { flex: 1, color: colors.onSurface, fontSize: 15, lineHeight: 22 },
  ctaBar: { position: "absolute", left: 0, right: 0, bottom: 0, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  startBtn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 10, backgroundColor: colors.brandPrimary, padding: 18, borderRadius: radii.lg },
  startText: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 17 },
});
