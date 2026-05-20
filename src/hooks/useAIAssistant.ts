import { useState } from 'react';

const API_KEY = import.meta.env.VITE_GOOGLE_GEMINI_KEY;
const GEMINI_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp:generateContent';

interface GeminiMessage {
  role: 'user' | 'model';
  parts: Array<{ text: string }>;
}

export function useAIAssistant() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sendMessage = async (
    userMessage: string,
    injuryType?: string,
    conversationHistory?: GeminiMessage[]
  ): Promise<string> => {
    setLoading(true);
    setError(null);

    try {
      if (!API_KEY) {
        throw new Error('Gemini API key not configured. Add VITE_GOOGLE_GEMINI_KEY to .env.local');
      }

      const systemPrompt = `You are a helpful rehabilitation assistant for patients recovering from injuries.
${injuryType ? `The user is recovering from ${injuryType} injury. ` : ''}
Provide supportive, evidence-based advice on exercises, recovery, pain management, and rehabilitation.
IMPORTANT: Always remind users to consult their doctor or physical therapist for medical concerns. You are not a replacement for professional medical advice.
Keep responses concise, encouraging, and practical.
If asked about something outside rehabilitation, politely redirect to the rehab context.`;

      // Initialize contents with system prompt as first message if no history exists
      const initialContents = (conversationHistory && conversationHistory.length > 0)
        ? conversationHistory
        : [
            {
              role: 'user',
              parts: [{ text: systemPrompt }],
            },
            {
              role: 'model',
              parts: [{ text: 'I understand. I am your rehabilitation assistant. How can I help you with your recovery today?' }],
            },
          ];

      const body = {
        contents: [
          ...initialContents,
          {
            role: 'user',
            parts: [{ text: userMessage }],
          },
        ],
        generationConfig: {
          temperature: 0.7,
          topK: 40,
          topP: 0.95,
          maxOutputTokens: 500,
        },
      };

      const response = await fetch(`${GEMINI_URL}?key=${API_KEY}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(body),
      });

      if (!response.ok) {
        const errData = await response.text();
        throw new Error(`Gemini API error: ${response.status} ${errData}`);
      }

      const data = await response.json();
      const assistantMessage = data.candidates?.[0]?.content?.parts?.[0]?.text || 'No response';

      return assistantMessage;
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Failed to get response';
      setError(msg);
      console.error('AI Assistant error:', err);
      throw err;
    } finally {
      setLoading(false);
    }
  };

  return { sendMessage, loading, error };
}
