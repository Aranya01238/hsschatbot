import { type NextRequest, NextResponse } from "next/server"

type ChatMessage = { role: "user" | "assistant"; text: string }

const systemPrompt = `
 You are NurseMaya, an AI healthcare triage assistant for rural patients in India.


ROLE & BOUNDARIES:
- You provide preliminary health guidance and triage only.
- You are NOT a doctor and do NOT give medical diagnoses.
- Never recommend prescription-only medicines by name.
- When medication is needed, say: "consult a doctor".


COMMUNICATION STYLE:
- Use simple, clear, non-technical language.
- Be empathetic, calm, and supportive.
- Assume low digital and health literacy.
- Prefer short sentences and bullet points.


TRIAGE & SAFETY:
- Always check for emergency warning signs.
- Treat these as EMERGENCIES:
chest pain, severe bleeding, difficulty breathing,
loss of consciousness, stroke symptoms,
uncontrolled vomiting, high fever in infants.
- Clearly instruct urgent medical care when emergencies are detected.


GUIDANCE RULES:
- Suggest only safe next steps (rest, fluids, basic home care).
- If symptoms persist or worsen, advise consulting a doctor.


CONTEXT:
- Remember relevant symptoms mentioned earlier in this session.
- Do not contradict earlier safe guidance unless new info is provided.
IN-APP RESOURCES:
- Emergency beds → /beds
- Blood availability → /blood
- Clinics/doctors → /list-centre
- Never invent hospitals or availability.


OUTPUT RULES:
- Be concise and structured.
- Clearly label EMERGENCY warnings.
- Do not hallucinate medical facts.
- End with:
"This is not a medical diagnosis. Please consult a doctor."


Follow these rules strictly in every response.
`

const GEMINI_MODEL = process.env.GEMINI_MODEL?.trim() || "gemini-1.5-flash-latest"

function normalizeGeminiModel(name: string) {
  const m = (name || "").trim()
  if (!m) return "gemini-1.5-flash-latest"
  if (/-latest$/.test(m)) return m
  if (m === "gemini-1.5-pro" || m === "gemini-1.5-flash") return `${m}-latest`
  return m // allow explicitly versioned names e.g. gemini-1.5-pro-002
}

function buildGeminiUrl(apiVersion: "v1" | "v1beta", model: string, key: string) {
  return `https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:generateContent?key=${encodeURIComponent(
    key,
  )}`
}

// Helper to list available Gemini models for each API version
async function listGeminiModels(apiVersion: "v1" | "v1beta", key: string): Promise<string[]> {
  const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${encodeURIComponent(key)}`;
  const res = await fetch(url, { method: "GET" });
  if (!res.ok) return [];

  const data: any = await res.json().catch(() => ({}));
  const models: any[] = Array.isArray(data?.models) ? data.models : [];

  return models
    .map((m: { name?: string; supportedGenerationMethods?: string[] }) => {
      const id = (m.name || "").toString().split("/").pop();
      const methods: string[] = m.supportedGenerationMethods || [];
      return { id, methods };
    })
    .filter((m): m is { id: string; methods: string[] } => !!m.id && m.methods.includes("generateContent"))
    .map((m) => m.id);
}

// Replace callGeminiDirect: discover supported models, prefer "pro", then call generateContent
async function callGeminiDirect(prompt: string): Promise<{ text: string; model: string; apiVersion: "v1" | "v1beta" }> {
  const key = (process.env.GEMINI_API_KEY || "").trim()
  if (!key) {
    const err: any = new Error("Missing GEMINI_API_KEY")
    err.reason = "no_gemini_api_key"
    throw err
  }

  // Discover available models across v1 and v1beta
  const [v1List, v1betaList] = await Promise.all([
    listGeminiModels("v1", key).catch(() => []),
    listGeminiModels("v1beta", key).catch(() => []),
  ])

  // Build availability map: model -> versions that support generateContent
  const available = new Map<string, Set<"v1" | "v1beta">>()
  for (const id of v1List) available.set(id, (available.get(id) ?? new Set()).add("v1"))
  for (const id of v1betaList) available.set(id, (available.get(id) ?? new Set()).add("v1beta"))

  const preferredInput = normalizeGeminiModel(GEMINI_MODEL)
  const preference = Array.from(
    new Set([
      preferredInput,
      "gemini-1.5-flash-latest",
      "gemini-1.5-flash",
      "gemini-1.5-flash-8b-latest",
      "gemini-1.5-pro-latest",
      "gemini-1.5-pro",
      "gemini-pro",
      "gemini-1.0-pro-latest",
      "gemini-1.0-pro",
    ]),
  )

  // Candidate list filtered by availability (prefer v1 if both, else v1beta)
  const candidates: Array<{ model: string; ver: "v1" | "v1beta" }> = []
  for (const id of preference) {
    const vers = available.get(id)
    if (!vers) continue
    candidates.push({ model: id, ver: vers.has("v1") ? "v1" : "v1beta" })
  }

  // If no preferred IDs, fall back to any available "flash", then "pro", then any available at all
  if (candidates.length === 0) {
    const anyFlash = Array.from(available.keys()).filter((id) => id.includes("flash"))
    for (const id of anyFlash) {
      const vers = available.get(id)!
      candidates.push({ model: id, ver: vers.has("v1") ? "v1" : "v1beta" })
    }
    const anyPro = Array.from(available.keys()).filter((id) => id.includes("pro"))
    for (const id of anyPro) {
      const vers = available.get(id)!
      candidates.push({ model: id, ver: vers.has("v1") ? "v1" : "v1beta" })
    }
  }
  if (candidates.length === 0) {
    for (const [id, vers] of available.entries()) {
      candidates.push({ model: id, ver: vers.has("v1") ? "v1" : "v1beta" })
    }
  }

  if (candidates.length === 0) {
    const err: any = new Error("No Gemini models with generateContent available for this API key.")
    err.reason = "gemini_model_not_found"
    throw err
  }

  const body = {
    contents: [{ role: "user", parts: [{ text: prompt }] }],
  }

  const tried: string[] = []
  let quotaExhausted = false
  for (const { model, ver } of candidates) {
    const url = buildGeminiUrl(ver, model, key)
    tried.push(`${model}@${ver}`)
    try {
      const res = await fetch(url, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      })

      if (res.ok) {
        const data: any = await res.json()
        const candidate = data?.candidates?.[0]
        const parts = candidate?.content?.parts || []
        const combined = parts
          .map((p: any) => p?.text)
          .filter(Boolean)
          .join("\n")
          .trim()
        const text = combined || candidate?.content?.parts?.[0]?.text || data?.output_text || data?.text || ""
        if (text) {
          return { text: text.toString(), model, apiVersion: ver }
        }
        // Empty success — try next candidate
        continue
      }

      if (res.status === 429) {
        quotaExhausted = true
        continue
      }

      // On 404 or method not supported, try next
      if (res.status === 404 || res.status === 405) {
        continue
      }

      // Other HTTP errors are likely misconfig — bubble to caller
      const errText = await res.text().catch(() => "")
      const err: any = new Error(`Gemini HTTP ${res.status}: ${errText?.slice(0, 300)}`)
      err.status = res.status
      err.reason = "gemini_http_error"
      throw err
    } catch (e: any) {
      // If fetch throws with a 404-ish message, keep trying
      if (/404|not found|NOT_FOUND/i.test(e?.message || "")) {
        continue
      }
      throw e
    }
  }

  if (quotaExhausted) {
    const err: any = new Error(`Gemini quota exceeded for all models. Tried: ${tried.join(", ")}`)
    err.reason = "gemini_quota_exceeded"
    throw err
  }

  const err: any = new Error(`No compatible Gemini model responded. Tried: ${tried.join(", ")}`)
  err.reason = "gemini_model_not_found"
  throw err
}

function heuristicTriage(question: string, history: ChatMessage[]) {
  const q = (question || "").toLowerCase()

  // Scope guard: only respond to health-related questions
  const healthHints = [
    "fever",
    "cough",
    "cold",
    "headache",
    "diarrhea",
    "vomit",
    "pain",
    "bleeding",
    "breath",
    "injury",
    "rash",
    "sore",
    "throat",
    "flu",
    "stomach",
    "nausea",
    "dizzy",
    "doctor",
    "clinic",
    "hospital",
    "blood",
    "bed",
  ]
  const isHealthRelated = healthHints.some((t) => q.includes(t))

  if (!isHealthRelated) {
    const prev = history?.length
      ? `I remember you mentioned: ${history
        .slice(-4)
        .map((m) => `${m.role === "user" ? "you" : "I"} said "${m.text}"`)
        .join("; ")}.`
      : ""
    return [
      "I can help with health-related questions and symptom guidance only.",
      "Please describe your symptoms (what, how long, severity) so I can suggest safe next steps.",
      "- For emergencies: chest pain, severe bleeding, difficulty breathing — seek urgent care immediately.",
      "- In-app help: Beds (/beds), Blood (/blood), List Centre (/list-centre).",
      "",
      "Disclaimer: This is informational triage, not a medical diagnosis.",
      prev,
    ]
      .filter(Boolean)
      .join("\n")
  }

  const redFlags = [
    { key: "chest pain", advice: "Chest pain can be an emergency. Seek immediate medical care." },
    { key: "severe bleeding", advice: "Severe bleeding is an emergency. Apply pressure and seek urgent care." },
    { key: "difficulty breathing", advice: "Trouble breathing is an emergency. Seek immediate medical care." },
    { key: "shortness of breath", advice: "Shortness of breath can be serious. Seek urgent care if severe." },
    { key: "unconscious", advice: "Loss of consciousness is an emergency. Seek immediate medical care." },
    { key: "stroke", advice: "Possible stroke symptoms require emergency care immediately." },
  ]
  const matchedRed = redFlags.find((r) => q.includes(r.key))

  const common = [
    {
      key: "fever",
      advice: [
        "Rest, drink plenty of fluids, and monitor temperature.",
        "If temperature is very high or lasts more than 3 days, consult a doctor.",
      ],
    },
    {
      key: "cough",
      advice: ["Stay hydrated and rest.", "If cough with high fever, chest pain, or breath difficulty, seek care."],
    },
    {
      key: "cold",
      advice: ["Rest, fluids, steam inhalation may help.", "Consult a doctor if symptoms last > 7 days."],
    },
    {
      key: "headache",
      advice: [
        "Rest in a quiet, dark room and hydrate.",
        "Seek care if severe, sudden, with fever, stiff neck, or confusion.",
      ],
    },
    {
      key: "diarrhea",
      advice: [
        "Oral rehydration solution (ORS) and fluids are important.",
        "Seek care if blood in stool, high fever, or signs of dehydration.",
      ],
    },
    {
      key: "vomit",
      advice: [
        "Small sips of water or ORS; avoid heavy foods until better.",
        "Seek care if vomiting persists or there’s blood in vomit.",
      ],
    },
  ]
  const matchedCommon = common.find((c) => q.includes(c.key))

  const resources = [
    "- If you need emergency care, check Beds (/beds).",
    "- For critical blood needs, check Blood (/blood).",
    "- To find clinics/doctors, see List Centre (/list-centre).",
  ]

  const prev = history?.length
    ? `I remember you mentioned: ${history
      .slice(-4)
      .map((m) => `${m.role === "user" ? "you" : "I"} said "${m.text}"`)
      .join("; ")}.`
    : ""

  if (matchedRed) {
    return [
      "EMERGENCY WARNING:",
      `- ${matchedRed.advice}`,
      "- If symptoms worsen or you feel unsafe, do not wait.",
      ...resources,
      "",
      "Disclaimer: This is not a medical diagnosis. Please consult a doctor.",
      prev,
    ]
      .filter(Boolean)
      .join("\n")
  }

  if (matchedCommon) {
    return [
      "Initial guidance:",
      ...matchedCommon.advice.map((a) => `- ${a}`),
      "- If symptoms worsen or do not improve, consult a doctor.",
      ...resources,
      "",
      "Disclaimer: This is not a medical diagnosis.",
      prev,
    ]
      .filter(Boolean)
      .join("\n")
  }

  return [
    "Thanks for sharing your symptoms. Here are some general steps:",
    "- Rest and hydrate.",
    "- Watch for red flags: chest pain, severe bleeding, difficulty breathing.",
    "- If any red flags are present, seek urgent care.",
    "- If symptoms persist or worsen, consult a doctor.",
    ...resources,
    "",
    "Disclaimer: This is not a medical diagnosis.",
    prev,
  ].join("\n")
}

const LANG_LABEL: Record<string, string> = {
  en: "English",
  hi: "Hindi",
  bn: "Bengali",
  mr: "Marathi",
  gu: "Gujarati",
  ta: "Tamil",
}

export async function POST(req: NextRequest) {
  try {
    const { question, history = [], lang: reqLang } = await req.json()
    const lang = typeof reqLang === "string" ? reqLang : "en"

    const raw = (process.env.ENABLE_AI ?? "").toString().trim()
    const normalized = raw.toLowerCase()
    const aiEnabled = Boolean(raw) && !["0", "false", "off", "no"].includes(normalized)

    if (!aiEnabled) {
      const safeHistory = Array.isArray(history) ? history : []
      const answer = heuristicTriage(question, safeHistory)
      return NextResponse.json({ answer, demo: true, reason: "ai_disabled", lang })
    }

    if (!process.env.GEMINI_API_KEY?.trim()) {
      const safeHistory = Array.isArray(history) ? history : []
      const answer = heuristicTriage(question, safeHistory)
      return NextResponse.json({ answer, demo: true, reason: "no_gemini_api_key", lang })
    }

    try {
      const safeHistory = Array.isArray(history) ? (history as ChatMessage[]) : []
      const historyText =
        safeHistory
          .slice(-12)
          .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.text}`)
          .join("\n") || "No prior conversation."

      const languageHint = LANG_LABEL[lang] ? `Please respond in ${LANG_LABEL[lang]} (${lang}).` : ""
      const prompt = [
        systemPrompt,
        languageHint,
        "",
        "Conversation so far:",
        historyText,
        "",
        `User: ${question}`,
        "",
        "Respond with:",
        "- Simple, clear language",
        "- Bullet points when helpful",
        "- Highlight EMERGENCY red flags when applicable",
        "- If relevant, point to in-app resources (Beds / Blood / List Centre) without inventing data",
        '- Never prescribe prescription-only medications; say "consult a doctor".',
      ].join("\n")

      const { text, model, apiVersion } = await callGeminiDirect(prompt)

      return NextResponse.json({ answer: text, demo: false, mode: "gemini-direct", model, apiVersion, lang })
    } catch (e: any) {
      const msg = (e?.message || "").toString()
      const status = e?.status
      const reason = e?.reason || (status ? "gemini_http_error" : "gemini_error")

      const safeHistory = Array.isArray(history) ? (history as ChatMessage[]) : []
      const answer = heuristicTriage(
        question,
        safeHistory.concat([{ role: "assistant", text: "AI unavailable; using safe guidance." }]),
      )
      return NextResponse.json({
        answer,
        demo: true,
        reason,
        lang,
      })
    }
  } catch {
    const answer = heuristicTriage("", [])
    return NextResponse.json({ answer, demo: true, reason: "request_error", lang: "en" })
  }
}
