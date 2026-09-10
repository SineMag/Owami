import { useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import { api, Recipe } from "@/src/api/client";
import { RecipeCard } from "@/src/components/recipe-card";
import { colors, radii, spacing } from "@/src/theme";

const TABS = ["Saved", "Liked", "My recipes"] as const;
type Tab = typeof TABS[number];

export default function Cookbook() {
  const insets = useSafeAreaInsets();
  const [tab, setTab] = useState<Tab>("Saved");
  const saved = useQuery({ queryKey: ["saves"], queryFn: () => api.mySaves() });
  const liked = useQuery({ queryKey: ["likes"], queryFn: () => api.myLikes() });
  const mine = useQuery({ queryKey: ["mine"], queryFn: () => api.myRecipes() });

  const data = tab === "Saved" ? saved.data : tab === "Liked" ? liked.data : mine.data;
  const loading = tab === "Saved" ? saved.isLoading : tab === "Liked" ? liked.isLoading : mine.isLoading;

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl }]}>
        <Text style={styles.h1}>My Cookbook</Text>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingVertical: spacing.md }} style={{ maxHeight: 56 }}>
          {TABS.map(t => {
            const active = t === tab;
            return (
              <Pressable key={t} testID={`cookbook-tab-${t}`} onPress={() => setTab(t)}
                style={[styles.chip, { flexShrink: 0, backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border }]}
              >
                <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>{t}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>
      {loading ? (
        <View style={{ padding: 32, alignItems: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (data || []).length === 0 ? (
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: colors.onSurface, fontSize: 20, fontWeight: "700" }}>Your cookbook is waiting.</Text>
          <Text style={{ color: colors.muted, marginTop: 6 }}>
            {tab === "My recipes" ? "Create your first recipe to start your collection." : `You haven't ${tab.toLowerCase()} any recipes yet.`}
          </Text>
        </View>
      ) : (
        <FlatList
          data={data as Recipe[]}
          numColumns={2}
          keyExtractor={r => r.id}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120, gap: spacing.md }}
          columnWrapperStyle={{ gap: spacing.md }}
          renderItem={({ item }) => <View style={{ flex: 1 }}><RecipeCard recipe={item} size="sm" /></View>}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  h1: { fontSize: 28, color: colors.onSurface, fontWeight: "700" },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
