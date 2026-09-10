import { useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api } from "@/src/api/client";
import { colors, radii, spacing } from "@/src/theme";

export default function NewRecipe() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [title, setTitle] = useState("");
  const [desc, setDesc] = useState("");
  const [image, setImage] = useState("");
  const [prep, setPrep] = useState("10");
  const [cook, setCook] = useState("20");
  const [servings, setServings] = useState("2");
  const [ings, setIngs] = useState<string[]>([""]);
  const [steps, setSteps] = useState<string[]>([""]);
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const submit = async () => {
    if (!title.trim()) { setErr("Give your recipe a name."); return; }
    setBusy(true); setErr(null);
    try {
      const r = await api.createRecipe({
        title: title.trim(), description: desc, image_url: image,
        prep_time: parseInt(prep) || 0, cook_time: parseInt(cook) || 0, servings: parseInt(servings) || 2,
        difficulty: "Easy", category: "Dinner",
        ingredients: ings.filter(i => i.trim()).map(i => ({ name: i, quantity: "", unit: "" })),
        instructions: steps.filter(s => s.trim()),
        tags: [],
      });
      router.replace(`/recipe/${r.id}`);
    } catch (e: any) { setErr("Couldn't save recipe. Try again."); }
    finally { setBusy(false); }
  };
  const upd = (arr: string[], setter: any) => (i: number, v: string) => { const c = [...arr]; c[i] = v; setter(c); };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + spacing.md, paddingBottom: 140 }]} keyboardShouldPersistTaps="handled">
        <Pressable onPress={() => router.back()} hitSlop={16}><Text style={styles.back}>← Back</Text></Pressable>
        <Text style={styles.h1}>New recipe</Text>

        <L label="Recipe name" />
        <TextInput testID="new-title" style={styles.in} value={title} onChangeText={setTitle} placeholder="Grandma's chicken curry" placeholderTextColor={colors.muted} />
        <L label="Short description" />
        <TextInput testID="new-desc" style={[styles.in, { minHeight: 70 }]} value={desc} onChangeText={setDesc} multiline placeholder="Rich, warming, one-pan wonder…" placeholderTextColor={colors.muted} />
        <L label="Cover image URL (optional)" />
        <TextInput testID="new-image" style={styles.in} value={image} onChangeText={setImage} placeholder="https://…" placeholderTextColor={colors.muted} autoCapitalize="none" />

        <View style={{ flexDirection: "row", gap: spacing.sm }}>
          <View style={{ flex: 1 }}><L label="Prep (min)" /><TextInput testID="new-prep" style={styles.in} keyboardType="number-pad" value={prep} onChangeText={setPrep} /></View>
          <View style={{ flex: 1 }}><L label="Cook (min)" /><TextInput testID="new-cook" style={styles.in} keyboardType="number-pad" value={cook} onChangeText={setCook} /></View>
          <View style={{ flex: 1 }}><L label="Servings" /><TextInput testID="new-servings" style={styles.in} keyboardType="number-pad" value={servings} onChangeText={setServings} /></View>
        </View>

        <L label="Ingredients" />
        {ings.map((v, i) => (
          <TextInput key={i} testID={`new-ing-${i}`} style={styles.in} value={v} onChangeText={t => upd(ings, setIngs)(i, t)} placeholder={`Ingredient ${i + 1}`} placeholderTextColor={colors.muted} />
        ))}
        <Pressable testID="new-add-ing" onPress={() => setIngs([...ings, ""])} style={styles.addRow}><MDIcon name="plus" size={18} color={colors.brandPrimary} /><Text style={styles.addT}>Add ingredient</Text></Pressable>

        <L label="Steps" />
        {steps.map((v, i) => (
          <TextInput key={i} testID={`new-step-${i}`} style={[styles.in, { minHeight: 60 }]} value={v} onChangeText={t => upd(steps, setSteps)(i, t)} multiline placeholder={`Step ${i + 1}`} placeholderTextColor={colors.muted} />
        ))}
        <Pressable testID="new-add-step" onPress={() => setSteps([...steps, ""])} style={styles.addRow}><MDIcon name="plus" size={18} color={colors.brandPrimary} /><Text style={styles.addT}>Add step</Text></Pressable>

        {err && <Text style={{ color: colors.error, marginTop: 8 }}>{err}</Text>}
        <Pressable testID="new-submit" style={[styles.cta, busy && { opacity: 0.6 }]} onPress={submit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaT}>Save to my cookbook</Text>}
        </Pressable>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function L({ label }: { label: string }) { return <Text style={styles.label}>{label}</Text>; }
const styles = StyleSheet.create({
  wrap: { padding: spacing.xl },
  back: { color: colors.muted, marginBottom: spacing.md },
  h1: { fontSize: 28, color: colors.onSurface, fontWeight: "700", marginBottom: spacing.md },
  label: { color: colors.onSurface, fontWeight: "600", marginTop: spacing.md, marginBottom: 6 },
  in: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: 14, color: colors.onSurface, borderWidth: 1, borderColor: colors.border, marginBottom: 8 },
  addRow: { flexDirection: "row", alignItems: "center", gap: 6, paddingVertical: 8 },
  addT: { color: colors.brandPrimary, fontWeight: "600" },
  cta: { marginTop: spacing.xl, backgroundColor: colors.brandPrimary, padding: 18, borderRadius: radii.lg, alignItems: "center" },
  ctaT: { color: colors.onBrandPrimary, fontWeight: "700", fontSize: 16 },
});
