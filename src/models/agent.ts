// Lecture Agent data models

export interface PersonalityConfig {
  instructions: string;
  tone: 'humorous' | 'serious' | 'casual' | 'formal' | 'enthusiastic';
  examples?: string[];
}

export interface VoiceConfig {
  voiceId: string;
  speed: number; // 0.5 to 2.0
  pitch: number; // -20 to 20
}

export interface LectureAgent {
  id: string;
  name: string;
  description: string;
  personality: PersonalityConfig;
  voice: VoiceConfig;
  createdAt: Date;
}
