import { useState } from "react";
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import { api } from "@/src/api/client";
import { useAuth } from "@/src/hooks/useAuth";
import { colors, radii, spacing } from "@/src/theme";

const DIETS = ["No restrictions", "Vegetarian", "Vegan", "Pescatarian", "Halal", "Kosher", "Gluten-free", "Dairy-free", "Low-carb"];
const CUISINES = ["Italian", "Indian", "Chinese", "Mexican", "Thai", "Japanese", "Mediterranean", "African", "French", "American", "Korean", "Middle Eastern"];
const FAVES = ["Chicken", "Beef", "Fish", "Pork", "Pasta", "Rice", "Eggs", "Cheese", "Chocolate", "Mushroom", "Tomato", "Garlic", "Ginger", "Chilli", "Herbs"];
const SKILLS = [
  { key: "beginner", title: "Just starting out", sub: "I want simple, forgiving recipes.", icon: "seed-outline" },
  { key: "intermediate", title: "I cook a few times a week", sub: "Give me variety and technique.", icon: "silverware-fork-knife" },
  { key: "advanced", title: "I'm a keen cook", sub: "Bring on the challenge.", icon: "chef-hat" },
];

type Step = { key: string; kicker: string; title: string; sub: string; };
const STEPS: Step[] = [
  { key: "diet", kicker: "Step 1 of 5", title: "How do you like to eat?", sub: "Pick any that fit — I'll tune your recipes." },
  { key: "cuisines", kicker: "Step 2 of 5", title: "Which cuisines make you happy?", sub: "Choose your favourites; I'll surface more of these." },
  { key: "faves", kicker: "Step 3 of 5", title: "What do you love cooking with?", sub: "Your favourite ingredients steer recommendations." },
  { key: "skill", kicker: "Step 4 of 5", title: "How would you describe your cooking?", sub: "So I can pitch the right recipes." },
  { key: "dislikes", kicker: "Step 5 of 5", title: "Anything you'd rather not see?", sub: "Allergies or ingredients to avoid — comma separated." },
];

export default function Onboarding() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { refresh } = useAuth();
  const [step, setStep] = useState(0);
  const [diet, setDiet] = useState<string[]>([]);
  const [cuisines, setCuisines] = useState<string[]>([]);
  const [favs, setFavs] = useState<string[]>([]);
  const [skill, setSkill] = useState<string | null>(null);
  const [dislikes, setDislikes] = useState("");
  const [busy, setBusy] = useState(false);

  const toggle = (arr: string[], setter: any, v: string) =>
    setter(arr.includes(v) ? arr.filter(x => x !== v) : [...arr, v]);

  const persist = async (payload: any) => {
    setBusy(true);
    try {
      await api.setPrefs({
        diet, cuisines, liked_ingredients: favs,
        disliked: dislikes.split(",").map(s => s.trim()).filter(Boolean),
        skill_level: skill || undefined,
        onboarded: true, ...payload,
      });
      await refresh();
      router.replace("/(tabs)/home");
    } finally { setBusy(false); }
  };
  const skipAll = () => persist({ diet: [], cuisines: [], liked_ingredients: [], disliked: [], skill_level: undefined });
  const skipStep = () => step < STEPS.length - 1 ? setStep(step + 1) : persist({});
  const cont = () => step < STEPS.length - 1 ? setStep(step + 1) : persist({});

  const s = STEPS[step];

  return (
    <View style={{ flex: 1, backgroundColor: colors.surface }}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + spacing.xl }]} keyboardShouldPersistTaps="handled">
        <View style={styles.progress}>
          {STEPS.map((_, i) => <View key={i} style={[styles.bar, { backgroundColor: i <= step ? colors.brandPrimary : colors.surfaceTertiary }]} />)}
        </View>
        <View style={styles.headerRow}>
          <Text style={styles.kicker}>{s.kicker}</Text>
          <Pressable testID="onb-skip-all" onPress={skipAll} hitSlop={12}>
            <Text style={styles.skipAll}>Skip all</Text>
          </Pressable>
        </View>
        <Text style={styles.h}>{s.title}</Text>
        <Text style={styles.sub}>{s.sub}</Text>

        {s.key === "diet" && (
          <View style={styles.chips}>
            {DIETS.map(v => <Chip key={v} testID={`onb-diet-${v}`} value={v} active={diet.includes(v)} onPress={() => toggle(diet, setDiet, v)} />)}
          </View>
        )}
        {s.key === "cuisines" && (
          <View style={styles.chips}>
            {CUISINES.map(v => <Chip key={v} testID={`onb-cuisine-${v}`} value={v} active={cuisines.includes(v)} onPress={() => toggle(cuisines, setCuisines, v)} />)}
          </View>
        )}
        {s.key === "faves" && (
          <View style={styles.chips}>
            {FAVES.map(v => <Chip key={v} testID={`onb-fav-${v}`} value={v} active={favs.includes(v)} onPress={() => toggle(favs, setFavs, v)} />)}
          </View>
        )}
        {s.key === "skill" && (
          <View style={{ gap: 10 }}>
            {SKILLS.map(k => {
              const active = skill === k.key;
              return (
                <Pressable key={k.key} testID={`onb-skill-${k.key}`} onPress={() => setSkill(active ? null : k.key)}
                  style={[styles.skillRow, active && { borderColor: colors.brandPrimary, backgroundColor: "rgba(192,74,44,0.06)" }]}>
                  <View style={[styles.skillIcon, active && { backgroundColor: colors.brandPrimary }]}>
                    <MDIcon name={k.icon as any} size={22} color={active ? colors.onBrandPrimary : colors.brandPrimary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.skillT}>{k.title}</Text>
                    <Text style={styles.skillS}>{k.sub}</Text>
                  </View>
                  {active && <MDIcon name="check-circle" size={22} color={colors.brandPrimary} />}
                </Pressable>
              );
            })}
          </View>
        )}
        {s.key === "dislikes" && (
          <TextInput testID="onb-dislikes" style={styles.input} value={dislikes} onChangeText={setDislikes}
            placeholder="e.g. peanuts, cilantro, shellfish" placeholderTextColor={colors.muted} />
        )}
      </ScrollView>

      <View style={[styles.footer, { paddingBottom: insets.bottom + spacing.md }]}>
        {step > 0 ? (
          <Pressable testID="onb-back" onPress={() => setStep(step - 1)} style={[styles.btn, styles.btnGhost]}>
            <MDIcon name="arrow-left" size={20} color={colors.onSurface} />
            <Text style={{ color: colors.onSurface, fontWeight: "600" }}>Back</Text>
          </Pressable>
        ) : (
          <Pressable testID="onb-skip-step" onPress={skipStep} style={[styles.btn, styles.btnGhost]}>
            <Text style={{ color: colors.onSurface, fontWeight: "600" }}>Skip</Text>
          </Pressable>
        )}
        <Pressable testID="onb-next" onPress={cont} disabled={busy} style={[styles.btn, styles.btnPrimary, { opacity: busy ? 0.6 : 1 }]}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : (
            <>
              <Text style={{ color: colors.onBrandPrimary, fontWeight: "700" }}>{step === STEPS.length - 1 ? "Start cooking" : "Continue"}</Text>
              <MDIcon name="arrow-right" size={20} color={colors.onBrandPrimary} />
            </>
          )}
        </Pressable>
      </View>
    </View>
  );
}

function Chip({ value, active, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={[styles.chip, active && styles.chipActive]}>
      {active && <MDIcon name="check" size={14} color={colors.onBrandPrimary} />}
      <Text style={[styles.chipT, active && styles.chipTA]}>{value}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  wrap: { padding: spacing.xl, paddingBottom: 140 },
  progress: { flexDirection: "row", gap: 6, marginBottom: spacing.md },
  bar: { flex: 1, height: 4, borderRadius: 2 },
  headerRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginTop: spacing.md },
  kicker: { color: colors.brandPrimary, fontWeight: "700", fontSize: 11, letterSpacing: 1.5, textTransform: "uppercase" },
  skipAll: { color: colors.muted, fontWeight: "600" },
  h: { fontSize: 30, color: colors.onSurface, fontWeight: "700", lineHeight: 34, marginTop: 6 },
  sub: { color: colors.muted, marginTop: 6, marginBottom: spacing.xl },
  chips: { flexDirection: "row", flexWrap: "wrap", gap: 10 },
  chip: { flexDirection: "row", alignItems: "center", gap: 6, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
  chipActive: { backgroundColor: colors.brandPrimary, borderColor: colors.brandPrimary },
  chipT: { color: colors.onSurface, fontWeight: "500" },
  chipTA: { color: colors.onBrandPrimary, fontWeight: "700" },
  skillRow: { flexDirection: "row", alignItems: "center", gap: 12, padding: spacing.md, borderRadius: radii.lg, borderWidth: 1.5, borderColor: colors.border, backgroundColor: colors.surface },
  skillIcon: { width: 44, height: 44, borderRadius: 22, alignItems: "center", justifyContent: "center", backgroundColor: colors.surfaceSecondary },
  skillT: { color: colors.onSurface, fontSize: 15, fontWeight: "700" },
  skillS: { color: colors.muted, fontSize: 12, marginTop: 2 },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: 14, borderWidth: 1, borderColor: colors.border, color: colors.onSurface, fontSize: 15, marginTop: 8 },
  footer: { position: "absolute", left: 0, right: 0, bottom: 0, flexDirection: "row", gap: 10, padding: spacing.lg, backgroundColor: colors.surface, borderTopWidth: 1, borderTopColor: colors.border },
  btn: { flexDirection: "row", alignItems: "center", justifyContent: "center", gap: 8, padding: 16, borderRadius: radii.lg },
  btnPrimary: { backgroundColor: colors.brandPrimary, flex: 1.4 },
  btnGhost: { backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border, flex: 0.6 },
});
