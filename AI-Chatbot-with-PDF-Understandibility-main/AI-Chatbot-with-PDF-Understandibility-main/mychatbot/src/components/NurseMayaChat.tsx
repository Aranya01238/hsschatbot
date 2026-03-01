"use client";

import { useState, useRef, useEffect } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { useLanguage } from "@/components/i18n/language-context";
import { LanguageSelect } from "@/components/language-select";
import {
  Bot,
  Send,
  RefreshCcw,
  Sparkles,
  Stethoscope,
  Volume2,
  VolumeX,
  Heart,
  Shield,
  Clock,
  Paperclip,
  X,
  FileText,
  Loader2,
  Mic,
  MicOff,
} from "lucide-react";
import { cn } from "@/lib/utils";

// Fetcher function for API calls
const fetcher = async (url: string, body?: any) => {
  try {
    const res = await fetch(url, {
      method: body ? "POST" : "GET",
      headers: { "Content-Type": "application/json" },
      body: body ? JSON.stringify(body) : undefined,
    });

    const contentType = res.headers.get("content-type") || "";
    const isJson = contentType.includes("application/json");
    const data = isJson ? await res.json().catch(() => null) : null;

    if (!res.ok) {
      return {
        answer:
          "I'm having trouble connecting to my medical database right now. Please try again or seek a real doctor if it's urgent.",
        demo: true,
        reason: "http_error",
      };
    }

    return (
      data ?? {
        answer:
          "Service unavailable. Please consult a doctor immediately if this is an emergency.",
        demo: true,
        reason: "no_data",
      }
    );
  } catch (err: unknown) {
    return {
      answer:
        "Connection error. Please check your internet connection and try again.",
      demo: true,
      reason: "network_error",
    };
  }
};

// Message interface
interface Message {
  role: "user" | "assistant";
  text: string;
  timestamp?: Date;
}

// Type for Avatar States
type AvatarState = "idle" | "listening" | "thinking" | "speaking";

export function NurseMayaChat() {
  // State management
  const [query, setQuery] = useState("");
  const [history, setHistory] = useState<Message[]>([]);
  const [loading, setLoading] = useState(false);
  const [demo, setDemo] = useState(false);
  const [demoReason, setDemoReason] = useState<string | null>(null);
  const [isSpeaking, setIsSpeaking] = useState(false);
  const [ttsEnabled, setTtsEnabled] = useState(true);
  const [isClient, setIsClient] = useState(false);
  const [isListening, setIsListening] = useState(false);
  const [lipSyncLevel, setLipSyncLevel] = useState(0);
  const [speechError, setSpeechError] = useState("");
  const [pendingVoiceSubmit, setPendingVoiceSubmit] = useState(false);
  const recognitionRef = useRef<any>(null);
  const avatarVideoRef = useRef<HTMLVideoElement | null>(null);
  const shouldBeListeningRef = useRef(false);
  const restartTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const autoSendTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lipSyncTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const lipSyncFallbackIntervalRef = useRef<ReturnType<
    typeof setInterval
  > | null>(null);
  const latestLangRef = useRef("en-US");
  const latestQueryRef = useRef("");
  const loadingRef = useRef(false);
  const isUploadingRef = useRef(false);
  const skipNextVoiceSubmitRef = useRef(false);

  const speechRecognitionLangMap: Record<string, string> = {
    en: "en-US",
    bn: "bn-IN",
  };

  const getSpeechRecognitionLang = (languageCode: string) => {
    if (!languageCode) return "en-US";
    return speechRecognitionLangMap[languageCode] || "en-US";
  };

  // PDF state
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [pdfContext, setPdfContext] = useState<string>("");
  const [uploadError, setUploadError] = useState<string>("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Hooks
  const { lang } = useLanguage();
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    latestLangRef.current = getSpeechRecognitionLang(lang);
    if (recognitionRef.current && !isListening) {
      recognitionRef.current.lang = latestLangRef.current;
    }
  }, [lang, isListening]);

  useEffect(() => {
    latestQueryRef.current = query;
  }, [query]);

  useEffect(() => {
    loadingRef.current = loading;
  }, [loading]);

  useEffect(() => {
    isUploadingRef.current = isUploading;
  }, [isUploading]);

  // Derived Avatar State
  // The avatar reacts to the chatbot lifecycle automatically
  let avatarState: AvatarState = "idle";
  if (isSpeaking) {
    avatarState = "speaking";
  } else if (loading || isUploading) {
    avatarState = "thinking";
  } else if (isListening || query.trim().length > 0) {
    avatarState = "listening";
  }

  // Handle client-side hydration and PDF.js load
  useEffect(() => {
    setIsClient(true);

    if (
      typeof window !== "undefined" &&
      !document.getElementById("pdfjs-cdn")
    ) {
      const script = document.createElement("script");
      script.id = "pdfjs-cdn";
      script.src =
        "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.min.js";
      script.onload = () => {
        const pdfjsLib = (window as any).pdfjsLib;
        if (pdfjsLib) {
          pdfjsLib.GlobalWorkerOptions.workerSrc =
            "https://cdnjs.cloudflare.com/ajax/libs/pdf.js/2.16.105/pdf.worker.min.js";
        }
      };
      document.head.appendChild(script);
    }
  }, []);

  const handlePdfUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] || null;
    setSelectedFile(file);
    setPdfContext("");
    setUploadError("");

    if (!file) return;

    if (file.type !== "application/pdf") {
      setUploadError("Please upload a valid PDF file.");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      return;
    }

    setIsUploading(true);

    try {
      const pdfjsLib = (window as any).pdfjsLib;
      if (!pdfjsLib) {
        throw new Error(
          "PDF parser is still loading. Please try again in a moment.",
        );
      }

      const arrayBuffer = await file.arrayBuffer();
      const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
      let extractedText = "";

      for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const pageText = textContent.items
          .map((item: any) => item.str)
          .join(" ");
        extractedText += pageText + "\n";
      }

      setPdfContext(extractedText);

      // Add a system message locally
      setHistory((prev) => [
        ...prev,
        {
          role: "assistant",
          text: `1 file uploaded: **${file.name}**. I've successfully received it and parsed the text locally.`,
          timestamp: new Date(),
        },
      ]);
    } catch (err: any) {
      console.error("PDF Parsing error:", err);
      setUploadError(err.message || "Failed to parse PDF locally");
      setSelectedFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
    } finally {
      setIsUploading(false);
    }
  };

  const removePdf = () => {
    setSelectedFile(null);
    setPdfContext("");
    setUploadError("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  // WebSpeech API Integration
  const toggleListening = () => {
    const stopListeningSession = () => {
      shouldBeListeningRef.current = false;
      skipNextVoiceSubmitRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
        restartTimeoutRef.current = null;
      }
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
        autoSendTimeoutRef.current = null;
      }
      recognitionRef.current?.stop();
      setIsListening(false);
      setSpeechError("");
    };

    const scheduleRestart = () => {
      if (!shouldBeListeningRef.current || !recognitionRef.current) return;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      restartTimeoutRef.current = setTimeout(() => {
        if (!shouldBeListeningRef.current || !recognitionRef.current) return;
        try {
          recognitionRef.current.lang = latestLangRef.current;
          recognitionRef.current.start();
        } catch {
          // Ignore restart race conditions; onend/onerror may fire multiple times.
        }
      }, 400);
    };

    if (isListening || shouldBeListeningRef.current) {
      stopListeningSession();
      return;
    }

    const SpeechRecognition =
      (window as any).SpeechRecognition ||
      (window as any).webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setSpeechError(
        "Speech recognition is not supported in this browser. Please use Chrome or Edge.",
      );
      return;
    }

    shouldBeListeningRef.current = true;
    setSpeechError("");

    if (!recognitionRef.current) {
      const recognition = new SpeechRecognition();
      recognition.continuous = true;
      recognition.interimResults = true;
      recognition.lang = latestLangRef.current;

      recognition.onstart = () => {
        setIsListening(true);
        setSpeechError("");
        // Optionally cancel any ongoing TTS speech so the mic doesn't record it
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
      };

      recognition.onresult = (event: any) => {
        let fullTranscript = "";
        let hasFinalResult = false;
        for (let i = 0; i < event.results.length; ++i) {
          fullTranscript += event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            hasFinalResult = true;
          }
        }
        const transcript = fullTranscript.trim();
        latestQueryRef.current = transcript;
        setQuery(transcript);
        setSpeechError("");

        if (!hasFinalResult || !transcript) return;

        if (autoSendTimeoutRef.current) {
          clearTimeout(autoSendTimeoutRef.current);
        }
        autoSendTimeoutRef.current = setTimeout(() => {
          const spokenQuestion = latestQueryRef.current.trim();
          if (!spokenQuestion || loadingRef.current || isUploadingRef.current) {
            return;
          }

          shouldBeListeningRef.current = false;
          skipNextVoiceSubmitRef.current = true;
          recognitionRef.current?.stop();
          setPendingVoiceSubmit(true);
        }, 1000);
      };

      recognition.onerror = (event: any) => {
        const errorCode = event?.error as string | undefined;
        const nonBlockingErrors = new Set(["network", "no-speech"]);

        if (errorCode && nonBlockingErrors.has(errorCode)) {
          setSpeechError("");
          console.warn("Speech recognition ended", errorCode);
          setIsListening(false);
          scheduleRestart();
          return;
        }

        if (errorCode === "aborted") {
          if (autoSendTimeoutRef.current) {
            clearTimeout(autoSendTimeoutRef.current);
            autoSendTimeoutRef.current = null;
          }
          setSpeechError("");
          setIsListening(false);
          shouldBeListeningRef.current = false;
          return;
        }

        const errorMessages: Record<string, string> = {
          "audio-capture":
            "No microphone was detected. Please check your mic permissions/device.",
          "not-allowed":
            "Microphone permission denied. Please allow microphone access and try again.",
          "service-not-allowed":
            "Microphone access is blocked by browser settings.",
        };

        if (errorCode && errorMessages[errorCode]) {
          setSpeechError(errorMessages[errorCode]);
          console.warn("Speech recognition warning", errorCode);
        } else {
          setSpeechError(
            "Could not start speech recognition. Please try again.",
          );
          console.warn(
            "Speech recognition unexpected error",
            errorCode || event,
          );
        }
        if (autoSendTimeoutRef.current) {
          clearTimeout(autoSendTimeoutRef.current);
          autoSendTimeoutRef.current = null;
        }
        skipNextVoiceSubmitRef.current = true;
        shouldBeListeningRef.current = false;
        setIsListening(false);
      };

      recognition.onend = () => {
        setIsListening(false);
        if (shouldBeListeningRef.current) {
          scheduleRestart();
          return;
        }

        if (skipNextVoiceSubmitRef.current) {
          skipNextVoiceSubmitRef.current = false;
          return;
        }

        if (latestQueryRef.current.trim()) {
          setPendingVoiceSubmit(true);
        }
      };

      recognitionRef.current = recognition;
    }

    // Update language dynamically before starting
    recognitionRef.current.lang = latestLangRef.current;
    try {
      recognitionRef.current.start();
    } catch (error: unknown) {
      const message =
        (error as Error)?.message || "Unable to start microphone.";
      setSpeechError(message);
      setIsListening(false);
      shouldBeListeningRef.current = false;
      console.warn("Speech recognition start failed", message);
    }
  };

  // Auto-scroll to bottom of chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [history, loading]);

  // Stop talking when unmounted
  useEffect(() => {
    return () => {
      shouldBeListeningRef.current = false;
      if (restartTimeoutRef.current) {
        clearTimeout(restartTimeoutRef.current);
      }
      if (autoSendTimeoutRef.current) {
        clearTimeout(autoSendTimeoutRef.current);
      }
      recognitionRef.current?.stop();
      if (typeof window !== "undefined" && "speechSynthesis" in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  // Auto-detect language from text using Unicode script ranges
  const detectLanguage = (text: string): string => {
    if (!text || !text.trim()) return "en";

    // Remove punctuation and whitespace for analysis
    const cleanText = text.replace(/[^\p{L}]/gu, "");
    if (!cleanText) return "en";

    // Count characters by script/language
    const scriptCounts = {
      bengali: 0, // Bengali
      latin: 0, // English and others
    };

    for (const char of cleanText) {
      const code = char.codePointAt(0);
      if (!code) continue;

      // Bengali script
      if (code >= 0x0980 && code <= 0x09ff) {
        scriptCounts.bengali++;
      }
      // Latin script (English and others)
      else if (
        (code >= 0x0041 && code <= 0x005a) ||
        (code >= 0x0061 && code <= 0x007a) ||
        (code >= 0x00c0 && code <= 0x024f) ||
        (code >= 0x1e00 && code <= 0x1eff)
      ) {
        scriptCounts.latin++;
      }
    }

    // Find the script with the highest count
    const totalChars = Object.values(scriptCounts).reduce(
      (sum, count) => sum + count,
      0,
    );
    if (totalChars === 0) return "en";

    // Calculate percentages and determine language
    const percentages = Object.entries(scriptCounts).map(([script, count]) => ({
      script,
      percentage: (count / totalChars) * 100,
    }));

    // Sort by percentage (highest first)
    percentages.sort((a, b) => b.percentage - a.percentage);
    const dominant = percentages[0];

    // Require at least 30% of characters to be in a script to detect it
    if (dominant.percentage < 30) return "en";

    // Map scripts to language codes
    switch (dominant.script) {
      case "bengali":
        return "bn";
      case "latin":
      default:
        return "en";
    }
  };

  const clearLipSyncTimers = () => {
    if (lipSyncTimeoutRef.current) {
      clearTimeout(lipSyncTimeoutRef.current);
      lipSyncTimeoutRef.current = null;
    }
    if (lipSyncFallbackIntervalRef.current) {
      clearInterval(lipSyncFallbackIntervalRef.current);
      lipSyncFallbackIntervalRef.current = null;
    }
  };

  const startLipSync = () => {
    clearLipSyncTimers();
    setLipSyncLevel(0.55);
    lipSyncFallbackIntervalRef.current = setInterval(() => {
      setLipSyncLevel(0.35 + Math.random() * 0.6);
    }, 140);
  };

  const triggerLipSyncPulse = () => {
    setLipSyncLevel(0.6 + Math.random() * 0.4);
    if (lipSyncTimeoutRef.current) {
      clearTimeout(lipSyncTimeoutRef.current);
    }
    lipSyncTimeoutRef.current = setTimeout(() => {
      setLipSyncLevel(0.2 + Math.random() * 0.2);
    }, 90);
  };

  const stopLipSync = () => {
    clearLipSyncTimers();
    setLipSyncLevel(0);
  };

  useEffect(() => {
    if (!isSpeaking) {
      stopLipSync();
      return;
    }

    startLipSync();
    return () => {
      stopLipSync();
    };
  }, [isSpeaking]);

  // Text-to-Speech function with built-in browser synthesis
  const speakText = async (text: string, force = false) => {
    if ((!ttsEnabled && !force) || !text.trim() || !isClient) return;

    try {
      setIsSpeaking(true);

      // Fallback to browser speech synthesis with auto-detected language
      if ("speechSynthesis" in window) {
        // Cancel any ongoing speech to prevent double speech triggering
        window.speechSynthesis.cancel();

        // Auto-detect language from the text
        const detectedLang = detectLanguage(text);

        // Wait for voices to load
        const getVoices = (): Promise<SpeechSynthesisVoice[]> => {
          return new Promise((resolve) => {
            let voices = window.speechSynthesis.getVoices();
            if (voices.length > 0) {
              resolve(voices);
            } else {
              window.speechSynthesis.onvoiceschanged = () => {
                voices = window.speechSynthesis.getVoices();
                resolve(voices);
              };
            }
          });
        };

        const voices = await getVoices();

        // Strip markdown, numbers that act as bullets, and special symbols for a clean speech reading
        let sanitizedText = text;
        const charsToRemove = [
          "*",
          "#",
          "_",
          "~",
          "`",
          ">",
          "|",
          "[",
          "]",
          "{",
          "}",
        ];
        charsToRemove.forEach((char) => {
          sanitizedText = sanitizedText.split(char).join("");
        });

        sanitizedText = sanitizedText
          .replace(/[=-]/g, " ") // Replace dashes and equals with spaces
          .replace(/https?:\/\/[^\s]+/g, "") // Remove URLs
          .replace(/\s+/g, " ") // Collapse multiple spaces
          .trim();

        const utterance = new SpeechSynthesisUtterance(sanitizedText);

        // Language mapping for voice selection to ensure scripts like Bengali are actually pronounced
        const languageMap: Record<string, string[]> = {
          en: ["en-US", "en-GB", "en-AU", "en-CA", "en-IN", "en"],
          bn: ["bn-IN", "bn-BD", "bn"],
        };

        const currentLangCodes = languageMap[detectedLang] || ["en-US", "en"];

        // Helper to forcefully identify female voices across different OS naming conventions
        const isFemale = (voice: SpeechSynthesisVoice) => {
          const name = voice.name.toLowerCase();
          return (
            name.includes("female") ||
            name.includes("woman") ||
            name.includes("girl") ||
            (voice as any).gender === "female" ||
            name.includes("neerja") ||
            name.includes("zira") ||
            name.includes("samantha") ||
            name.includes("victoria") ||
            name.includes("aditi") ||
            name.includes("kavya") ||
            name.includes("kalpana") ||
            name.includes("veena") ||
            (!name.includes("male") &&
              !name.includes("man") &&
              !name.includes("david") &&
              !name.includes("mark") &&
              !name.includes("alex"))
          );
        };

        let selectedVoice: SpeechSynthesisVoice | null = null;

        // Specific, strict targeted search for the detected language
        if (detectedLang === "bn") {
          // Strictly find a BENGALI FEMALE voice
          selectedVoice =
            voices.find((voice) => {
              const voiceLang = voice.lang.toLowerCase();
              return (
                currentLangCodes.some((c) =>
                  voiceLang.startsWith(c.toLowerCase()),
                ) && isFemale(voice)
              );
            }) || null;

          // Fallback to ANY Bengali voice if female not found
          if (!selectedVoice) {
            selectedVoice =
              voices.find((voice) =>
                currentLangCodes.some((c) =>
                  voice.lang.toLowerCase().startsWith(c.toLowerCase()),
                ),
              ) || null;
          }
        } else {
          // Strictly find an ENGLISH FEMALE voice
          selectedVoice =
            voices.find((voice) => {
              const voiceLang = voice.lang.toLowerCase();
              return (
                currentLangCodes.some((c) =>
                  voiceLang.startsWith(c.toLowerCase()),
                ) && isFemale(voice)
              );
            }) || null;

          // Specific fallback to high-quality known female voices if strict lang mapping fails
          if (!selectedVoice) {
            selectedVoice =
              voices.find((voice) => {
                const name = voice.name.toLowerCase();
                return (
                  name.includes("neerja") ||
                  name.includes("aditi") ||
                  name.includes("zira") ||
                  name.includes("samantha")
                );
              }) || null;
          }
        }

        // Ultimate Fallback: Just grab ANY female voice, or the first available voice
        if (!selectedVoice) {
          selectedVoice = voices.find(isFemale) || voices[0] || null;
        }

        if (selectedVoice) {
          utterance.voice = selectedVoice;
        }

        // Configure speech parameters based on detected language
        if (detectedLang === "bn") {
          // Bengali - slightly slower rate for clarity
          utterance.rate = 0.75;
          utterance.pitch = 1.1;
        } else {
          // English and other languages
          utterance.rate = 0.85;
          utterance.pitch = 1.2;
        }

        utterance.volume = 0.9;

        utterance.onstart = () => {
          setIsSpeaking(true);
          triggerLipSyncPulse();
        };
        utterance.onboundary = () => {
          triggerLipSyncPulse();
        };
        utterance.onend = () => {
          setIsSpeaking(false);
          stopLipSync();
        };
        utterance.onerror = () => {
          setIsSpeaking(false);
          stopLipSync();
        };

        window.speechSynthesis.speak(utterance);
      } else {
        console.warn("Speech synthesis not available");
        setIsSpeaking(false);
        stopLipSync();
      }
    } catch (fallbackError: unknown) {
      console.error(
        "Browser TTS failed:",
        (fallbackError as Error)?.message || "Unknown error",
      );
      setIsSpeaking(false);
      stopLipSync();
    }
  };

  // Toggle TTS on/off
  const toggleTTS = () => {
    setTtsEnabled((prev) => {
      const newState = !prev;
      // If turning OFF, immediately halt any ongoing speech globally
      if (!newState) {
        if (typeof window !== "undefined" && "speechSynthesis" in window) {
          window.speechSynthesis.cancel();
        }
        setIsSpeaking(false);
        stopLipSync();
      }
      return newState;
    });
  };

  // Send message to AI
  const ask = async (overrideQuestion?: string) => {
    const questionText = (overrideQuestion ?? query).trim();
    if (!questionText || loading || isUploading) return;

    const userMsg: Message = {
      role: "user",
      text: questionText,
      timestamp: new Date(),
    };

    setHistory((prev) => [...prev, userMsg]);
    setQuery("");
    setLoading(true);

    // Add natural delay for better UX
    const startTime = Date.now();

    try {
      const res = await fetcher("/api/triage", {
        question: pdfContext
          ? `${userMsg.text}\n\n[USER UPLOADED PDF DOCUMENT CONTENT]:\n${pdfContext}`
          : userMsg.text,
        history: [...history, userMsg],
        lang,
      });

      // Ensure minimum loading time for natural feel
      const elapsed = Date.now() - startTime;
      if (elapsed < 800) {
        await new Promise((resolve) => setTimeout(resolve, 800 - elapsed));
      }

      setDemo(!!res?.demo);
      setDemoReason(res?.reason ?? null);

      const assistantResponse =
        res?.answer ??
        "I apologize, I couldn't process that request. Please try again or consult a healthcare professional.";

      const assistantMsg: Message = {
        role: "assistant",
        text: assistantResponse,
        timestamp: new Date(),
      };

      setHistory((prev) => [...prev, assistantMsg]);

      // Speak the response if TTS is enabled
      if (ttsEnabled && assistantResponse) {
        // Small delay to let the UI update first
        setTimeout(() => speakText(assistantResponse), 300);
      }
    } catch (error: unknown) {
      console.error("Error asking question:", error);

      const errorMsg: Message = {
        role: "assistant",
        text: "I'm experiencing technical difficulties. Please try again in a moment or consult a healthcare professional if this is urgent.",
        timestamp: new Date(),
      };

      setHistory((prev) => [...prev, errorMsg]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    if (!pendingVoiceSubmit) return;

    setPendingVoiceSubmit(false);

    const spokenQuestion = latestQueryRef.current.trim();
    if (!spokenQuestion || loadingRef.current || isUploadingRef.current) return;

    void ask(spokenQuestion);
  }, [pendingVoiceSubmit]);

  // Clear chat history
  const clearChat = () => {
    setHistory([]);
    setDemo(false);
    setDemoReason(null);
    removePdf();

    // Stop any ongoing speech
    if (isSpeaking && isClient && "speechSynthesis" in window) {
      window.speechSynthesis.cancel();
      setIsSpeaking(false);
      stopLipSync();
    }
  };

  // Handle Enter key press
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      ask();
    }
  };

  return (
    <Card className="w-full max-w-4xl mx-auto overflow-hidden border-2 border-blue-100 shadow-2xl bg-white/95 backdrop-blur-sm flex flex-col h-[800px]">
      {/* Header */}
      <div className="bg-gradient-to-r from-blue-600 via-indigo-600 to-purple-600 p-6 text-white shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="relative">
              <div
                className={cn(
                  "size-12 rounded-2xl bg-white/20 backdrop-blur-md border border-white/30 shadow-inner flex items-center justify-center transition-all duration-300",
                  (loading || isSpeaking) && "scale-110 rotate-3",
                )}
              >
                <Stethoscope className="size-7 text-white" />
              </div>
              {/* Status indicator */}
              <div className="absolute -bottom-1 -right-1 size-4 bg-white rounded-full flex items-center justify-center shadow-sm">
                <div
                  className={cn(
                    "size-2.5 rounded-full transition-colors",
                    avatarState === "thinking"
                      ? "bg-amber-400 animate-pulse"
                      : avatarState === "speaking"
                        ? "bg-green-400 animate-pulse"
                        : avatarState === "listening"
                          ? "bg-blue-400 animate-pulse"
                          : "bg-emerald-500",
                  )}
                />
              </div>
            </div>

            <div>
              <div className="flex items-center gap-3">
                <h2 className="font-bold text-xl tracking-tight">Nurse Maya</h2>
                {demo && (
                  <span className="text-xs bg-white/20 px-2 py-1 rounded-full font-medium">
                    Demo Mode
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 text-sm text-white/90 mt-1">
                <Shield className="size-4" />
                <span>AI Medical Assistant • Secure & Private</span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2">
            {/* TTS Toggle */}
            <Button
              variant="ghost"
              size="icon"
              onClick={toggleTTS}
              className={cn(
                "text-white hover:bg-white/20 rounded-xl transition-all",
                isSpeaking && "animate-pulse scale-110",
              )}
              title={ttsEnabled ? "Disable Voice" : "Enable Voice"}
            >
              {ttsEnabled ? (
                <Volume2 className="size-5" />
              ) : (
                <VolumeX className="size-5" />
              )}
            </Button>

            {/* Language Select */}
            <div className="hidden sm:block">
              <LanguageSelect />
            </div>

            {/* Clear Chat */}
            <Button
              variant="ghost"
              size="icon"
              onClick={clearChat}
              className="text-white hover:bg-white/20 rounded-xl"
              title="Clear Conversation"
            >
              <RefreshCcw className="size-5" />
            </Button>
          </div>
        </div>
      </div>

      {/* Main Content Area (Avatar + Chat) */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden bg-gradient-to-b from-slate-50/50 to-blue-50/30">
        {/* Avatar Section */}
        <div className="w-full md:w-1/3 border-b md:border-b-0 md:border-r border-slate-200 flex flex-col items-center justify-center p-6 bg-white/40">
          <div className="relative w-48 h-48 rounded-full bg-gradient-to-br from-blue-100 to-indigo-50 shadow-inner flex items-center justify-center overflow-hidden border-4 border-white">
            <video
              ref={avatarVideoRef}
              autoPlay
              loop
              muted
              playsInline
              className="w-full h-full object-cover"
              src={`/animations/female/${avatarState === "idle" ? "Idle" : avatarState}_female.mp4`}
            />
            <div
              className="absolute left-1/2 -translate-x-1/2 bottom-8 rounded-full bg-slate-900/75 transition-all duration-75"
              style={{
                width:
                  avatarState === "speaking"
                    ? `${12 + lipSyncLevel * 10}px`
                    : "12px",
                height:
                  avatarState === "speaking"
                    ? `${4 + lipSyncLevel * 10}px`
                    : "4px",
                opacity: avatarState === "speaking" ? 0.8 : 0,
              }}
            />
          </div>
          <div className="mt-6 flex flex-col items-center">
            <span className="text-sm font-medium text-slate-500 uppercase tracking-widest">
              {avatarState}
            </span>
          </div>
        </div>

        {/* Chat Area */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-4">
          {/* Welcome Message */}
          {history.length === 0 && (
            <div className="flex flex-col items-center justify-center h-full text-center space-y-6">
              <div className="space-y-3">
                <h3 className="text-xl font-bold text-slate-900">
                  Hello! I'm Nurse Maya 👩‍⚕️
                </h3>
                <p className="text-slate-600 max-w-md mx-auto leading-relaxed">
                  I'm here to help with your health questions and provide
                  preliminary symptom assessment. Describe your symptoms and
                  I'll guide you with care.
                </p>
                <div className="flex flex-wrap justify-center gap-2 mt-4">
                  <span className="text-xs bg-blue-100 text-blue-700 px-3 py-1 rounded-full">
                    Symptom Analysis
                  </span>
                  <span className="text-xs bg-green-100 text-green-700 px-3 py-1 rounded-full">
                    Health Guidance
                  </span>
                  <span className="text-xs bg-purple-100 text-purple-700 px-3 py-1 rounded-full">
                    24/7 Available
                  </span>
                </div>
              </div>
            </div>
          )}

          {/* Chat Messages */}
          {history.map((message, index) => (
            <div
              key={index}
              className={cn(
                "flex w-full animate-in slide-in-from-bottom-2 duration-300",
                message.role === "user" ? "justify-end" : "justify-start",
              )}
            >
              <div
                className={cn(
                  "relative max-w-[85%] px-5 py-3 rounded-2xl shadow-sm text-sm leading-relaxed",
                  message.role === "user"
                    ? "bg-gradient-to-r from-blue-600 to-indigo-600 text-white rounded-br-md"
                    : "bg-white text-slate-800 border border-slate-200 rounded-bl-md shadow-md",
                )}
              >
                {/* Assistant message extras */}
                {message.role === "assistant" && (
                  <>
                    <div className="absolute -left-3 bottom-2 size-6 bg-blue-100 rounded-full flex items-center justify-center shadow-sm">
                      <Bot className="size-4 text-blue-600" />
                    </div>

                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => speakText(message.text, true)}
                      className="absolute -right-2 -top-2 size-8 p-0 text-slate-400 hover:text-blue-600 bg-white shadow-sm rounded-full border"
                      title="Speak this message"
                    >
                      <Volume2 className="size-3" />
                    </Button>
                  </>
                )}

                <div className="whitespace-pre-wrap">{message.text}</div>

                {/* Timestamp */}
                {message.timestamp && (
                  <div
                    className={cn(
                      "text-xs mt-2 opacity-70",
                      message.role === "user"
                        ? "text-white/80"
                        : "text-slate-500",
                    )}
                  >
                    {message.timestamp.toLocaleTimeString([], {
                      hour: "2-digit",
                      minute: "2-digit",
                    })}
                  </div>
                )}
              </div>
            </div>
          ))}

          {/* Loading Animation */}
          {loading && (
            <div className="flex justify-start w-full">
              <div className="bg-white border border-slate-200 px-5 py-4 rounded-2xl rounded-bl-md shadow-md flex items-center gap-2">
                <div className="flex items-center gap-1">
                  <span className="size-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.3s]"></span>
                  <span className="size-2 bg-blue-600 rounded-full animate-bounce [animation-delay:-0.15s]"></span>
                  <span className="size-2 bg-blue-600 rounded-full animate-bounce"></span>
                </div>
                <span className="text-sm text-slate-600 ml-2">
                  Analyzing...
                </span>
              </div>
            </div>
          )}

          {/* Demo Status */}
          {demo && demoReason && (
            <div className="flex justify-center my-4">
              <div className="bg-amber-50 border border-amber-200 text-amber-700 px-4 py-2 rounded-full text-xs font-medium flex items-center gap-2">
                <Clock className="size-3" />
                Demo Mode: {demoReason.replace("_", " ")}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Input Area */}
      <div className="p-6 bg-white border-t border-slate-200 shrink-0">
        {/* PDF PDF upload UI Integration */}
        <div className="mb-3">
          <div className="flex items-center gap-2">
            <input
              type="file"
              accept="application/pdf"
              ref={fileInputRef}
              onChange={handlePdfUpload}
              className="hidden"
              disabled={isUploading || loading}
            />
            {!selectedFile ? (
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading || loading}
                onClick={() => fileInputRef.current?.click()}
                className="text-slate-500 hover:text-blue-600 rounded-lg text-xs"
                title="Attach PDF Document"
              >
                <Paperclip className="size-4 mr-1" />
                {isUploading ? "Uploading..." : "Attach PDF"}
              </Button>
            ) : (
              <div className="flex items-center gap-2 bg-blue-50 text-blue-700 px-3 py-1.5 rounded-lg border border-blue-200 text-xs">
                <FileText className="size-4" />
                <span className="max-w-[200px] truncate font-medium">
                  {selectedFile.name}
                </span>
                <button
                  type="button"
                  onClick={removePdf}
                  className="hover:bg-blue-200 rounded-full p-0.5 transition-colors ml-1"
                  disabled={isUploading || loading}
                >
                  <X className="size-3" />
                </button>
              </div>
            )}
            {isUploading && (
              <div className="text-xs text-blue-500 flex items-center gap-1">
                <Loader2 className="size-3 animate-spin" /> Parsing...
              </div>
            )}
          </div>
          {uploadError && (
            <p className="text-xs text-red-500 mt-1">{uploadError}</p>
          )}
        </div>

        <form
          onSubmit={(e) => {
            e.preventDefault();
            ask();
          }}
          className="flex gap-3 items-end"
        >
          <div className="flex-1 relative">
            <Input
              placeholder={
                isUploading
                  ? "Uploading PDF..."
                  : isListening
                    ? "Listening..."
                    : "Describe your symptoms or ask about the uploaded document..."
              }
              className={cn(
                "min-h-[52px] bg-slate-50 border-slate-300 focus-visible:ring-blue-500 focus-visible:ring-offset-0 rounded-xl text-base px-4 py-3 pr-12 transition-all duration-300",
                isListening && "ring-2 ring-red-500 border-red-500 bg-red-50",
              )}
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              onKeyDown={handleKeyDown}
              disabled={loading || isUploading}
            />
            {/* Microphone Button */}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              className={cn(
                "absolute right-1 top-1/2 -translate-y-1/2 h-10 w-10 text-slate-400 hover:text-blue-600 rounded-lg transition-colors",
                isListening &&
                  "text-red-500 hover:text-red-600 hover:bg-red-100 animate-pulse",
              )}
              onClick={toggleListening}
              disabled={loading || isUploading}
              title={isListening ? "Stop Listening" : "Start Speaking"}
            >
              {isListening ? (
                <Mic className="size-5" />
              ) : (
                <MicOff className="size-5" />
              )}
            </Button>
          </div>

          <Button
            type="submit"
            disabled={!query.trim() || loading || isUploading}
            className={cn(
              "size-[52px] rounded-xl shrink-0 transition-all duration-300 shadow-lg",
              query.trim() && !loading && !isUploading
                ? "bg-gradient-to-r from-blue-600 to-indigo-600 hover:from-blue-700 hover:to-indigo-700 text-white hover:shadow-xl hover:scale-105"
                : "bg-slate-200 text-slate-400 cursor-not-allowed",
            )}
          >
            {loading ? (
              <div className="animate-spin rounded-full h-5 w-5 border-2 border-white border-t-transparent" />
            ) : (
              <Send className="size-5" />
            )}
          </Button>
        </form>
        {speechError && (
          <p className="text-xs text-red-500 mt-2">{speechError}</p>
        )}

        {/* Disclaimer */}
        <div className="mt-4 text-center">
          <p className="text-xs text-slate-500 leading-relaxed">
            <strong>Medical Disclaimer:</strong> This AI assistant provides
            general health information only. Not a substitute for professional
            medical advice. For emergencies, call 911/112 immediately.
          </p>
        </div>
      </div>
    </Card>
  );
}
