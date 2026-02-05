
export enum MessageRole {
  SCAMMER = 'scammer',
  SHIELD_AI = 'shield_ai',
  INTERNAL = 'internal'
}

export interface Message {
  id: string;
  role: MessageRole;
  content: string;
  timestamp: number;
  audio?: string; // Base64 audio data
  metadata?: any;
}

export interface Persona {
  id: string;
  name: string;
  description: string;
  traits: string[];
}

export interface VoiceConfig {
  voiceName: 'Kore' | 'Puck' | 'Charon' | 'Fenrir' | 'Zephyr';
  speed: number;
  languageStyle: string;
  accent: string;
  isCallModeActive: boolean;
}

export interface ExtractedEntities {
  phone_numbers: string[];
  upi_ids: string[];
  bank_accounts: string[];
  ifsc_codes: string[];
  links: string[];
}

export interface BehavioralProfile {
  urgency: string;
  authority_impersonation: string;
  escalation_speed: string;
  bot_or_human: string;
  behavior_signals?: string[];
}

export interface SessionReport {
  scam_type: string;
  risk_score: number;
  risk_explanation: string;
  extracted_entities: ExtractedEntities;
  behavioral_profile: BehavioralProfile;
  persona_timeline: string[];
  initial_persona: string;
  final_persona: string;
  call_mode_used: boolean;
  link_analysis: string;
  confidence_level: string;
}

export interface SessionState {
  isActive: boolean;
  messages: Message[];
  riskScore: number;
  currentPersona?: string;
  personaTimeline: string[];
  entities: ExtractedEntities;
  isTerminated: boolean;
  finalReport?: SessionReport;
  voiceConfig: VoiceConfig;
  behavioralSignals: {
    urgency: number;
    authority: number;
    escalation: number;
  };
  isCallActive: boolean;
}
