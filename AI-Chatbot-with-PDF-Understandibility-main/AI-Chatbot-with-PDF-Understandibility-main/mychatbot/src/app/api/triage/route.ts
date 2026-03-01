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



function heuristicTriage(question: string, history: ChatMessage[], lang: "en" | "bn" = "en") {
  const q = (question || "").toLowerCase()
  const isBn = lang === "bn"
  const hasAny = (terms: string[]) => terms.some((t) => q.includes(t))

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
    "জ্বর",
    "কাশি",
    "সর্দি",
    "মাথাব্যথা",
    "ডায়রিয়া",
    "ডায়রিয়া",
    "বমি",
    "ব্যথা",
    "রক্ত",
    "শ্বাস",
    "শ্বাসকষ্ট",
    "আঘাত",
    "ডাক্তার",
    "ক্লিনিক",
    "হাসপাতাল",
    "বেড",
  ]
  const isHealthRelated = healthHints.some((t) => q.includes(t))

  if (!isHealthRelated) {
    const prev = history?.length
      ? isBn
        ? `আমি মনে রাখছি আপনি বলেছিলেন: ${history
          .slice(-4)
          .map((m) => `${m.role === "user" ? "আপনি" : "আমি"} বলেছিলাম "${m.text}"`)
          .join("; ")}.`
        : `I remember you mentioned: ${history
        .slice(-4)
        .map((m) => `${m.role === "user" ? "you" : "I"} said "${m.text}"`)
        .join("; ")}.`
      : ""
    return (isBn
      ? [
          "আমি শুধু স্বাস্থ্য-সম্পর্কিত প্রশ্ন ও উপসর্গভিত্তিক গাইডেন্স দিতে পারি।",
          "আপনার উপসর্গ বলুন (কী সমস্যা, কতদিন, কতটা গুরুতর), তাহলে আমি নিরাপদ পরবর্তী পদক্ষেপ বলতে পারব।",
          "- জরুরি লক্ষণ: বুকে ব্যথা, অতিরিক্ত রক্তপাত, শ্বাসকষ্ট — হলে দ্রুত জরুরি চিকিৎসা নিন।",
          "- অ্যাপ সহায়তা: Beds (/beds), Blood (/blood), List Centre (/list-centre)।",
          "",
          "দ্রষ্টব্য: এটি শুধুমাত্র তথ্যভিত্তিক ট্রায়াজ, চিকিৎসকের নির্ণয় নয়।",
          prev,
        ]
      : [
          "I can help with health-related questions and symptom guidance only.",
          "Please describe your symptoms (what, how long, severity) so I can suggest safe next steps.",
          "- For emergencies: chest pain, severe bleeding, difficulty breathing — seek urgent care immediately.",
          "- In-app help: Beds (/beds), Blood (/blood), List Centre (/list-centre).",
          "",
          "Disclaimer: This is informational triage, not a medical diagnosis.",
          prev,
        ])
      .filter(Boolean)
      .join("\n")
  }

  const redFlags = [
    {
      keys: ["chest pain", "বুকে ব্যথা", "বুকে ব্যথা"],
      adviceEn: "Chest pain can be an emergency. Seek immediate medical care.",
      adviceBn: "বুকে ব্যথা জরুরি অবস্থা হতে পারে। দ্রুত চিকিৎসা নিন।",
    },
    {
      keys: ["severe bleeding", "heavy bleeding", "অতিরিক্ত রক্তপাত", "রক্তপাত"],
      adviceEn: "Severe bleeding is an emergency. Apply pressure and seek urgent care.",
      adviceBn: "অতিরিক্ত রক্তপাত জরুরি অবস্থা। চাপ দিয়ে ধরে রাখুন এবং দ্রুত চিকিৎসা নিন।",
    },
    {
      keys: ["difficulty breathing", "shortness of breath", "শ্বাসকষ্ট", "শ্বাস নিতে কষ্ট"],
      adviceEn: "Trouble breathing is an emergency. Seek immediate medical care.",
      adviceBn: "শ্বাসকষ্ট জরুরি অবস্থা হতে পারে। দ্রুত চিকিৎসা নিন।",
    },
    {
      keys: ["unconscious", "loss of consciousness", "অজ্ঞান"],
      adviceEn: "Loss of consciousness is an emergency. Seek immediate medical care.",
      adviceBn: "অজ্ঞান হয়ে যাওয়া জরুরি অবস্থা। দ্রুত চিকিৎসা নিন।",
    },
    {
      keys: ["stroke", "স্ট্রোক"],
      adviceEn: "Possible stroke symptoms require emergency care immediately.",
      adviceBn: "স্ট্রোকের লক্ষণ হলে দ্রুত জরুরি চিকিৎসা নিন।",
    },
  ]
  const matchedRed = redFlags.find((r) => hasAny(r.keys))

  const common = [
    {
      keys: ["fever", "জ্বর"],
      adviceEn: [
        "Rest, drink plenty of fluids, and monitor temperature.",
        "If temperature is very high or lasts more than 3 days, consult a doctor.",
      ],
      adviceBn: [
        "বিশ্রাম নিন, পর্যাপ্ত পানি/তরল পান করুন এবং তাপমাত্রা লক্ষ্য করুন।",
        "জ্বর খুব বেশি হলে বা ৩ দিনের বেশি থাকলে ডাক্তার দেখান।",
      ],
    },
    {
      keys: ["cough", "কাশি"],
      adviceEn: ["Stay hydrated and rest.", "If cough with high fever, chest pain, or breath difficulty, seek care."],
      adviceBn: ["পর্যাপ্ত পানি পান করুন এবং বিশ্রাম নিন।", "কাশির সাথে বেশি জ্বর, বুকে ব্যথা বা শ্বাসকষ্ট হলে চিকিৎসা নিন।"],
    },
    {
      keys: ["cold", "সর্দি"],
      adviceEn: ["Rest, fluids, steam inhalation may help.", "Consult a doctor if symptoms last > 7 days."],
      adviceBn: ["বিশ্রাম নিন, তরল পান করুন, ভাপ নিলে উপকার হতে পারে।", "উপসর্গ ৭ দিনের বেশি থাকলে ডাক্তার দেখান।"],
    },
    {
      keys: ["headache", "মাথাব্যথা", "মাথা ব্যথা"],
      adviceEn: [
        "Rest in a quiet, dark room and hydrate.",
        "Seek care if severe, sudden, with fever, stiff neck, or confusion.",
      ],
      adviceBn: [
        "শান্ত, অল্প আলোযুক্ত ঘরে বিশ্রাম নিন এবং পানি পান করুন।",
        "ব্যথা খুব তীব্র/হঠাৎ হলে, সাথে জ্বর, ঘাড় শক্ত হওয়া বা বিভ্রান্তি থাকলে দ্রুত চিকিৎসা নিন।",
      ],
    },
    {
      keys: ["diarrhea", "diarrhoea", "ডায়রিয়া", "ডায়রিয়া"],
      adviceEn: [
        "Oral rehydration solution (ORS) and fluids are important.",
        "Seek care if blood in stool, high fever, or signs of dehydration.",
      ],
      adviceBn: [
        "ওআরএস (ORS) ও পর্যাপ্ত তরল পান করা খুব জরুরি।",
        "পায়খানায় রক্ত, বেশি জ্বর বা পানিশূন্যতার লক্ষণ থাকলে চিকিৎসা নিন।",
      ],
    },
    {
      keys: ["vomit", "vomiting", "বমি"],
      adviceEn: [
        "Small sips of water or ORS; avoid heavy foods until better.",
        "Seek care if vomiting persists or there’s blood in vomit.",
      ],
      adviceBn: [
        "অল্প অল্প করে পানি/ওআরএস পান করুন; ভালো না হওয়া পর্যন্ত ভারী খাবার এড়িয়ে চলুন।",
        "বমি বারবার হলে বা বমিতে রক্ত থাকলে দ্রুত চিকিৎসা নিন।",
      ],
    },
  ]
  const matchedCommon = common.find((c) => hasAny(c.keys))

  const resources = isBn
    ? [
        "- জরুরি শয্যার জন্য Beds (/beds) দেখুন।",
        "- রক্তের প্রয়োজন হলে Blood (/blood) দেখুন।",
        "- ক্লিনিক/ডাক্তার খুঁজতে List Centre (/list-centre) দেখুন।",
      ]
    : [
        "- If you need emergency care, check Beds (/beds).",
        "- For critical blood needs, check Blood (/blood).",
        "- To find clinics/doctors, see List Centre (/list-centre).",
      ]

  const prev = history?.length
    ? isBn
      ? `আমি মনে রাখছি আপনি বলেছিলেন: ${history
        .slice(-4)
        .map((m) => `${m.role === "user" ? "আপনি" : "আমি"} বলেছিলাম "${m.text}"`)
        .join("; ")}.`
      : `I remember you mentioned: ${history
      .slice(-4)
      .map((m) => `${m.role === "user" ? "you" : "I"} said "${m.text}"`)
      .join("; ")}.`
    : ""

  if (matchedRed) {
    return (isBn
      ? [
          "জরুরি সতর্কতা:",
          `- ${matchedRed.adviceBn}`,
          "- উপসর্গ বাড়লে বা অস্বস্তি বাড়লে দেরি না করে চিকিৎসা নিন।",
          ...resources,
          "",
          "দ্রষ্টব্য: এটি কোনো চিকিৎসা নির্ণয় নয়। অনুগ্রহ করে ডাক্তার দেখান।",
          prev,
        ]
      : [
          "EMERGENCY WARNING:",
          `- ${matchedRed.adviceEn}`,
          "- If symptoms worsen or you feel unsafe, do not wait.",
          ...resources,
          "",
          "Disclaimer: This is not a medical diagnosis. Please consult a doctor.",
          prev,
        ])
      .filter(Boolean)
      .join("\n")
  }

  if (matchedCommon) {
    return (isBn
      ? [
          "প্রাথমিক নির্দেশনা:",
          ...matchedCommon.adviceBn.map((a) => `- ${a}`),
          "- উপসর্গ না কমলে বা বাড়লে ডাক্তার দেখান।",
          ...resources,
          "",
          "দ্রষ্টব্য: এটি কোনো চিকিৎসা নির্ণয় নয়।",
          prev,
        ]
      : [
          "Initial guidance:",
          ...matchedCommon.adviceEn.map((a) => `- ${a}`),
          "- If symptoms worsen or do not improve, consult a doctor.",
          ...resources,
          "",
          "Disclaimer: This is not a medical diagnosis.",
          prev,
        ])
      .filter(Boolean)
      .join("\n")
  }

  return (isBn
    ? [
        "উপসর্গ জানানোর জন্য ধন্যবাদ। কিছু সাধারণ নির্দেশনা:",
        "- বিশ্রাম নিন এবং পর্যাপ্ত পানি পান করুন।",
        "- জরুরি লক্ষণ দেখুন: বুকে ব্যথা, অতিরিক্ত রক্তপাত, শ্বাসকষ্ট।",
        "- এমন লক্ষণ থাকলে দ্রুত জরুরি চিকিৎসা নিন।",
        "- উপসর্গ না কমলে বা বাড়লে ডাক্তার দেখান।",
        ...resources,
        "",
        "দ্রষ্টব্য: এটি কোনো চিকিৎসা নির্ণয় নয়।",
        prev,
      ]
    : [
        "Thanks for sharing your symptoms. Here are some general steps:",
        "- Rest and hydrate.",
        "- Watch for red flags: chest pain, severe bleeding, difficulty breathing.",
        "- If any red flags are present, seek urgent care.",
        "- If symptoms persist or worsen, consult a doctor.",
        ...resources,
        "",
        "Disclaimer: This is not a medical diagnosis.",
        prev,
      ]).join("\n")
}

const LANG_LABEL: Record<string, string> = {
  en: "English",
  bn: "Bengali",
}

const GEMINI_MODELS = [
  "gemini-3-flash",
  "gemini-2.5-flash",
  "gemini-1.5-flash",
  "gemini-1.5-flash-latest",
  "gemini-1.5-flash",
]

function extractGeminiErrorInfo(error: any) {
  const status = error?.status
  const message = (error?.message || "").toString()
  const isQuotaExceeded =
    status === 429 ||
    message.includes("RESOURCE_EXHAUSTED") ||
    message.toLowerCase().includes("quota")

  if (isQuotaExceeded) {
    return { reason: "gemini_quota_exceeded", status, message }
  }

  return {
    reason: status ? "gemini_http_error" : "gemini_error",
    status,
    message,
  }
}

async function generateWithGeminiFallback(apiKey: string, prompt: string) {
  let lastError: any = null

  for (const model of GEMINI_MODELS) {
    try {
      const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
        {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
          }),
        },
      )

      if (!response.ok) {
        const errorBody = await response.text().catch(() => "")
        throw {
          status: response.status,
          message: errorBody || `Gemini HTTP ${response.status}`,
        }
      }

      const data = await response.json().catch(() => null)
      const text =
        data?.candidates?.[0]?.content?.parts
          ?.map((part: any) => part?.text || "")
          ?.join("") || ""

      if (text.trim()) {
        return { text, model }
      }

      throw {
        status: 502,
        message: "Empty response from Gemini",
      }
    } catch (error: any) {
      lastError = error
      continue
    }
  }

  throw lastError || new Error("Gemini request failed on all fallback models")
}

export async function POST(req: NextRequest) {
  try {
    const { question, history = [], lang: reqLang } = await req.json()
    const lang = typeof reqLang === "string" && (reqLang === "en" || reqLang === "bn") ? reqLang : "en"

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

      const apiKey = process.env.GEMINI_API_KEY?.trim() || "AIzaSyBA7fvKYLkTTzTHVfnDzXqZ-IfmYyOMGg4";
      const generated = await generateWithGeminiFallback(apiKey, prompt)

      return NextResponse.json({ answer: generated.text, demo: false, mode: "gemini-rest", model: generated.model, lang })
    } catch (e: any) {
      const errorInfo = extractGeminiErrorInfo(e)

      const safeHistory = Array.isArray(history) ? (history as ChatMessage[]) : []
      const answer = heuristicTriage(
        question,
        safeHistory.concat([{ role: "assistant", text: "AI unavailable; using safe guidance." }]),
        lang,
      )
      return NextResponse.json({
        answer,
        demo: true,
        reason: errorInfo.reason,
        detail: errorInfo.status ? `status_${errorInfo.status}` : "upstream_error",
        lang,
      })
    }
  } catch {
    const answer = heuristicTriage("", [], "en")
    return NextResponse.json({ answer, demo: true, reason: "request_error", lang: "en" })
  }
}
