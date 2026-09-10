import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/hooks/useAuth";
import { colors, radii, spacing } from "@/src/theme";

const DIETS = ["No restrictions", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Gluten-free", "Dairy-free"];
const FAVES = ["Chicken", "Beef", "Pasta", "Rice", "Eggs", "Fish", "Cheese", "Chocolate", "Mushroom", "Tomato", "Garlic", "Ginger"];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [diet, setDiet] = useState<string[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [dislikes, setDislikes] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (arr: string[], setter: any, v: string) =>
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const finish = async () => {
    setBusy(true);
    try {
      await api.setPrefs({
        diet, liked_ingredients: favs,
        disliked: dislikes.split(",").map(s => s.trim()).filter(Boolean),
        onboarded: true,
      });
      await refresh();
      router.replace("/(tabs)/home");
    } finally { setBusy(false); }
  };
  const skip = async () => { await api.setPrefs({ diet: [], liked_ingredients: [], disliked: [], onboarded: true }); await refresh(); router.replace("/(tabs)/home"); };

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          {[0, 1, 2].map(i => <View key={i} style={[styles.bar, { backgroundColor: i <= step ? colors.brandPrimary : colors.surfaceTertiary }]} />)}
        </View>
        <Pressable testID="onb-skip" onPress={skip} hitSlop={12} style={{ alignSelf: "flex-end", padding: 6 }}>
          <Text style={{ color: colors.muted, fontWeight: "600" }}>Skip</Text>
        </Pressable>

        {step === 0 && (
          <View>
            <Text style={styles.kicker}>Question 1 of 3</Text>
            <Text style={styles.h}>How do you like to eat?</Text>
            <Text style={styles.sub}>Pick any that apply — I'll tune your recipes.</Text>
            <View style={styles.chips}>
              {DIETS.map(d => {
                const active = diet.includes(d);
                return (
                  <Pressable key={d} testID={`onb-diet-${d}`} onPress={() => toggle(diet, setDiet, d)}
                    style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipT, active && styles.chipTA]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        {step === 1 && (
          <View>
            <Text style={styles.kicker}>Question 2 of 3</Text>
            <Text style={styles.h}>What do you love cooking with?</Text>
            <Text style={styles.sub}>Your favourite ingredients steer recommendations.</Text>
            <View style={styles.chips}>
              {FAVES.map(d => {
                const active = favs.includes(d);
                return (
                  <Pressable key={d} testID={`onb-fav-${d}`} onPress={() => toggle(favs, setFavs, d)}
                    style={[styles.chip, active && styles.chipActive]}>
                    <Text style={[styles.chipT, active && styles.chipTA]}>{d}</Text>
                  </Pressable>
                );
              })}
            </View>
          </View>
        )}
        {step === 2 && (
          <View>
            <Text style={styles.kicker}>Question 3 of 3</Text>
            <Text style={styles.h}>Anything you'd rather{"\n"}not see?</Text>
            <Text style={styles.sub}>Allergies or ingredients to avoid, comma separated.</Text>
            <TextInput testID="onb-dislikes" style={styles.input} value={dislikes} onChangeText={setDislikes}
              placeholder="e.g. peanuts, cilantro" placeholderTextColor={colors.muted} />
          </View>
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {step > 0 && (
          <Pressable testID="onb-back" onPress={() => setStep(step - 1)} style={[styles.btn, styles.btnGhost]}>
            <MDIcon name="arrow-left" size={20} color={colors.onSurface} />
            <Text style={{ color: colors.onSurface, fontWeight: "600" }}>Back</Text>
          </Pressable>
        )}
        <Pressable testID="onb-next" onPress={() => step < 2 ? setStep(step + 1) : finish()} disabled={busy} style={[styles.btn, styles.btnPrimary, { opacity: busy ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
            <>
              <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>{step === 2 ? "Start cooking" : "Continue"}</Text>
              <MDIcon name="arrow-right" size={20} color={colors.onBrandPrimary} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}
const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingBottom: 140 },
  progress: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  kicker: { color: colors.brandPrimary, fontWeight: "700", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase", marginTop: spacing.md },
  h: { fontSize: 30, color: colors.onSurface, fontWeight: "700", lineHeight: 34, marginTop: 6 },
  sub: { color: colors.muted, marginTop: 6, marginBottom: spacing.xl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipT: { color: colors.onSurface, fontWeight: "500" },
  chipTA: { color: colors.onBrandPrimary, fontWeight: "700" },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: 15, marginTop: 8 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  btn: { flex: 1, flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: radii.lg },
  btnPrimary: { backgroundColor: colors.brandPrimary },
  btnGhost: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flex: 0.5 },
});
