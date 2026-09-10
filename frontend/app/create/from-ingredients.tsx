import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/hooks/useAuth";
import { useSubscription } from "@/src/lib/revenuecat";
import { colors, radii, spacing } from "@/src/theme";

const SUGGESTED = ["Chicken", "Rice", "Onion", "Garlic", "Tomato", "Egg", "Pasta", "Mushroom", "Spinach", "Ginger"];

export default function FromIngredients() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user, refresh } = useAuth();
  const { isSubscribed } = useSubscription();
  const [items, setItems] = useState<string[]>([]);
  const [inp, setInp] = useState("");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [result, setResult] = useState<any>(null);

  const add = (v: string) => { const s = v.trim(); if (!s) return; if (items.includes(s)) return; setItems([...items, s]); setInp(""); };
  const remove = (v: string) => setItems(items.filter(i => i !== v));

  const generate = async () => {
    if (!isSubscribed && !user?.is_premium) { router.push("/paywall"); return; }
    if (items.length === 0) { setErr("Add a few ingredients first."); return; }
    setBusy(true); setErr(null); setResult(null);
    try { const r = await api.fromIngredients(items); setResult(r); }
    catch (e: any) { setErr("Owami couldn't cook that up right now. Please try again."); }
    finally { setBusy(false); }
  };
  const save = async () => {
    if (!result) return;
    setBusy(true); setErr(null);
    try {
      const r = await api.saveGenerated({ ...result, image_url: result.image_url || "https://images.unsplash.com/photo-1766596737206-214abffe65bf?w=800&q=80" });
      router.replace(`/recipe/${r.id}`);
    } catch (e: any) {
      setErr("We couldn't save that recipe. Try again.");
    } finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + spacing.md, paddingBottom: 140 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={16}><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.h1}>What's in{"\n"}your kitchen?</Text>
        <Text style={styles.sub}>Tell me your ingredients. I'll suggest something delicious.</Text>

        <View style={styles.inputRow}>
          <TextInput testID="ai-ing-input" style={styles.in} value={inp} onChangeText={setInp}
            onSubmitEditing={() => add(inp)} placeholder="e.g. Chicken" placeholderTextColor={colors.muted} />
          <Pressable testID="ai-ing-add" onPress={() => add(inp)} style={styles.addBtn}><MDIcon name="plus" size={22} color={colors.onBrandPrimary} /></Pressable>
        </View>

        <View style={styles.chips}>
          {items.map(i => (
            <Pressable key={i} testID={`ai-chip-${i}`} onPress={() => remove(i)} style={styles.chipActive}>
              <Text style={styles.chipActiveT}>{i}</Text>
              <MDIcon name="close" size={14} color={colors.onBrandPrimary} />
            </Pressable>
          ))}
        </View>

        <Text style={styles.suggested}>Common ingredients</Text>
        <View style={styles.chips}>
          {SUGGESTED.filter(s => !items.includes(s)).map(i => (
            <Pressable key={i} testID={`ai-sug-${i}`} onPress={() => add(i)} style={styles.chip}>
              <Text style={styles.chipT}>{i}</Text>
            </Pressable>
          ))}
        </View>

        {err && <Text style={{ color: colors.error, marginTop: spacing.md }}>{err}</Text>}

        {result && (
          <View style={styles.result}>
            <Text style={styles.resTitle}>{result.title}</Text>
            <Text style={styles.resDesc}>{result.description}</Text>
            <Text style={styles.resSub}>Ingredients</Text>
            {(result.ingredients || []).map((i: any, x: number) => (
              <Text key={x} style={styles.resLine}>• {i.name} {i.quantity} {i.unit}</Text>
            ))}
            {(result.missing_ingredients || []).length > 0 && (
              <>
                <Text style={styles.resSub}>Missing</Text>
                {result.missing_ingredients.map((m: string, x: number) => (
                  <Text key={x} style={[styles.resLine, { color: colors.warning }]}>• {m}</Text>
                ))}
              </>
            )}
            <Text style={styles.resSub}>Steps</Text>
            {(result.instructions || []).map((s: string, x: number) => (
              <Text key={x} style={styles.resLine}>{x + 1}. {s}</Text>
            ))}
            <Pressable testID="ai-save-button" onPress={save} style={styles.cta}><Text style={styles.ctaT}>Save to cookbook</Text></Pressable>
          </View>
        )}

        <Pressable testID="ai-generate" onPress={generate} style={[styles.cta, { opacity: busy ? 0.6 : 1 }]} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaT}>{(isSubscribed || user?.is_premium) ? "Cook something up" : "Unlock with Owami+"}</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  wrap: { padding: spacing.xl },
  back: { color: colors.muted, marginBottom: spacing.md },
  h1: { fontSize: 32, color: colors.onSurface, fontWeight: "700", lineHeight: 36 },
  sub: { color: colors.muted, marginTop: 6, marginBottom: spacing.xl },
  inputRow: { flexDirection: "row", gap: 8, alignItems: "center", marginBottom: spacing.md },
  in: { flex: 1, backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border, color: colors.onSurface },
  addBtn: { width: 48, height: 48, borderRadius: radii.md, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 8, marginBottom: spacing.md },
  chip: { paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipT: { color: colors.onSurface, fontWeight: "500", fontSize: 13 },
  chipActive: { flexDirection: "row", gap: 6, alignItems: "center", paddingHorizontal: 12, paddingVertical: 8, borderRadius: radii.pill, backgroundColor: colors.brandPrimary },
  chipActiveT: { color: colors.onBrandPrimary, fontWeight: "600", fontSize: 13 },
  suggested: { color: colors.muted, fontWeight: "600", marginTop: spacing.md, marginBottom: 8, fontSize: 13 },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brandPrimary, padding: 18, borderRadius: radii.lg, alignItems: "center" },
  ctaT: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
  result: { marginTop: spacing.xl, padding: spacing.lg, backgroundColor: colors.surfaceSecondary, borderRadius: radii.lg, borderWidth: 1, borderColor: colors.border },
  resTitle: { color: colors.onSurface, fontSize: 22, fontWeight: "700" },
  resDesc: { color: colors.muted, marginTop: 4, marginBottom: spacing.md },
  resSub: { color: colors.brandPrimary, fontWeight: "700", marginTop: spacing.md, marginBottom: 4, fontSize: 13, letterSpacing: 0.5, textTransform: "uppercase" },
  resLine: { color: colors.onSurface, marginBottom: 4, fontSize: 14 },
});
