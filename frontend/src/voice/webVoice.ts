// Web Speech API adapter — works in Chrome/Edge/Safari on web.
// On native platforms these methods are no-ops (return unsupported).
// A real Android/iOS build should swap this for expo-speech-recognition + backend OpenAI TTS.
import { Platform } from "react-native";

type ListenOpts = { onResult: (text: string) => void; onError?: (e: string) => void };

export function isVoiceSupported(): boolean {
  if (Platform.OS !== "web") return false;
  // @ts-ignore
  if (typeof window === "undefined") return false;
  // @ts-ignore
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!SR;
}

export function isSpeakSupported(): boolean {
  if (Platform.OS !== "web") return false;
  // @ts-ignore
  return typeof window !== "undefined" && !!(window as any).speechSynthesis;
}

let _rec: any = null;
export function startListening(opts: ListenOpts) {
  if (!isVoiceSupported()) { opts.onError?.("unsupported"); return () => {}; }
  // @ts-ignore
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  _rec = new SR();
  _rec.lang = "en-US";
  _rec.interimResults = false;
  _rec.maxAlternatives = 1;
  _rec.continuous = false;
  _rec.onresult = (e: any) => {
    const t = e.results?.[0]?.[0]?.transcript;
    if (t) opts.onResult(t);
  };
  _rec.onerror = (e: any) => opts.onError?.(String(e?.error || "error"));
  try { _rec.start(); } catch {}
  return () => { try { _rec?.stop(); } catch {} };
}

export function stopListening() { try { _rec?.stop(); } catch {} }

export function speak(text: string, opts?: { rate?: number }) {
  if (!isSpeakSupported() || !text) return;
  // @ts-ignore
  const synth = (window as any).speechSynthesis;
  try { synth.cancel(); } catch {}
  // @ts-ignore
  const u = new (window as any).SpeechSynthesisUtterance(text);
  u.rate = opts?.rate ?? 1;
  u.pitch = 1;
  u.lang = "en-US";
  try { synth.speak(u); } catch {}
}

export function stopSpeaking() {
  if (!isSpeakSupported()) return;
  // @ts-ignore
  try { (window as any).speechSynthesis.cancel(); } catch {}
}
