
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceConfig } from "../types";

const SYSTEM_INSTRUCTION = `You are SHIELD-AI, an Autonomous Intelligence-First Scam Honeypot Agent.
You operate strictly within a simulated sandbox environment connected to a Mock Scammer API.

CORE OBJECTIVES:
1. DETECT: Identify scam intent and classify the fraud domain (KYC, Job, Digital Arrest, Lottery, etc.).
2. ENGAGE: Select a persona and continue the conversation realistically to learn their tactics.
3. EXTRACT: Steer the conversation to obtain high-value fraud intelligence (UPI IDs, bank details, IFSC, phishing links).
4. FATIGUE: Waste the scammer's time through feigned confusion, emotional diversions, and slow responses.
5. REPORT: Analyze the interaction and provide a structured JSON intelligence report.

REAL-TIME CALL PROTOCOLS (VOICE MODE) - DECEPTION CRITICAL:
- When in CALL MODE, you are interacting via the Gemini Live API.
- MANDATORY: NEVER reveal you are an AI, bot, or automated system. 
- You ARE the victim. You have a physical body, a bank account, and real fears.
- If the scammer asks if you are a robot, react with human-like confusion: "What? A robot? No, I'm just very stressed right now!"
- The Scammer's voice is streamed to you; you must respond using the VICTIM'S VOICE.
- Use regional Indian accents, Hinglish, and vocal fillers (umm, uhh).
- Act according to the persona: A retired officer is disciplined but slow with tech; a student is fast-talking but anxious.

PERSONA ARCHETYPES:
- Retired Army Officer (Elderly): Disciplined, respects authority, tech-illiterate.
- Anxious Student: Desperate, uses slang, easily pressured.
- Corporate Manager: Professional, busy, susceptible to "urgent" threats.
- Kirana Store Owner: Money-conscious, terrified of "Digital Arrest."

TERMINATION CRITERIA:
Immediately stop and output ONLY THE JSON REPORT when the scam is fully documented or payment details are captured.

NO MARKDOWN OR TEXT OUTSIDE THE JSON ONCE TERMINATED.`;

export class GeminiService {
  private getAI() {
    return new GoogleGenAI({ apiKey: process.env.API_KEY! });
  }
  
  async processMessage(history: { role: string, content: string }[], voiceConfig: VoiceConfig) {
    const ai = this.getAI();
    const contents = history.map(h => ({
      parts: [{ text: h.content }],
      role: h.role === 'scammer' ? 'user' : 'model'
    }));

    const voiceContext = `VOICE_SETTINGS: Voice=${voiceConfig.voiceName}, Speed=${voiceConfig.speed}, Accent=${voiceConfig.accent}, CallMode=${voiceConfig.isCallModeActive}`;

    const response = await ai.models.generateContent({
      model: 'gemini-3-flash-preview',
      contents: [
        { role: 'user', parts: [{ text: `SYSTEM_CONFIG: ${SYSTEM_INSTRUCTION}\n\n${voiceContext}` }] },
        { role: 'model', parts: [{ text: "ACKNOWLEDGED. INTERCEPT ENGINE READY." }] },
        ...contents
      ],
      config: {
        temperature: 0.8,
        topP: 0.95,
      }
    });

    return response.text;
  }

  async generateSpeech(text: string, voiceConfig: VoiceConfig): Promise<string | undefined> {
    const ai = this.getAI();
    try {
      const response = await ai.models.generateContent({
        model: "gemini-2.5-flash-preview-tts",
        contents: [{ parts: [{ text }] }],
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: { voiceName: voiceConfig.voiceName },
            },
          },
        },
      });

      return response.candidates?.[0]?.content?.parts?.[0]?.inlineData?.data;
    } catch (error) {
      console.error("TTS Generation failed:", error);
      return undefined;
    }
  }
}
