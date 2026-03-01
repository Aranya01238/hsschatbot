import { NextRequest, NextResponse } from "next/server";
import pdf from "pdf-parse";

// 2MB Limit
const MAX_FILE_SIZE = 2 * 1024 * 1024;

export async function POST(req: NextRequest) {
    try {
        const formData = await req.formData();
        const file = formData.get("file") as File | null;

        if (!file) {
            return NextResponse.json({ error: "No file provided" }, { status: 400 });
        }

        if (file.type !== "application/pdf") {
            return NextResponse.json({ error: "Invalid file type. Only PDF is allowed." }, { status: 400 });
        }

        if (file.size > MAX_FILE_SIZE) {
            return NextResponse.json({ error: "File too large. Maximum size is 2MB." }, { status: 400 });
        }

        const arrayBuffer = await file.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        const pdfData = await pdf(buffer);

        // Clean formatting and chunk if necessary
        const cleanText = pdfData.text
            .replace(/\n+/g, " ")
            .replace(/\s+/g, " ")
            .trim();

        const truncatedText = cleanText.substring(0, 15000);

        return NextResponse.json({ text: truncatedText, numPages: pdfData.numpages });
    } catch (error) {
        console.error("PDF parse error:", error);
        return NextResponse.json({ error: "Failed to parse PDF" }, { status: 500 });
    }
}
