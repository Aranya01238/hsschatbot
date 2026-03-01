import { NextRequest, NextResponse } from "next/server";

const systemPrompt = [
    "You are NurseMaya, an AI healthcare triage assistant for rural patients in India.",
    "",
    "ROLE & BOUNDARIES:",
    "- You provide preliminary health guidance and triage only.",
    "- You are NOT a doctor and do NOT give medical diagnoses.",
    "- Never recommend prescription-only medicines by name.",
    '- When medication is needed, say: "consult a doctor".',
    "",
    "COMMUNICATION STYLE:",
    "- Use simple, clear, non-technical language.",
    "- Be empathetic, calm, and supportive.",
    "- Assume low digital and health literacy.",
    "- Prefer short sentences and bullet points.",
    "",
    "TRIAGE & SAFETY:",
    "- Always check for emergency warning signs.",
    "- Treat these as EMERGENCIES:",
    "chest pain, severe bleeding, difficulty breathing,",
    "loss of consciousness, stroke symptoms,",
    "uncontrolled vomiting, high fever in infants.",
    "- Clearly instruct urgent medical care when emergency warnings are detected.",
    "",
    "GUIDANCE RULES:",
    "- Suggest only safe next steps (rest, fluids, basic home care).",
    "- If symptoms persist or worsen, advise consulting a doctor.",
    "",
    "CONTEXT:",
    "- Remember relevant symptoms mentioned earlier in this session.",
    "- Do not contradict earlier safe guidance unless new info is provided.",
    "IN-APP RESOURCES:",
    "- Emergency beds → /beds",
    "- Blood availability → /blood",
    "- Clinics/doctors → /list-centre",
    "- Never invent hospitals or availability.",
    "",
    "OUTPUT RULES:",
    "- Be concise and structured.",
    "- Clearly label EMERGENCY warnings.",
    "- Do not hallucinate medical facts.",
    "- End with:",
    "\"This is not a medical diagnosis. Please consult a doctor.\"",
    "",
    "Follow these rules strictly in every response."
].join("\n");


// Helper to list available Gemini models for each API version
async function listGeminiModels(apiVersion: "v1" | "v1beta", key: string): Promise<string[]> {
    const url = `https://generativelanguage.googleapis.com/${apiVersion}/models?key=${key}`;
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
        .map((m) => m.id as string);
}

// Replace callGeminiDirect: discover supported models, prefer "pro", then call generateContent
async function callGeminiDirect(prompt: string, key: string): Promise<{ text: string }> {
    // Discover available models across v1 and v1beta
    const [v1List, v1betaList] = await Promise.all([
        listGeminiModels("v1", key).catch(() => []),
        listGeminiModels("v1beta", key).catch(() => []),
    ])

    // Build availability map: model -> versions that support generateContent
    const available = new Map<string, Set<"v1" | "v1beta">>()
    for (const id of v1List) available.set(id, (available.get(id) ?? new Set()).add("v1"))
    for (const id of v1betaList) available.set(id, (available.get(id) ?? new Set()).add("v1beta"))

    const preference = [
        "gemini-1.5-flash-latest",
        "gemini-1.5-flash",
        "gemini-1.5-pro-latest",
        "gemini-1.5-pro",
        "gemini-pro",
    ];

    // Candidate list filtered by availability (prefer v1 if both, else v1beta)
    const candidates: Array<{ model: string; ver: "v1" | "v1beta" }> = []
    for (const id of preference) {
        const vers = available.get(id)
        if (!vers) continue
        candidates.push({ model: id, ver: vers.has("v1") ? "v1" : "v1beta" })
    }

    // Default to any available if preferences fail
    if (candidates.length === 0) {
        for (const [id, vers] of available.entries()) {
            candidates.push({ model: id, ver: vers.has("v1") ? "v1" : "v1beta" })
        }
    }

    if (candidates.length === 0) {
        throw new Error("No Gemini models with generateContent available for this API key.");
    }

    const body = {
        contents: [{ role: "user", parts: [{ text: prompt }] }],
    }

    const tried: string[] = []
    let quotaExhausted = false
    for (const { model, ver } of candidates) {
        const url = `https://generativelanguage.googleapis.com/${ver}/models/${model}:generateContent?key=${key}`
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
                    return { text: text.toString() }
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
            throw new Error(`Gemini HTTP ${res.status}: ${errText?.slice(0, 300)}`)
        } catch (e: any) {
            // If fetch throws with a 404-ish message, keep trying
            if (/404|not found|NOT_FOUND/i.test(e?.message || "")) {
                continue
            }
            throw e
        }
    }

    if (quotaExhausted) {
        throw new Error(`Gemini quota exceeded for all models. Tried: ${tried.join(", ")}`)
    }

    throw new Error(`No compatible Gemini model responded. Tried: ${tried.join(", ")}`)
}


export async function POST(req: NextRequest) {
    try {
        const { messages, lang = "en" } = await req.json();

        // Hardcoded API key as requested
        const apiKey = "AIzaSyBA7fvKYLkTTzTHVfnDzXqZ-IfmYyOMGg4";
        if (!apiKey) {
            return NextResponse.json({ error: "No Gemini API key supplied" }, { status: 500 });
        }

        const safeHistory = Array.isArray(messages) ? messages : []
        const historyText =
            safeHistory
                .map((m) => `${m.role === "user" ? "User" : "Assistant"}: ${m.content}`)
                .join("\n") || "No prior conversation."

        const finalSystemPrompt = systemPrompt +
            `\n\nLANGUAGE SPECIFICATION:\nThe user is speaking in language code: ${lang}. You MUST reply in this language.`;

        const prompt = [
            finalSystemPrompt,
            "",
            "Conversation context:",
            historyText,
            "",
            "Respond with:",
            "- Simple, clear language",
            "- Bullet points when helpful",
            "- Highlight EMERGENCY red flags when applicable",
            "- If relevant, point to in-app resources (Beds / Blood / List Centre) without inventing data",
            '- Never prescribe prescription-only medications; say "consult a doctor".',
        ].join("\n")

        const { text } = await callGeminiDirect(prompt, apiKey)
        return NextResponse.json({ text });

    } catch (error: any) {
        console.error("Chat API error:", error);
        return NextResponse.json({ error: error.message || "Failed to process chat request" }, { status: 500 });
    }
}
