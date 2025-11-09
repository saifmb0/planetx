/**
 * Gemini AI Service - Exclusively using gemini-2.5-flash
 * Pipeline 1 (Sanitizer): Clean raw NASA HTML data
 * Pipeline 2 (Synthesizer): Answer user questions with context
 */

import { GoogleGenerativeAI } from '@google/generative-ai';
import { GEMINI_API_KEY } from '@env';
import { NasaLesson, SanitizedLesson } from '../types/nasa';

const MODEL_NAME = 'gemini-2.5-flash'; // Using latest stable flash model
const AI_TIMEOUT = 30000; // 30 seconds timeout
const TEMPERATURE = 0.4;

export class GeminiService {
  private static instance: GeminiService;
  private genAI: GoogleGenerativeAI;
  private model: any;

  private constructor() {
    if (!GEMINI_API_KEY || GEMINI_API_KEY === 'your_gemini_api_key_here') {
      console.warn('[GeminiService] WARNING: No Gemini API key configured!');
    }
    
    this.genAI = new GoogleGenerativeAI(GEMINI_API_KEY || 'dummy-key');
    this.model = this.genAI.getGenerativeModel({ 
      model: MODEL_NAME,
      generationConfig: {
        temperature: TEMPERATURE,
        topK: 40,
        topP: 0.95,
        maxOutputTokens: 2048,
      },
    });
  }

  static getInstance(): GeminiService {
    if (!GeminiService.instance) {
      GeminiService.instance = new GeminiService();
    }
    return GeminiService.instance;
  }

  /**
   * Pipeline Step 1: Sanitize raw NASA lesson data
   * Extracts clean, structured information from messy HTML content
   */
  async sanitizeLessons(lessons: NasaLesson[]): Promise<SanitizedLesson[]> {
    if (lessons.length === 0) return [];

    console.log(`[GeminiService] Sanitizing ${lessons.length} lessons...`);

    const prompt = `Extract key information from these NASA reports and return ONLY a valid JSON array.

${lessons.map((l, i) => `
LESSON ${i + 1} (ID: ${l.lesson_id}):
Title: ${l.title}
Abstract: ${l.abstract}
Event: ${l.driving_event || 'N/A'}
Lesson: ${l.lesson || 'N/A'}
Recommendation: ${l.recommendation || 'N/A'}
`).join('\n---\n')}

Return this exact JSON structure with NO markdown, NO code blocks, NO explanations - ONLY the JSON array:
[{"lesson_id":${lessons[0]?.lesson_id},"title":"${lessons[0]?.title.substring(0, 50)}...","abstract":"brief summary","driving_event":"what happened","root_cause":"why it happened","recommendation":"key recommendation","metadata":{"mission":"mission name","center":"NASA center","subjects":["tag1","tag2"]}}]

Now provide the full array for all ${lessons.length} lessons:`;

    try {
      const result = await this.generateWithTimeout(prompt);
      
      // Parse JSON response - be aggressive about cleaning
      let jsonText = result.trim();
      
      // Remove markdown code blocks
      jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      
      // Remove any text before first [ and after last ]
      const firstBracket = jsonText.indexOf('[');
      const lastBracket = jsonText.lastIndexOf(']');
      
      if (firstBracket !== -1 && lastBracket !== -1) {
        jsonText = jsonText.substring(firstBracket, lastBracket + 1);
      }
      
      const sanitized: SanitizedLesson[] = JSON.parse(jsonText);
      console.log(`[GeminiService] ✓ Sanitized ${sanitized.length} lessons`);
      
      return sanitized;
      
    } catch (error: any) {
      console.error('[GeminiService] Sanitization error:', error.message);
      console.log('[GeminiService] Using fallback sanitization');
      
      // Fallback: return basic sanitized format
      return lessons.map(l => ({
        lesson_id: l.lesson_id,
        title: l.title,
        abstract: l.abstract,
        driving_event: l.driving_event || 'Not specified',
        root_cause: l.lesson || 'Not specified',
        recommendation: l.recommendation || 'Not specified',
        metadata: {
          mission: l.mission,
          center: l.center,
          subjects: [l.subject_primary, ...(l.subject_secondary || [])].filter(Boolean) as string[],
        },
      }));
    }
  }

  /**
   * Pipeline Step 2: Answer user questions with sanitized lesson context (STREAMING)
   */
  async answerQuestionStream(
    question: string, 
    context: SanitizedLesson[],
    onChunk: (chunk: string) => void
  ): Promise<{
    fullAnswer: string;
    citedLessonIds: number[];
  }> {
    console.log(`[GeminiService] Answering (STREAMING): "${question}"`);

    const contextText = context.map((l, i) => `
LESSON ${i + 1} [ID: ${l.lesson_id}]:
Title: ${l.title}
Summary: ${l.abstract}
Key Issue: ${l.root_cause}
Fix: ${l.recommendation}
---
`).join('\n');

    const prompt = `You are a helpful NASA mission advisor explaining space engineering to a general audience. Keep your response brief and accessible.

AVAILABLE NASA LESSONS:
${contextText}

USER QUESTION: ${question}

INSTRUCTIONS:
- Write in simple, everyday language (avoid jargon)
- Be concise - aim for 150-200 words total
- Use standard markdown formatting
- Start with a quick summary mentioning how many cases you analyzed
- List 3-4 key points as a numbered list
- Include lesson references like [Lesson ${context[0]?.lesson_id}] after each point
- End with 1-2 brief recommendations

EXAMPLE FORMAT:

Based on ${context.length} NASA missions, here's what we found:

The main challenges were:

1. **[Brief point]** - [One sentence explanation] [Lesson 1234]
2. **[Brief point]** - [One sentence explanation] [Lesson 5678]  
3. **[Brief point]** - [One sentence explanation] [Lesson 9012]

**Bottom line:** [One sentence with 1-2 practical recommendations]

Now answer the user's question:`;

    try {
      console.log(`[GeminiService] ⏱️ Prompt length: ${prompt.length} characters`);
      
      // Get the full answer at once (streaming API not compatible with RN)
      const fullAnswer = await this.generateWithTimeout(prompt);
      
      // Simulate streaming by chunking the response (makes UX feel faster!)
      const words = fullAnswer.split(' ');
      const chunkSize = 5; // 5 words per chunk
      
      for (let i = 0; i < words.length; i += chunkSize) {
        const chunk = words.slice(i, i + chunkSize).join(' ') + ' ';
        onChunk(chunk);
        // Small delay to simulate real streaming (optional, makes it feel more natural)
        await new Promise(resolve => setTimeout(resolve, 30));
      }
      
      // Extract cited lesson IDs from response
      const citedIds = this.extractLessonIds(fullAnswer, context.map(l => l.lesson_id));
      
      console.log(`[GeminiService] ✓ Generated answer (${fullAnswer.length} chars, ${citedIds.length} citations)`);
      
      return {
        fullAnswer: fullAnswer.trim(),
        citedLessonIds: citedIds,
      };
      
    } catch (error: any) {
      console.error('[GeminiService] Question answering error:', error.message);
      
      // Fallback response
      const fallback = `I found ${context.length} relevant NASA lessons for your query. ${
        context[0] ? `The most relevant is "${context[0].title}".` : ''
      } However, I'm currently unable to provide a detailed analysis. Please try again or rephrase your question.`;
      
      onChunk(fallback);
      
      return {
        fullAnswer: fallback,
        citedLessonIds: context.slice(0, 3).map(l => l.lesson_id),
      };
    }
  }

  /**
   * Pipeline Step 2: Answer user questions with sanitized lesson context (NON-STREAMING - DEPRECATED)
   */
  async answerQuestion(
    question: string, 
    context: SanitizedLesson[]
  ): Promise<{
    answer: string;
    citedLessonIds: number[];
  }> {
    console.log(`[GeminiService] Answering: "${question}"`);

    const contextText = context.map((l, i) => `
LESSON ${i + 1} [ID: ${l.lesson_id}]:
Title: ${l.title}
Summary: ${l.abstract}
Key Issue: ${l.root_cause}
Fix: ${l.recommendation}
---
`).join('\n');

    const prompt = `You are a helpful NASA mission advisor explaining space engineering to a general audience. Keep your response brief and accessible.

AVAILABLE NASA LESSONS:
${contextText}

USER QUESTION: ${question}

INSTRUCTIONS:
- Write in simple, everyday language (avoid jargon)
- Be concise - aim for 150-200 words total
- Use standard markdown formatting
- Start with a quick summary mentioning how many cases you analyzed
- List 3-4 key points as a numbered list
- Include lesson references like [Lesson ${context[0]?.lesson_id}] after each point
- End with 1-2 brief recommendations

EXAMPLE FORMAT:

Based on ${context.length} NASA missions, here's what we found:

The main challenges were:

1. **[Brief point]** - [One sentence explanation] [Lesson 1234]
2. **[Brief point]** - [One sentence explanation] [Lesson 5678]  
3. **[Brief point]** - [One sentence explanation] [Lesson 9012]

**Bottom line:** [One sentence with 1-2 practical recommendations]

Now answer the user's question:`;

    try {
      const answer = await this.generateWithTimeout(prompt);
      
      // Extract cited lesson IDs from response
      const citedIds = this.extractLessonIds(answer, context.map(l => l.lesson_id));
      
      console.log(`[GeminiService] ✓ Generated answer (${answer.length} chars, ${citedIds.length} citations)`);
      
      return {
        answer: answer.trim(),
        citedLessonIds: citedIds,
      };
      
    } catch (error: any) {
      console.error('[GeminiService] Question answering error:', error.message);
      
      // Fallback response
      return {
        answer: `I found ${context.length} relevant NASA lessons for your query. ${
          context[0] ? `The most relevant is "${context[0].title}" from ${context[0].metadata.mission || 'a NASA mission'}.` : ''
        } However, I'm currently unable to provide a detailed analysis. Please try again or rephrase your question.`,
        citedLessonIds: context.slice(0, 3).map(l => l.lesson_id),
      };
    }
  }

  /**
   * Generate text with timeout protection
   */
  private async generateWithTimeout(prompt: string): Promise<string> {
    return new Promise(async (resolve, reject) => {
      const timeoutId = setTimeout(() => {
        reject(new Error('Gemini API timeout (>5s)'));
      }, AI_TIMEOUT);

      try {
        const apiStartTime = Date.now();
        console.log(`[GeminiService] ⏱️ Prompt length: ${prompt.length} characters`);
        const result = await this.model.generateContent(prompt);
        clearTimeout(timeoutId);

        const response = await result.response;
        const text = response.text();

        console.log(`[GeminiService] ⏱️ API call completed in ${Date.now() - apiStartTime}ms`);
        resolve(text);
      } catch (error) {
        clearTimeout(timeoutId);
        reject(error);
      }
    });
  }

  /**
   * Extract lesson IDs mentioned in text
   * Supports formats: [Lesson 5001], Lesson ID: 5001, ID: 5001
   */
  private extractLessonIds(text: string, validIds: number[]): number[] {
    // Match patterns: [Lesson 5001], Lesson ID: 5001, ID: 5001
    const patterns = [
      /\[Lesson\s+(\d+)\]/gi,
      /Lesson\s+ID:\s*(\d+)/gi,
      /ID:\s*(\d+)/gi,
    ];
    
    const cited = new Set<number>();
    
    for (const pattern of patterns) {
      const matches = text.matchAll(pattern);
      for (const match of matches) {
        const id = parseInt(match[1]);
        if (validIds.includes(id)) {
          cited.add(id);
        }
      }
    }
    
    return Array.from(cited);
  }

  /**
   * Generate a suggested follow-up question based on context
   */
  async generateFollowUpQuestions(
    conversation: { question: string; answer: string }[]
  ): Promise<string[]> {
    if (conversation.length === 0) return [];

    const prompt = `Based on this NASA mission intelligence conversation, suggest 3 insightful follow-up questions a user might ask:

${conversation.slice(-3).map((c, i) => `
Q${i + 1}: ${c.question}
A${i + 1}: ${c.answer.substring(0, 200)}...
`).join('\n')}

Return 3 questions as a JSON array: ["Question 1?", "Question 2?", "Question 3?"]`;

    try {
      const result = await this.generateWithTimeout(prompt);
      let jsonText = result.trim();
      
      if (jsonText.startsWith('```')) {
        jsonText = jsonText.replace(/```json\n?/g, '').replace(/```\n?/g, '');
      }
      
      const questions: string[] = JSON.parse(jsonText);
      return questions.slice(0, 3);
      
    } catch (error) {
      return [];
    }
  }
}

export default GeminiService.getInstance();
