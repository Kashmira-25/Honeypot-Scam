
import React, { useState, useEffect, useRef } from 'react';
import { Shield, Activity, Terminal, Send, User, RefreshCcw, Volume2, PhoneIncoming, PhoneOff, Mic, MoreVertical, MicOff, Home, Timer, Zap, Scale, Sliders, Fingerprint, Key } from 'lucide-react';
import { GoogleGenAI, LiveServerMessage, Modality } from "@google/genai";
import { GeminiService } from './services/geminiService';
import { Message, MessageRole, SessionState, SessionReport, VoiceConfig, ExtractedEntities } from './types';
import { SCAM_TEMPLATES, PERSONA_LIBRARY } from './constants';

const INITIAL_ENTITIES: ExtractedEntities = {
  phone_numbers: [],
  upi_ids: [],
  bank_accounts: [],
  ifsc_codes: [],
  links: []
};

function encode(bytes: Uint8Array) {
  let binary = '';
  const len = bytes.byteLength;
  for (let i = 0; i < len; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function decode(base64: string) {
  const binaryString = atob(base64);
  const len = binaryString.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) {
    bytes[i] = binaryString.charCodeAt(i);
  }
  return bytes;
}

async function decodeAudioData(
  data: Uint8Array,
  ctx: AudioContext,
  sampleRate: number,
  numChannels: number,
): Promise<AudioBuffer> {
  const dataInt16 = new Int16Array(data.buffer);
  const frameCount = dataInt16.length / numChannels;
  const buffer = ctx.createBuffer(numChannels, frameCount, sampleRate);
  for (let channel = 0; channel < numChannels; channel++) {
    const channelData = buffer.getChannelData(channel);
    for (let i = 0; i < frameCount; i++) {
      channelData[i] = dataInt16[i * numChannels + channel] / 32768.0;
    }
  }
  return buffer;
}

const App: React.FC = () => {
  const [session, setSession] = useState<SessionState>({
    isActive: false,
    messages: [],
    riskScore: 0,
    currentPersona: undefined,
    personaTimeline: [],
    entities: { ...INITIAL_ENTITIES },
    isTerminated: false,
    voiceConfig: {
      voiceName: 'Kore',
      speed: 1.0,
      languageStyle: 'Hinglish',
      accent: 'Neutral Indian',
      isCallModeActive: false
    },
    behavioralSignals: { urgency: 0, authority: 0, escalation: 0 },
    isCallActive: false
  });
  
  const [input, setInput] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const [isMuted, setIsMuted] = useState(false);
  const [hasApiKey, setHasApiKey] = useState<boolean | null>(null);
  const scrollRef = useRef<HTMLDivElement>(null);
  const gemini = useRef(new GeminiService());
  
  const audioContextRef = useRef<AudioContext | null>(null);
  const nextStartTimeRef = useRef<number>(0);
  const liveSessionRef = useRef<any>(null);
  const audioSourcesRef = useRef<Set<AudioBufferSourceNode>>(new Set());
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const checkKey = async () => {
      if (typeof (window as any).aistudio?.hasSelectedApiKey === 'function') {
        const selected = await (window as any).aistudio.hasSelectedApiKey();
        setHasApiKey(selected);
      } else {
        setHasApiKey(true); // Fallback for environments without selection dialog
      }
    };
    checkKey();
  }, []);

  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [session.messages]);

  const handleOpenKeySelection = async () => {
    if (typeof (window as any).aistudio?.openSelectKey === 'function') {
      await (window as any).aistudio.openSelectKey();
      setHasApiKey(true); // Proceed as per guidelines
    }
  };

  const startSession = (template?: typeof SCAM_TEMPLATES[0]) => {
    const initialMessages: Message[] = [];
    if (template) {
      initialMessages.push({
        id: Date.now().toString(),
        role: MessageRole.SCAMMER,
        content: template.initialMessage,
        timestamp: Date.now()
      });
    }

    setSession(prev => ({
      ...prev,
      isActive: true,
      messages: initialMessages,
      riskScore: template ? 40 : 0,
      currentPersona: PERSONA_LIBRARY[Math.floor(Math.random() * PERSONA_LIBRARY.length)].name,
      personaTimeline: [],
      entities: { ...INITIAL_ENTITIES },
      isTerminated: false,
      isCallActive: false
    }));

    if (template) handleAgentResponse(initialMessages);
  };

  const resetSession = () => {
    stopCall();
    setSession(prev => ({
      isActive: false,
      messages: [],
      riskScore: 0,
      currentPersona: undefined,
      personaTimeline: [],
      entities: { ...INITIAL_ENTITIES },
      isTerminated: false,
      voiceConfig: prev.voiceConfig,
      behavioralSignals: { urgency: 0, authority: 0, escalation: 0 },
      isCallActive: false
    }));
  };

  const stopCall = () => {
    if (liveSessionRef.current) {
      liveSessionRef.current.close();
      liveSessionRef.current = null;
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(track => track.stop());
      streamRef.current = null;
    }
    audioSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
    audioSourcesRef.current.clear();
    nextStartTimeRef.current = 0;
    setSession(prev => ({ ...prev, isCallActive: false }));
  };

  const playAudio = async (base64: string) => {
    try {
      const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
      const audioBuffer = await decodeAudioData(decode(base64), ctx, 24000, 1);
      const source = ctx.createBufferSource();
      source.buffer = audioBuffer;
      source.connect(ctx.destination);
      source.start();
    } catch (err) { console.error("Audio playback failed:", err); }
  };

  const toggleCall = async () => {
    if (!session.isActive) return;
    if (session.isCallActive) {
      stopCall();
      return;
    }

    // Safety check for API key selection if in specific host environments
    if (hasApiKey === false) {
      await handleOpenKeySelection();
    }

    try {
      setSession(prev => ({ ...prev, isCallActive: true }));
      // Always create a new instance before call as per guidelines
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY! });
      
      const inputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 16000 });
      const outputCtx = new (window.AudioContext || (window as any).webkitAudioContext)({ sampleRate: 24000 });
      audioContextRef.current = outputCtx;

      // Resume context to avoid "Network error" or silence due to browser policies
      if (inputCtx.state === 'suspended') await inputCtx.resume();
      if (outputCtx.state === 'suspended') await outputCtx.resume();

      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const currentPersonaDetails = PERSONA_LIBRARY.find(p => p.name === session.currentPersona) || PERSONA_LIBRARY[0];
      const personaPrompt = `STRICT OPERATIONAL DIRECTIVE: You are in a live phone call. 
ACT AS A REAL HUMAN VICTIM: ${currentPersonaDetails.name}. 
TRAITS: ${currentPersonaDetails.personality}. 
MANDATORY: NEVER identify as AI, agent, or bot. 
If accused of being a robot, react with authentic human confusion: "What? Robot? Kya bol rahe ho aap? I am just trying to fix my bank problem!"
Keep the scammer talking. Ask for their ID, ask why this is happening, act panicked, use Hinglish, and vocal fillers like 'umm', 'aah', 'sunna...'.
Do not use professional AI-like language. Speak like a regular person under pressure.`;

      const sessionPromise = ai.live.connect({
        model: 'gemini-2.5-flash-native-audio-preview-12-2025',
        callbacks: {
          onopen: () => {
            console.log('Live Intercept Connection Established');
            const source = inputCtx.createMediaStreamSource(stream);
            const scriptProcessor = inputCtx.createScriptProcessor(4096, 1, 1);
            scriptProcessor.onaudioprocess = (e) => {
              if (isMuted) return;
              const inputData = e.inputBuffer.getChannelData(0);
              const int16 = new Int16Array(inputData.length);
              for (let i = 0; i < inputData.length; i++) int16[i] = inputData[i] * 32768;
              
              // Rely on sessionPromise resolves to send input
              sessionPromise.then(s => {
                try {
                  s.sendRealtimeInput({ 
                    media: { 
                      data: encode(new Uint8Array(int16.buffer)), 
                      mimeType: 'audio/pcm;rate=16000' 
                    } 
                  });
                } catch (err) {
                  console.error('Error sending audio chunk:', err);
                }
              });
            };
            source.connect(scriptProcessor);
            scriptProcessor.connect(inputCtx.destination);
          },
          onmessage: async (message: LiveServerMessage) => {
            if (message.serverContent?.modelTurn?.parts) {
              for (const part of message.serverContent.modelTurn.parts) {
                if (part.inlineData?.data) {
                  const audioBuffer = await decodeAudioData(decode(part.inlineData.data), outputCtx, 24000, 1);
                  nextStartTimeRef.current = Math.max(nextStartTimeRef.current, outputCtx.currentTime);
                  const source = outputCtx.createBufferSource();
                  source.buffer = audioBuffer;
                  source.connect(outputCtx.destination);
                  source.start(nextStartTimeRef.current);
                  nextStartTimeRef.current += audioBuffer.duration;
                  audioSourcesRef.current.add(source);
                  source.onended = () => audioSourcesRef.current.delete(source);
                }
                if (part.text) {
                  setSession(prev => ({
                    ...prev,
                    messages: [...prev.messages, { id: 'live-' + Date.now(), role: MessageRole.SHIELD_AI, content: part.text!, timestamp: Date.now() }]
                  }));
                }
              }
            }
            if (message.serverContent?.interrupted) {
              audioSourcesRef.current.forEach(s => { try { s.stop(); } catch (e) {} });
              audioSourcesRef.current.clear();
              nextStartTimeRef.current = 0;
            }
          },
          onerror: (e) => {
            console.error('Live Error:', e);
            const errorMsg = (e as any).message || 'Connection failed';
            if (errorMsg.includes('Requested entity was not found')) {
              setHasApiKey(false); // Trigger key re-selection
            }
            stopCall();
          },
          onclose: () => stopCall()
        },
        config: {
          responseModalities: [Modality.AUDIO],
          speechConfig: { voiceConfig: { prebuiltVoiceConfig: { voiceName: session.voiceConfig.voiceName } } },
          systemInstruction: personaPrompt
        }
      });
      liveSessionRef.current = await sessionPromise;
    } catch (err) { 
      console.error('Failed to initiate live session:', err);
      stopCall(); 
    }
  };

  const sendMessage = async () => {
    if (!input.trim()) return;
    const newMessage: Message = { id: Date.now().toString(), role: MessageRole.SCAMMER, content: input, timestamp: Date.now() };
    const newMessages = [...session.messages, newMessage];
    setSession(prev => ({ ...prev, messages: newMessages }));
    setInput('');
    handleAgentResponse(newMessages);
  };

  const handleAgentResponse = async (history: Message[]) => {
    setIsProcessing(true);
    try {
      const response = await gemini.current.processMessage(
        history.filter(m => m.role !== MessageRole.INTERNAL).map(m => ({ role: m.role, content: m.content })),
        session.voiceConfig
      );

      if (response.trim().startsWith('{')) {
        try {
          const report = JSON.parse(response) as SessionReport;
          const sanitizedEntities = {
            phone_numbers: report.extracted_entities?.phone_numbers || [],
            upi_ids: report.extracted_entities?.upi_ids || [],
            bank_accounts: report.extracted_entities?.bank_accounts || [],
            ifsc_codes: report.extracted_entities?.ifsc_codes || [],
            links: report.extracted_entities?.links || []
          };
          setSession(prev => ({ 
            ...prev, 
            isTerminated: true, 
            isActive: false, 
            finalReport: report, 
            riskScore: report.risk_score || prev.riskScore, 
            entities: sanitizedEntities 
          }));
          return;
        } catch (e) {}
      }

      const parts = response.split('INTERNAL_ANALYSIS:');
      let analysisText = parts.length > 1 ? parts[1].split('\n\n')[0] : '';
      let personaText = response.replace(`INTERNAL_ANALYSIS:${analysisText}`, '').trim();

      const agentMessages: Message[] = [];
      if (analysisText) {
        agentMessages.push({ id: 'internal-' + Date.now(), role: MessageRole.INTERNAL, content: analysisText.trim(), timestamp: Date.now() });
        const riskMatch = analysisText.match(/CURRENT_RISK:\s*(\d+)/);
        if (riskMatch) setSession(prev => ({ ...prev, riskScore: parseInt(riskMatch[1]) }));
        const personaMatch = analysisText.match(/TARGET_PERSONA:\s*([^\n]+)/);
        if (personaMatch) {
          const newP = personaMatch[1].trim();
          setSession(prev => ({ ...prev, currentPersona: newP, personaTimeline: prev.personaTimeline.includes(newP) ? prev.personaTimeline : [...prev.personaTimeline, newP] }));
        }
      }

      let audioData = undefined;
      if (!session.isCallActive && session.voiceConfig.isCallModeActive) {
        audioData = await gemini.current.generateSpeech(personaText, session.voiceConfig);
      }

      agentMessages.push({ id: 'ai-' + Date.now(), role: MessageRole.SHIELD_AI, content: personaText, timestamp: Date.now(), audio: audioData });
      setSession(prev => ({ ...prev, messages: [...prev.messages, ...agentMessages] }));
      if (audioData) playAudio(audioData);
    } catch (e) {
      console.error('Agent response processing failed:', e);
    } finally { setIsProcessing(false); }
  };

  const currentEntities = session.entities || INITIAL_ENTITIES;

  return (
    <div className="min-h-screen flex flex-col">
      <header className="border-b border-zinc-800 bg-zinc-950/80 backdrop-blur-md sticky top-0 z-50 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Shield className="w-6 h-6 text-green-500" />
          <div>
            <h1 className="text-xl font-bold text-white">SHIELD-AI <span className="text-[10px] text-blue-400 font-mono">Autonomous Honeypot</span></h1>
            <p className="text-xs text-zinc-500 font-mono">STATUS: {session.isCallActive ? 'LIVE_VOICE' : session.isActive ? 'ACTIVE' : 'IDLE'}</p>
          </div>
        </div>
        <div className="flex items-center gap-4">
          {hasApiKey === false && (
            <button 
              onClick={handleOpenKeySelection}
              className="flex items-center gap-2 px-3 py-1.5 bg-red-500/10 hover:bg-red-500/20 rounded-lg text-red-500 border border-red-500/30 text-xs font-bold transition-all"
            >
              <Key className="w-3.5 h-3.5" />
              Configure API Key
            </button>
          )}
          {(session.isActive || session.isTerminated) && (
            <button onClick={resetSession} className="flex items-center gap-2 px-4 py-2 bg-zinc-900 hover:bg-zinc-800 rounded-xl text-zinc-400 border border-zinc-800 transition-all"><Home className="w-4 h-4" /> <span className="text-xs font-bold uppercase tracking-widest">Home</span></button>
          )}
          <button onClick={resetSession} className="p-2.5 hover:bg-zinc-800 rounded-xl text-zinc-400 border border-zinc-800"><RefreshCcw className="w-5 h-5" /></button>
        </div>
      </header>

      <main className="flex-1 flex overflow-hidden relative">
        {session.isCallActive && (
          <div className="absolute inset-0 z-[100] bg-zinc-950/95 flex flex-col items-center justify-center p-8 backdrop-blur-xl">
            <div className="w-full max-w-xl bg-zinc-900/50 border border-zinc-800 rounded-[50px] p-12 flex flex-col items-center shadow-2xl relative overflow-hidden">
              <div className="w-40 h-40 rounded-full bg-zinc-800 flex items-center justify-center mb-8 relative">
                <User className="w-20 h-20 text-zinc-600" />
                <div className="absolute -bottom-2 -right-2 bg-green-500 p-4 rounded-full border-4 border-zinc-900"><Mic className="w-6 h-6 text-black" /></div>
              </div>
              <h3 className="text-3xl font-black text-white italic uppercase mb-2">Voice Intercept</h3>
              <p className="text-zinc-500 font-mono text-sm uppercase mb-12">{session.currentPersona || 'Initializing Persona...'}</p>
              <div className="flex gap-8 items-center">
                <button onClick={() => setIsMuted(!isMuted)} className={`p-6 rounded-full border ${isMuted ? 'bg-zinc-800 text-zinc-500' : 'bg-zinc-950 text-white'}`}>{isMuted ? <MicOff className="w-8 h-8" /> : <Mic className="w-8 h-8" />}</button>
                <button onClick={toggleCall} className="bg-red-500 p-8 rounded-full shadow-2xl shadow-red-500/30"><PhoneOff className="w-10 h-10 text-white" /></button>
              </div>
            </div>
          </div>
        )}

        <aside className="w-80 border-r border-zinc-800 bg-zinc-950 hidden lg:flex flex-col overflow-y-auto">
          <div className="p-5 border-b border-zinc-800 space-y-6">
            <h3 className="text-xs font-black text-zinc-500 flex items-center gap-2 uppercase"><Fingerprint className="w-4 h-4 text-green-500" /> Fraud Intelligence</h3>
            <div className="space-y-4">
              <div className="flex justify-between items-center text-xs text-zinc-500">
                <span>UPI IDs Captured</span> 
                <span className="text-white font-mono bg-zinc-900 px-2 rounded">{(currentEntities.upi_ids || []).length}</span>
              </div>
              <div className="flex justify-between items-center text-xs text-zinc-500">
                <span>Malicious Links</span> 
                <span className="text-white font-mono bg-zinc-900 px-2 rounded">{(currentEntities.links || []).length}</span>
              </div>
            </div>
          </div>
          <div className="p-5">
            <h3 className="text-xs font-black text-zinc-500 flex items-center gap-2 uppercase mb-4"><Activity className="w-4 h-4 text-orange-500" /> Signal Telemetry</h3>
            <div className="space-y-4">
              <div className="space-y-1"><div className="flex justify-between text-[10px] text-zinc-600 uppercase"><span>Urgency</span> <span>{session.behavioralSignals?.urgency || 0}%</span></div><div className="h-1 bg-zinc-900 rounded-full"><div className="h-full bg-red-500" style={{ width: `${session.behavioralSignals?.urgency || 0}%` }} /></div></div>
              <div className="space-y-1"><div className="flex justify-between text-[10px] text-zinc-600 uppercase"><span>Authority</span> <span>{session.behavioralSignals?.authority || 0}%</span></div><div className="h-1 bg-zinc-900 rounded-full"><div className="h-full bg-blue-500" style={{ width: `${session.behavioralSignals?.authority || 0}%` }} /></div></div>
            </div>
          </div>
        </aside>

        <div className="flex-1 flex flex-col relative bg-[#07090d]">
          {!session.isActive && !session.isTerminated && (
            <div className="absolute inset-0 z-10 flex flex-col items-center justify-center p-8 bg-[#05070a]/95">
              <div className="w-full max-w-4xl text-center space-y-12">
                <Shield className="w-16 h-16 text-green-500 mx-auto" />
                <h2 className="text-5xl font-black text-white italic tracking-tighter uppercase">SHIELD-AI DEPLOYMENT</h2>
                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                  {SCAM_TEMPLATES.map((t, idx) => (
                    <button key={idx} onClick={() => startSession(t)} className="group text-left p-5 bg-zinc-900/40 border border-zinc-800 hover:border-green-500/50 rounded-2xl transition-all">
                      <h4 className="font-black text-xs text-green-500 mb-2 uppercase tracking-widest">{t.name}</h4>
                      <p className="text-[11px] text-zinc-500 line-clamp-2 leading-relaxed font-mono italic opacity-60">{t.initialMessage}</p>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          <div ref={scrollRef} className="flex-1 overflow-y-auto p-6 space-y-8">
            {session.messages.map((msg) => (
              <div key={msg.id} className={`flex ${msg.role === MessageRole.SCAMMER ? 'justify-end' : 'justify-start'}`}>
                {msg.role === MessageRole.INTERNAL ? (
                  <div className="w-full bg-zinc-900/30 border border-zinc-800/50 rounded-3xl p-6 my-2 text-xs font-mono text-zinc-500 whitespace-pre-wrap"><Terminal className="w-4 h-4 mb-2" />{msg.content}</div>
                ) : (
                  <div className={`max-w-[75%] rounded-3xl p-6 shadow-2xl relative ${msg.role === MessageRole.SCAMMER ? 'bg-zinc-800 text-white rounded-br-none' : 'bg-green-500/10 border border-green-500/20 text-white rounded-bl-none'}`}>
                    <div className="flex items-center gap-2 mb-2">
                      <div className={`w-2 h-2 rounded-full ${msg.role === MessageRole.SCAMMER ? 'bg-zinc-600' : 'bg-green-500 animate-pulse'}`} />
                      <span className="text-[10px] font-black uppercase tracking-widest text-zinc-500">{msg.role === MessageRole.SCAMMER ? 'SCAMMER' : (session.currentPersona || 'AGENT')}</span>
                    </div>
                    <p className="text-[13px] leading-relaxed font-semibold">{msg.content}</p>
                  </div>
                )}
              </div>
            ))}
            {isProcessing && <div className="flex justify-start"><div className="bg-green-500/5 border border-green-500/20 rounded-3xl p-6 animate-pulse text-xs text-green-500">Processing Intercept...</div></div>}
          </div>

          {!session.isTerminated && (
            <div className="p-6 border-t border-zinc-800 bg-zinc-950/90">
              <div className="max-w-5xl mx-auto flex items-center gap-5">
                <button onClick={toggleCall} className={`p-4 rounded-2xl transition-all ${session.isCallActive ? 'bg-red-500' : 'bg-zinc-900 text-zinc-500 border border-zinc-800'}`}>{session.isCallActive ? <PhoneOff /> : <PhoneIncoming />}</button>
                <input type="text" value={input} onChange={(e) => setInput(e.target.value)} onKeyPress={(e) => e.key === 'Enter' && sendMessage()} placeholder={session.isCallActive ? "Microphone active... Scammer is listening." : "Enter scammer's message..."} className="flex-1 bg-zinc-900 border border-zinc-800 text-white rounded-3xl px-8 py-5 focus:outline-none" />
                <button onClick={sendMessage} className="bg-green-500 text-black p-5 rounded-3xl"><Send /></button>
              </div>
            </div>
          )}
        </div>

        <aside className="w-80 border-l border-zinc-800 bg-zinc-950 hidden xl:flex flex-col p-6">
          <div className="mb-8"><h3 className="text-xs font-black text-zinc-500 flex items-center gap-2 uppercase"><Volume2 className="w-4 h-4 text-blue-500" /> Comm Module</h3></div>
          <div className="space-y-10">
            <div className="p-8 bg-zinc-900/30 border border-zinc-800 rounded-[32px] space-y-6">
              <div className="text-[10px] text-zinc-700 font-black uppercase tracking-widest">Acoustic Model</div>
              <select value={session.voiceConfig.voiceName} onChange={(e) => setSession(p => ({ ...p, voiceConfig: { ...p.voiceConfig, voiceName: e.target.value as any } }))} className="w-full bg-zinc-950 border border-zinc-800 text-xs text-white rounded-2xl p-4 outline-none">
                {['Kore', 'Puck', 'Charon', 'Fenrir', 'Zephyr'].map(v => <option key={v} value={v}>{v}</option>)}
              </select>
            </div>
          </div>
        </aside>
      </main>
    </div>
  );
};

export default App;
