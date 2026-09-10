import { useMemo, useState } from "react";
import { ActivityIndicator, FlatList, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api } from "@/src/api/client";
import { RecipeCard } from "@/src/components/recipe-card";
import { colors, radii, spacing } from "@/src/theme";

export default function Discover() {
  const insets = useSafeAreaInsets();
  const [q, setQ] = useState("");
  const [cat, setCat] = useState("All");
  const cats = useQuery({ queryKey: ["cats"], queryFn: () => api.categories() });
  const list = useQuery({ queryKey: ["recipes", q, cat], queryFn: () => api.listRecipes(q, cat) });

  const rows = useMemo(() => {
    const r = list.data || [];
    const pairs: any[] = [];
    for (let i = 0; i < r.length; i += 2) pairs.push([r[i], r[i + 1]]);
    return pairs;
  }, [list.data]);

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <View style={[styles.header, { paddingTop: insets.top + spacing.md }]}>
        <Text style={styles.h1}>Discover</Text>
        <View style={styles.searchWrap}>
          <MDIcon name="magnify" size={20} color={colors.muted} />
          <TextInput
            testID="discover-search-input"
            placeholder="Search recipes, ingredients…"
            placeholderTextColor={colors.muted}
            value={q}
            onChangeText={setQ}
            style={styles.search}
          />
        </View>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: spacing.sm, paddingHorizontal: spacing.xl, paddingVertical: spacing.md }} style={{ maxHeight: 56 }}>
          {(cats.data || []).map(c => {
            const active = c === cat;
            return (
              <Pressable
                key={c}
                testID={`discover-chip-${c}`}
                onPress={() => setCat(c)}
                style={[styles.chip, { flexShrink: 0, backgroundColor: active ? colors.brandPrimary : colors.surfaceSecondary, borderColor: active ? colors.brandPrimary : colors.border }]}
              >
                <Text style={{ color: active ? colors.onBrandPrimary : colors.onSurface, fontWeight: "600", fontSize: 13 }}>{c}</Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {list.isLoading ? (
        <View style={{ padding: 32, alignItems: "center" }}><ActivityIndicator color={colors.brandPrimary} /></View>
      ) : (list.data || []).length === 0 ? (
        <View style={{ padding: spacing.xl }}>
          <Text style={{ color: colors.onSurface, fontSize: 18, fontWeight: "600" }}>No recipes found.</Text>
          <Text style={{ color: colors.muted, marginTop: 4 }}>Try another ingredient or category.</Text>
        </View>
      ) : (
        <FlatList
          data={rows}
          keyExtractor={(_, i) => String(i)}
          contentContainerStyle={{ paddingHorizontal: spacing.xl, paddingBottom: 120, gap: spacing.md }}
          renderItem={({ item }) => (
            <View style={{ flexDirection: "row", gap: spacing.md }}>
              {item.filter(Boolean).map((r: any) => (
                <View key={r.id} style={{ flex: 1 }}><RecipeCard recipe={r} size="sm" /></View>
              ))}
              {item.length < 2 || !item[1] ? <View style={{ flex: 1 }} /> : null}
            </View>
          )}
        />
      )}
    </View>
  );
}
const styles = StyleSheet.create({
  header: { backgroundColor: colors.surface },
  h1: { fontSize: 28, color: colors.onSurface, fontWeight: "700", paddingHorizontal: spacing.xl, marginBottom: spacing.md },
  searchWrap: { flexDirection: "row", alignItems: "center", gap: 8, backgroundColor: colors.surfaceSecondary, marginHorizontal: spacing.xl, paddingHorizontal: 14, borderRadius: radii.md, borderWidth: 1, borderColor: colors.border },
  search: { flex: 1, paddingVertical: 12, color: colors.onSurface, fontSize: 15 },
  chip: { height: 36, paddingHorizontal: 14, borderRadius: radii.pill, alignItems: "center", justifyContent: "center", borderWidth: 1 },
});
