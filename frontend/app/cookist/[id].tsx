import { useEffect, useMemo, useRef, useState } from "react";
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from "react-native";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useQuery } from "@tanstack/react-query";
import MDIcon from "@react-native-vector-icons/material-design-icons";
import * as Haptics from "expo-haptics";
import { api } from "@/src/api/client";
import { colors, radii, spacing } from "@/src/theme";

export default function CookistMode() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { data: r, isLoading } = useQuery({ queryKey: ["recipe", id], queryFn: () => api.getRecipe(id!), enabled: !!id });

  const [step, setStep] = useState(0);
  const [timerSec, setTimerSec] = useState(0);
  const [running, setRunning] = useState(false);
  const [ask, setAsk] = useState("");
  const [asking, setAsking] = useState(false);
  const [answer, setAnswer] = useState<string | null>(null);
  const timerRef = useRef<any>(null);

  useEffect(() => {
    if (running && timerSec > 0) {
      timerRef.current = setInterval(() => setTimerSec(s => {
        if (s <= 1) {
          clearInterval(timerRef.current);
          setRunning(false);
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success).catch(() => {});
          setAnswer("⏰ Timer done! Come back to the kitchen.");
          return 0;
        }
        return s - 1;
      }), 1000);
    }
    return () => timerRef.current && clearInterval(timerRef.current);
  }, [running, timerSec]);

  const total = r?.instructions.length ?? 0;
  const current = r?.instructions[step] ?? "";

  const goNext = () => { Haptics.selectionAsync().catch(() => {}); if (step < total - 1) setStep(step + 1); else finish(); };
  const goPrev = () => { Haptics.selectionAsync().catch(() => {}); if (step > 0) setStep(step - 1); };
  const finish = async () => { await api.recordHistory(id!, "completed"); router.back(); };
  const start5 = () => { setTimerSec(5 * 60); setRunning(true); };
  const askOwami = async () => {
    if (!ask.trim()) return;
    setAsking(true); setAnswer(null);
    try {
      const q = ask.trim();
      // parse timer intent locally as fallback
      const m = q.toLowerCase().match(/(\d+)\s*(minute|min|m)/);
      if (/timer|set/i.test(q) && m) {
        const mins = parseInt(m[1]);
        setTimerSec(mins * 60); setRunning(true); setAnswer(`Timer set for ${mins} minutes. I'll ping you.`);
      } else if (/next/i.test(q)) { goNext(); setAnswer("Moving to the next step."); }
      else if (/(previous|back)/i.test(q)) { goPrev(); setAnswer("Back one step."); }
      else if (/repeat|say that again/i.test(q)) { setAnswer(current); }
      else {
        const res = await api.ask(q, id, step);
        setAnswer(res.answer);
      }
      setAsk("");
    } catch (e) {
      setAnswer("I didn't catch that. Try again.");
    } finally { setAsking(false); }
  };

  const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;

  if (isLoading || !r) return <View style={styles.loader}><ActivityIndicator color={colors.brandSecondary} /></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surfaceInverse }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <ScrollView contentContainerStyle={[styles.wrap, { paddingTop: insets.top + spacing.md, paddingBottom: insets.bottom + spacing.xxxl }]}>
        <View style={styles.top}>
          <Pressable testID="cookist-exit" onPress={() => router.back()} hitSlop={16}><MDIcon name="close" size={26} color={colors.onSurfaceInverse} /></Pressable>
          <View style={styles.listenPill}><View style={styles.listenDot} /><Text style={styles.listenT}>Cookist mode</Text></View>
          <View style={{ width: 26 }} />
        </View>

        <Text style={styles.recipeName}>{r.title}</Text>
        <Text style={styles.stepMeta}>Step {step + 1} of {total}</Text>

        <Text testID="cookist-step-text" style={styles.stepBig}>{current}</Text>

        {timerSec > 0 && (
          <View style={styles.timerCard}>
            <MDIcon name="timer-outline" size={22} color={colors.brandSecondary} />
            <Text style={styles.timerT}>{fmt(timerSec)}</Text>
            <Pressable testID="cookist-timer-toggle" onPress={() => setRunning(!running)}>
              <MDIcon name={running ? "pause" : "play"} size={26} color={colors.onSurfaceInverse} />
            </Pressable>
            <Pressable testID="cookist-timer-clear" onPress={() => { setTimerSec(0); setRunning(false); }}>
              <MDIcon name="close-circle" size={22} color={colors.onSurfaceInverse} />
            </Pressable>
          </View>
        )}

        <View style={styles.controls}>
          <Ctrl testID="cookist-prev" icon="skip-previous" label="Back" onPress={goPrev} disabled={step === 0} />
          <Ctrl testID="cookist-repeat" icon="refresh" label="Repeat" onPress={() => setAnswer(current)} />
          <CtrlPrimary testID="cookist-next" icon={step === total - 1 ? "check-bold" : "skip-next"} label={step === total - 1 ? "Done" : "Next"} onPress={goNext} />
        </View>

        <Pressable testID="cookist-timer-5" onPress={start5} style={styles.smallBtn}>
          <MDIcon name="timer-plus-outline" size={18} color={colors.onSurfaceInverse} />
          <Text style={styles.smallBtnT}>Set 5 min timer</Text>
        </Pressable>

        <View style={styles.askWrap}>
          <Text style={styles.askKicker}>Ask Owami</Text>
          <View style={styles.askRow}>
            <TextInput
              testID="cookist-ask-input"
              placeholder="How much salt? Set timer for 8 min…"
              placeholderTextColor="#CDBCA7"
              value={ask}
              onChangeText={setAsk}
              onSubmitEditing={askOwami}
              style={styles.askInput}
            />
            <Pressable testID="cookist-ask-submit" onPress={askOwami} style={styles.askSend} disabled={asking}>
              {asking ? <ActivityIndicator color={colors.onBrandPrimary} /> : <MDIcon name="send" size={20} color={colors.onBrandPrimary} />}
            </Pressable>
          </View>
          {answer && (
            <View style={styles.answerBox}>
              <MDIcon name="chef-hat" size={16} color={colors.brandSecondary} />
              <Text testID="cookist-answer-text" style={styles.answerT}>{answer}</Text>
            </View>
          )}
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
function Ctrl({ icon, label, onPress, disabled, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} disabled={disabled} style={[styles.ctrl, disabled && { opacity: 0.4 }]}>
      <MDIcon name={icon} size={28} color={colors.onSurfaceInverse} />
      <Text style={styles.ctrlT}>{label}</Text>
    </Pressable>
  );
}
function CtrlPrimary({ icon, label, onPress, testID }: any) {
  return (
    <Pressable testID={testID} onPress={onPress} style={styles.ctrlPrimary}>
      <MDIcon name={icon} size={32} color={colors.onBrandPrimary} />
      <Text style={[styles.ctrlT, { color: colors.onBrandPrimary }]}>{label}</Text>
    </Pressable>
  );
}
const styles = StyleSheet.create({
  wrap: { paddingHorizontal: spacing.xl },
  loader: { flex: 1, backgroundColor: colors.surfaceInverse, alignItems: "center", justifyContent: "center" },
  top: { flexDirection: "row", justifyContent: "space-between", alignItems: "center", marginBottom: spacing.xl },
  listenPill: { flexDirection: "row", alignItems: "center", gap: 6, backgroundColor: "rgba(222,143,66,0.15)", paddingHorizontal: 12, paddingVertical: 6, borderRadius: radii.pill },
  listenDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.brandSecondary },
  listenT: { color: colors.brandSecondary, fontWeight: "700", fontSize: 12, letterSpacing: 1 },
  recipeName: { color: colors.brandSecondary, fontSize: 14, fontWeight: "600", letterSpacing: 0.5 },
  stepMeta: { color: "#CDBCA7", fontSize: 13, marginTop: 4, marginBottom: spacing.md },
  stepBig: { color: colors.onSurfaceInverse, fontSize: 34, fontWeight: "600", lineHeight: 42, marginTop: spacing.md, marginBottom: spacing.xl },
  timerCard: { flexDirection: "row", alignItems: "center", gap: spacing.md, backgroundColor: "rgba(253,251,247,0.06)", padding: spacing.md, borderRadius: radii.md, marginBottom: spacing.xl },
  timerT: { flex: 1, color: colors.onSurfaceInverse, fontSize: 24, fontWeight: "700" },
  controls: { flexDirection: "row", gap: spacing.md, marginBottom: spacing.md },
  ctrl: { flex: 1, minHeight: 80, backgroundColor: "rgba(253,251,247,0.06)", borderRadius: radii.lg, alignItems: "center", justifyContent: "center", gap: 4 },
  ctrlPrimary: { flex: 1.4, minHeight: 80, backgroundColor: colors.brandPrimary, borderRadius: radii.lg, alignItems: "center", justifyContent: "center", gap: 4 },
  ctrlT: { color: colors.onSurfaceInverse, fontWeight: "700", fontSize: 13 },
  smallBtn: { flexDirection: "row", alignSelf: "flex-start", alignItems: "center", gap: 8, paddingHorizontal: 14, paddingVertical: 10, borderRadius: radii.pill, borderWidth: 1, borderColor: "rgba(253,251,247,0.2)", marginBottom: spacing.xl },
  smallBtnT: { color: colors.onSurfaceInverse, fontWeight: "600", fontSize: 13 },
  askWrap: { backgroundColor: "rgba(253,251,247,0.06)", borderRadius: radii.lg, padding: spacing.md, gap: spacing.sm },
  askKicker: { color: colors.brandSecondary, fontSize: 11, fontWeight: "700", letterSpacing: 1 },
  askRow: { flexDirection: "row", gap: 8, alignItems: "center" },
  askInput: { flex: 1, backgroundColor: "rgba(253,251,247,0.05)", color: colors.onSurfaceInverse, padding: 14, borderRadius: radii.md, fontSize: 15 },
  askSend: { width: 46, height: 46, borderRadius: 23, backgroundColor: colors.brandPrimary, alignItems: "center", justifyContent: "center" },
  answerBox: { flexDirection: "row", gap: 8, backgroundColor: "rgba(222,143,66,0.1)", padding: spacing.md, borderRadius: radii.md },
  answerT: { flex: 1, color: colors.onSurfaceInverse, fontSize: 15, lineHeight: 22 },
});
