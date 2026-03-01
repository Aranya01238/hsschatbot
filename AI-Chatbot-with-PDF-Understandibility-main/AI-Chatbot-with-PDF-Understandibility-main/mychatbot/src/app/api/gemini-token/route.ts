import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    try {
        // Hardcoded API key as requested
        const apiKey = "AIzaSyBA7fvKYLkTTzTHVfnDzXqZ-IfmYyOMGg4";
        if (!apiKey) {
            return NextResponse.json({ error: "No Gemini API key supplied" }, { status: 500 });
        }

        // In a production app, use an Ephemeral Token here!
        // For this demonstration project, we are passing the raw API key to the client
        // securely via this proxy endpoint rather than hardcoding it into NEXT_PUBLIC.
        return NextResponse.json({ token: apiKey });
    } catch (error) {
        console.error("Gemini Live Auth error:", error);
        return NextResponse.json({ error: "Failed to generate token" }, { status: 500 });
    }
}
