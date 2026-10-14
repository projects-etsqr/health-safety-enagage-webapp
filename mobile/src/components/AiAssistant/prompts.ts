/**
 * Per-role opening screen copy for the AI assistant.
 *
 * This is presentation only — it seeds the empty-state suggestion chips. The
 * actual data scope and persona are decided server-side from the JWT, so
 * editing these strings cannot widen what a role is able to ask about.
 */

export interface AiPromptSet {
  title: string;
  greeting: string;
  suggestions: string[];
}

export const AI_PROMPTS: Record<'worker' | 'supervisor' | 'manager' | 'auditor', AiPromptSet> = {
  worker: {
    title: 'Safety Assistant',
    greeting:
      'Ask me about your own tasks, shifts and reports. I only see your record — not the whole company.',
    suggestions: [
      'What tasks do I still have open?',
      'How do I report a near miss?',
      'How many hours have I logged this month?',
      'What happened to the incident I reported?',
    ],
  },
  supervisor: {
    title: 'Shift Assistant',
    greeting:
      'Ask me about your team and zone — permits, CAPAs, walks and who is on shift.',
    suggestions: [
      'What needs my attention this shift?',
      'Which permits are open in my zone?',
      'Are any CAPAs overdue on my team?',
      "How is my team's near-miss reporting looking?",
    ],
  },
  manager: {
    title: 'EHSERA Intelligence',
    greeting:
      'Ask me about site performance, leading indicators, compliance and contractor risk.',
    suggestions: [
      'Summarise our safety performance',
      'Which sites carry the most risk right now?',
      'Why is our CAPA closure rate where it is?',
      'What should we prioritise next month?',
    ],
  },
  auditor: {
    title: 'Audit Assistant',
    greeting:
      'Ask me about your assigned audits, compliance gaps and the action trail.',
    suggestions: [
      'Which of my audits are still outstanding?',
      'Where are the biggest compliance gaps?',
      'Summarise recent close-out activity',
      'Help me draft a finding for low PTW compliance',
    ],
  },
};
