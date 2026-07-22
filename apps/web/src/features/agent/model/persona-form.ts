import { DEFAULT_BUSINESS_HOURS, type BusinessHoursMap } from "@/lib/persona";

export type FormState = {
  agentName: string;
  tone: string;
  greetingMessage: string;
  inactivityMessage: string;
  closingMessage: string;
  outOfHoursMessage: string;
  handoffMessage: string;
  autoHandoffThreshold: number;
  handoffOrderValueBrl: string;
  inactivityTimeoutMin: number;
  sessionTtlHours: number;
  maxConversationLength: number;
  businessHours: BusinessHoursMap;
  llmModel: string;
  llmTemperature: number;
  maxResponseLength: number;
  systemPromptBase: string;
  isPublished: boolean;
};

export const DEFAULT_FORM: FormState = {
  agentName: "Assistente",
  tone: "FRIENDLY",
  greetingMessage: "Olá! Como posso ajudar?",
  inactivityMessage: "Ainda está por aqui?",
  closingMessage: "Até logo!",
  outOfHoursMessage: "No momento estamos fechados. Retornaremos em breve!",
  handoffMessage: "Estou transferindo você para um de nossos atendentes.",
  autoHandoffThreshold: 0.3,
  handoffOrderValueBrl: "",
  inactivityTimeoutMin: 30,
  sessionTtlHours: 24,
  maxConversationLength: 50,
  businessHours: DEFAULT_BUSINESS_HOURS,
  llmModel: "gpt-4o-mini",
  llmTemperature: 0.3,
  maxResponseLength: 500,
  systemPromptBase: "",
  isPublished: false,
};

export const TONES = [
  { value: "FORMAL", label: "Formal", desc: "Profissional e objetivo" },
  { value: "INFORMAL", label: "Informal", desc: "Descontraído e leve" },
  { value: "FRIENDLY", label: "Amigável", desc: "Acolhedor e empático" },
  { value: "TECHNICAL", label: "Técnico", desc: "Preciso e detalhado" },
  { value: "REGIONAL", label: "Regional", desc: "Linguagem local" },
] as const;

export const FIXED_LLM_MODEL = {
  value: "gpt-4o-mini",
  label: "GPT-4o Mini",
  desc: "Rápido e econômico",
} as const;

export type PatchFn = <K extends keyof FormState>(key: K, value: FormState[K]) => void;
