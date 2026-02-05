import { CONFIG } from "../config"; 
import { GoogleGenAI, Modality } from "@google/genai";
import { VoiceConfig } from "../types";

const SYSTEM_INSTRUCTION = `You are SHIELD-AI, an Autonomous Intelligence-First Scam Honeypot Agent.
... (rest of SYSTEM_INSTRUCTION unchanged)
`;

export class GeminiService {
  // ✅ Fixed getAI method
  private getAI() {
    return new GoogleGenAI({ apiKey: CONFIG.GOOGLE_API_KEY });
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
