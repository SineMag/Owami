import { useState } from "react";
import { ActivityIndicator, FlatList, Modal, Pressable, ScrollView, StyleSheet, Text, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Image } from "expo-image";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api, fileUrl, Recipe } from "@/src/api/client";
import { useAuth } from "@/src/hooks/useAuth";
import { colors, radii, spacing } from "@/src/theme";

const SLOTS = ["breakfast", "lunch", "dinner"] as const;

function next7Days() {
  const days: { iso: string; label: string; weekday: string }[] = [];
  const now = new Date();
  for (let i = 0; i < 7; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() + i);
    const iso = d.toISOString().slice(0, 10);
    const weekday = d.toLocaleDateString(undefined, { weekday: "short" });
    const label = i === 0 ? "Today" : i === 1 ? "Tomorrow" : d.toLocaleDateString(undefined, { month: "short", day: "numeric" });
    days.push({ iso, label, weekday });
  }
  return days;
}

export default function MealPlan() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const qc = useQueryClient();
  const days = next7Days();
  const [picker, setPicker] = useState<{ date: string; slot: string } | null>(null);

  const plan = useQuery({ queryKey: ["meal-plan"], queryFn: () => api.mealPlan(), enabled: !!user });
  const allRecipes = useQuery({ queryKey: ["recipes"], queryFn: () => api.listRecipes() });

  const byKey: Record<string, { plan: any; recipe: Recipe }> = {};
  (plan.data || []).forEach(p => { byKey[`${p.plan.date}|${p.plan.slot}`] = p; });

  const assign = async (rid: string) => {
    if (!picker) return;
    try { await api.addMealPlan(picker.date, picker.slot, rid); qc.invalidateQueries({ queryKey: ["meal-plan"] }); }
    catch (e: any) { if (String(e?.message).includes("402")) router.push("/paywall"); }
    setPicker(null);
  };
  const remove = async (id: string) => { await api.removeMealPlan(id); qc.invalidateQueries({ queryKey: ["meal-plan"] }); };

  if (!user?.is_premium) {
    return (
      <View style={{ flex: 1, backgroundColor: colors.surface, paddingTop: insets.top + spacing.md, padding: spacing.xl }}>
        <Pressable onPress={() => router.back()} hitSlop={16}><Text style={{ color: colors.muted, marginBottom: spacing.md }}>← Back</Text></Pressable>
        <Text style={styles.h1}>Meal plan</Text>
        <View style={styles.upgradeCard}>
          <MDIcon name="calendar-star" size={40} color={colors.brandPrimary} />
          <Text style={styles.upgradeH}>Plan your week with Owami+</Text>
          <Text style={styles.upgradeS}>Drag meals into any day, shop from one list, and cook stress-free.</Text>
          <Pressable testID="mealplan-upgrade" onPress={() => router.push("/paywall")} style={styles.upgradeBtn}>
            <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>Upgrade to Owami+</Text>
          </Pressable>
        </View>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={{ paddingTop: insets.top + spacing.md, paddingHorizontal: spacing.xl, paddingBottom: 120 }}>
        <Pressable onPress={() => router.back()} hitSlop={16}><Text style={{ color: colors.muted, marginBottom: spacing.md }}>← Back</Text></Pressable>
        <Text style={styles.h1}>Your week</Text>
        <Text style={styles.sub}>7 days · tap a slot to add a recipe.</Text>

        {days.map(d => (
          <View key={d.iso} style={styles.daySection}>
            <View style={styles.dayHead}>
              <View>
                <Text style={styles.dayLabel}>{d.label}</Text>
                <Text style={styles.dayWeek}>{d.weekday}</Text>
              </View>
            </View>
            {SLOTS.map(slot => {
              const item = byKey[`${d.iso}|${slot}`];
              return (
                <View key={slot} style={styles.slotRow}>
                  <View style={styles.slotDot} />
                  <Text style={styles.slotLabel}>{slot[0].toUpperCase() + slot.slice(1)}</Text>
                  {item ? (
                    <View style={styles.slotCard}>
                      <Pressable testID={`mealplan-item-${d.iso}-${slot}`} onPress={() => router.push(`/recipe/${item.recipe.id}`)} style={{ flex: 1, flexDirection: "row", alignItems: "center", gap: 10 }}>
                        <Image source={{ uri: fileUrl(item.recipe.image_url) }} style={styles.slotThumb} contentFit="cover" />
                        <Text style={styles.slotTitle} numberOfLines={1}>{item.recipe.title}</Text>
                      </Pressable>
                      <Pressable
                        testID={`mealplan-cook-${d.iso}-${slot}`}
                        onPress={async () => { await api.recordHistory(item.recipe.id, "started"); router.push(`/cookist/${item.recipe.id}`); }}
                        hitSlop={8}
                        style={styles.cookBtn}
                      >
                        <MDIcon name="chef-hat" size={16} color={colors.onBrandPrimary} />
                        <Text style={styles.cookBtnT}>Cook</Text>
                      </Pressable>
                      <Pressable testID={`mealplan-remove-${d.iso}-${slot}`} onPress={() => remove(item.plan.id)} hitSlop={10} style={{ padding: 4 }}>
                        <MDIcon name="close-circle" size={20} color={colors.muted} />
                      </Pressable>
                    </View>
                  ) : (
                    <Pressable testID={`mealplan-add-${d.iso}-${slot}`} onPress={() => setPicker({ date: d.iso, slot })} style={styles.slotEmpty}>
                      <MDIcon name="plus" size={18} color={colors.brandPrimary} />
                      <Text style={{ color: colors.brandPrimary, fontWeight: "600" }}>Add recipe</Text>
                    </Pressable>
                  )}
                </View>
              );
            })}
          </View>
        ))}
      </ScrollView>

      <Modal visible={!!picker} transparent animationType="slide" onRequestClose={() => setPicker(null)}>
        <Pressable style={styles.backdrop} onPress={() => setPicker(null)} />
        <View style={[styles.sheet, { paddingBottom: insets.bottom + spacing.md }]}>
          <View style={styles.sheetHandle} />
          <Text style={styles.sheetH}>Pick a recipe</Text>
          {allRecipes.isLoading ? <ActivityIndicator color={colors.brandPrimary} /> : (
            <FlatList
              data={allRecipes.data || []}
              keyExtractor={r => r.id}
              contentContainerStyle={{ paddingBottom: spacing.md }}
              renderItem={({ item }) => (
                <Pressable testID={`mealplan-pick-${item.id}`} onPress={() => assign(item.id)} style={styles.pickRow}>
                  <Image source={{ uri: fileUrl(item.image_url) }} style={styles.pickThumb} contentFit="cover" />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.pickT} numberOfLines={1}>{item.title}</Text>
                    <Text style={styles.pickS}>{(item.prep_time || 0) + (item.cook_time || 0)} min · {item.category}</Text>
                  </View>
                  <MDIcon name="chevron-right" size={22} color={colors.muted} />
                </Pressable>
              )}
            />
          )}
        </View>
      </Modal>
    </View>
  );
}
const styles = StyleSheet.create({
  h1: { fontSize: 28, color: colors.onSurface, fontWeight: "700" },
  sub: { color: colors.muted, marginTop: 4, marginBottom: spacing.lg },
  daySection: { marginBottom: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radii.lg, padding: spacing.md, borderWidth: 1, borderColor: colors.border },
  dayHead: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: 6 },
  dayLabel: { fontSize: 18, color: colors.onSurface, fontWeight: "700" },
  dayWeek: { color: colors.muted, fontSize: 12, marginTop: 2 },
  slotRow: { flexDirection: "row", alignItems: "center", gap: 10, marginTop: 8 },
  slotDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: colors.brandPrimary },
  slotLabel: { color: colors.muted, fontSize: 12, fontWeight: "700", textTransform: "uppercase", letterSpacing: 1, width: 70 },
  slotCard: { flex: 1, flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: colors.surface, borderRadius: radii.md, padding: 8, borderWidth: 1, borderColor: colors.border },
  cookBtn: { flexDirection: "row", alignItems: "center", gap: 4, backgroundColor: colors.brandPrimary, paddingHorizontal: 10, paddingVertical: 6, borderRadius: radii.pill },
  cookBtnT: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 11 },
  slotThumb: { width: 40, height: 40, borderRadius: radii.sm, backgroundColor: colors.surfaceTertiary },
  slotTitle: { flex: 1, color: colors.onSurface, fontWeight: "600", fontSize: 14 },
  slotEmpty: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 6, borderStyle: "dashed", borderWidth: 1.5, borderColor: colors.border, borderRadius: radii.md, paddingVertical: 12 },
  upgradeCard: { marginTop: spacing.xl, alignItems: "center", padding: spacing.xl, backgroundColor: colors.surfaceSecondary, borderRadius: radii.lg },
  upgradeH: { color: colors.onSurface, fontSize: 22, fontWeight: "700", marginTop: 10, textAlign: "center" },
  upgradeS: { color: colors.muted, textAlign: "center", marginTop: 6, marginBottom: spacing.lg },
  upgradeBtn: { backgroundColor: colors.brandPrimary, paddingHorizontal: 18, paddingVertical: 12, borderRadius: radii.pill },
  backdrop: { flex: 1, backgroundColor: "rgba(45,30,25,0.55)" },
  sheet: { position: "absolute", left: 0, right: 0, bottom: 0, maxHeight: "70%", backgroundColor: colors.surface, borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: spacing.lg },
  sheetHandle: { alignSelf: "center", width: 40, height: 4, borderRadius: 2, backgroundColor: colors.borderStrong, marginBottom: spacing.md },
  sheetH: { color: colors.onSurface, fontSize: 20, fontWeight: "700", marginBottom: spacing.md },
  pickRow: { flexDirection: "row", alignItems: "center", gap: 10, padding: 10, borderBottomWidth: 1, borderBottomColor: colors.divider },
  pickThumb: { width: 50, height: 50, borderRadius: radii.sm, backgroundColor: colors.surfaceTertiary },
  pickT: { color: colors.onSurface, fontWeight: "600" },
  pickS: { color: colors.muted, fontSize: 12, marginTop: 2 },
});
