import React from "react";
import { View, Text, StyleSheet } from "react-native";

type P = { children: React.ReactNode };
type S = { hasError: boolean };

export class ErrorBoundary extends React.Component<P, S> {
  state: S = { hasError: false };
  static getDerivedStateFromError() { return { hasError: true }; }
  componentDidCatch(e: Error) { console.warn("ErrorBoundary:", e); }
  render() {
    if (this.state.hasError) {
      return (
        <View style={styles.c}>
          <Text style={styles.t}>Something went wrong.</Text>
          <Text style={styles.s}>Restart the app to try again.</Text>
        </View>
      );
    }
    return this.props.children as any;
  }
}
const styles = StyleSheet.create({
  c: { flex: 1, justifyContent: "center", alignItems: "center", backgroundColor: "#FDFBF7", padding: 24 },
  t: { fontSize: 20, fontWeight: "600", color: "#2D1E19" },
  s: { color: "#7D6B5D", marginTop: 8 },
});
