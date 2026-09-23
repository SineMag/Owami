// Shared voice adapter for browser Web Speech and native Expo speech modules.
import { Platform } from "react-native";
import * as Speech from "expo-speech";

type ListenOpts = { onResult: (text: string) => void; onError?: (e: string) => void; onEnd?: () => void };

let NativeSpeech: any = null;
if (Platform.OS !== "web") {
  try {
    // The native module is optional in Expo Go; development builds provide it.
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    NativeSpeech = require("expo-speech-recognition").ExpoSpeechRecognitionModule;
  } catch {}
}

export function isVoiceSupported(): boolean {
  if (Platform.OS !== "web") {
    try { return !!NativeSpeech?.isRecognitionAvailable?.(); } catch { return false; }
  }
  // @ts-ignore
  if (typeof window === "undefined") return false;
  // @ts-ignore
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  return !!SR;
}

export function isSpeakSupported(): boolean {
  if (Platform.OS !== "web") return true;
  // @ts-ignore
  return typeof window !== "undefined" && !!(window as any).speechSynthesis;
}

let _rec: any = null;
export function startListening(opts: ListenOpts) {
  if (Platform.OS !== "web") return startNativeListening(opts);
  if (!isVoiceSupported()) { opts.onError?.("unsupported"); return () => {}; }
  // @ts-ignore
  const SR = (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition;
  const rec = new SR();
  _rec = rec;
  rec.lang = "en-US";
  rec.interimResults = false;
  rec.maxAlternatives = 1;
  rec.continuous = false;
  rec.onresult = (e: any) => {
    const t = e.results?.[0]?.[0]?.transcript;
    if (t) opts.onResult(t);
  };
  rec.onerror = (e: any) => {
    const code = String(e?.error || "error");
    opts.onError?.(code === "not-allowed" ? "microphone-permission" : code);
  };
  rec.onend = () => {
    if (_rec === rec) _rec = null;
    opts.onEnd?.();
  };
  try {
    rec.start();
  } catch (e: any) {
    if (_rec === rec) _rec = null;
    opts.onError?.(String(e?.message || "start-failed"));
  }
  return () => {
    try { rec.stop(); } catch {}
    if (_rec === rec) _rec = null;
  };
}

function startNativeListening(opts: ListenOpts) {
  if (!NativeSpeech || !isVoiceSupported()) { opts.onError?.("unsupported"); return () => {}; }
  let disposed = false;
  const listeners = [
    NativeSpeech.addListener("result", (event: any) => {
      if (disposed) return;
      const result = event.results?.[0];
      if (result?.transcript && event.isFinal !== false) opts.onResult(result.transcript);
    }),
    NativeSpeech.addListener("error", (event: any) => {
      if (!disposed) opts.onError?.(String(event?.error || "error"));
    }),
    NativeSpeech.addListener("end", () => { if (!disposed) opts.onEnd?.(); }),
  ];
  NativeSpeech.requestPermissionsAsync()
    .then((permission: any) => {
      if (disposed) return;
      if (!permission?.granted) { opts.onError?.("microphone-permission"); return; }
      NativeSpeech.start({ lang: "en-US", interimResults: false, maxAlternatives: 1, continuous: false });
    })
    .catch((error: any) => { if (!disposed) opts.onError?.(String(error?.message || "start-failed")); });
  return () => {
    disposed = true;
    try { NativeSpeech.stop(); } catch {}
    listeners.forEach(listener => listener?.remove?.());
  };
}

export function stopListening() {
  if (Platform.OS !== "web") { try { NativeSpeech?.stop?.(); } catch {} return; }
  try { _rec?.stop(); } catch {}
}

export function speak(text: string, opts?: { rate?: number }) {
  if (!text || !isSpeakSupported()) return;
  if (Platform.OS !== "web") {
    Speech.stop();
    Speech.speak(text, { language: "en-US", rate: opts?.rate ?? 1.0 });
    return;
  }
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
  if (Platform.OS !== "web") { Speech.stop(); return; }
  if (!isSpeakSupported()) return;
  // @ts-ignore
  try { (window as any).speechSynthesis.cancel(); } catch {}
}
