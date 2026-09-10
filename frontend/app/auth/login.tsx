import { useState } from "react";
import { View, Text, TextInput, Pressable, StyleSheet, KeyboardAvoidingView, Platform, ActivityIndicator } from "react-native";
import { useRouter, Link } from "expo-router";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { colors, radii, spacing } from "@/src/theme";
import { useAuth } from "@/src/hooks/useAuth";

export default function Login() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("cook@owami.app");
  const [password, setPassword] = useState("owami123");
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  const onSubmit = async () => {
    setBusy(true); setErr(null);
    try { await signIn(email, password); router.replace("/(tabs)/home"); }
    catch (e: any) { setErr("We couldn't sign you in. Please check your details."); }
    finally { setBusy(false); }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1, backgroundColor: colors.surface }} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={[styles.wrap, { paddingTop: insets.top + spacing.xl }]}>
        <Pressable onPress={() => router.back()} hitSlop={16} testID="login-back-button">
          <Text style={styles.back}>← Back</Text>
        </Pressable>
        <Text style={styles.title}>Welcome back, Cookist.</Text>
        <Text style={styles.sub}>Sign in to open your cookbook.</Text>

        <Text style={styles.label}>Email</Text>
        <TextInput testID="login-email-input" style={styles.input} value={email} onChangeText={setEmail}
          autoCapitalize="none" keyboardType="email-address" placeholder="you@kitchen.com" placeholderTextColor={colors.muted} />

        <Text style={styles.label}>Password</Text>
        <TextInput testID="login-password-input" style={styles.input} value={password} onChangeText={setPassword}
          secureTextEntry placeholder="••••••••" placeholderTextColor={colors.muted} />

        {err && <Text style={styles.err}>{err}</Text>}

        <Pressable testID="login-submit-button" style={[styles.cta, busy && { opacity: 0.6 }]} onPress={onSubmit} disabled={busy}>
          {busy ? <ActivityIndicator color={colors.onBrandPrimary} /> : <Text style={styles.ctaText}>Sign in</Text>}
        </Pressable>

        <Link href="/auth/register" asChild>
          <Pressable testID="login-goto-register" style={{ marginTop: spacing.lg, alignItems: "center" }}>
            <Text style={{ color: colors.brandPrimary, fontWeight: "500" }}>New here? Create an account.</Text>
          </Pressable>
        </Link>
      </View>
    </KeyboardAvoidingView>
  );
}
const styles = StyleSheet.create({
  wrap: { flex: 1, padding: spacing.xl },
  back: { color: colors.muted, marginBottom: spacing.xl, fontSize: 14 },
  title: { fontSize: 30, color: colors.onSurface, fontWeight: "700", marginBottom: spacing.xs },
  sub: { color: colors.muted, fontSize: 15, marginBottom: spacing.xl },
  label: { color: colors.onSurface, fontWeight: "500", marginTop: spacing.md, marginBottom: spacing.xs },
  input: { backgroundColor: colors.surfaceSecondary, borderRadius: radii.md, padding: 16, fontSize: 16, color: colors.onSurface, borderWidth: 1, borderColor: colors.border },
  err: { color: colors.error, marginTop: spacing.md },
  cta: { backgroundColor: colors.brandPrimary, marginTop: spacing.xl, padding: 18, borderRadius: radii.lg, alignItems: "center" },
  ctaText: { color: colors.onBrandPrimary, fontSize: 16, fontWeight: "600" },
});
