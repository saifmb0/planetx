/**
 * Chat Screen - Conversational AI interface for NASA mission intelligence
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  ScrollView,
  TextInput,
  TouchableOpacity,
  KeyboardAvoidingView,
  Platform,
  ActivityIndicator,
  Linking,
} from 'react-native';
import Markdown from 'react-native-markdown-display';
import { GlassCard } from '../components/GlassCard';
import { LoadingSpinner } from '../components/LoadingSpinner';
import { Colors, Spacing, Typography, BorderRadius } from '../constants/theme';
import { DEMO_QUERIES } from '../constants/data';
import NasaDataService from '../services/NasaDataService';
import GeminiService from '../services/GeminiService';
import { ChatMessage, SanitizedLesson } from '../types/nasa';

export default function ChatScreen({ route }: any) {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [currentContext, setCurrentContext] = useState<SanitizedLesson[]>([]);
  const scrollViewRef = useRef<ScrollView>(null);

  const { initialQuery } = route.params || {};

  useEffect(() => {
    if (initialQuery && messages.length === 0) {
      handleSendMessage(initialQuery);
    }
  }, [initialQuery]);

  const handleSendMessage = async (text?: string) => {
    const messageText = text || inputText.trim();
    if (!messageText || isLoading) return;

    // Start timer
    const startTime = Date.now();
    console.log(`[ChatScreen] ⏱️ Query started: "${messageText}"`);

    // Clear input
    setInputText('');

    // Add user message
    const userMessage: ChatMessage = {
      id: Date.now().toString(),
      role: 'user',
      content: messageText,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMessage]);
    setIsLoading(true);

    // Add loading message
    const loadingMessage: ChatMessage = {
      id: `${Date.now()}-loading`,
      role: 'assistant',
      content: 'Analyzing deep space archives...',
      timestamp: new Date(),
      isLoading: true,
    };

    setMessages(prev => [...prev, loadingMessage]);

    try {
      // Step 1: Search NASA data
      const searchStart = Date.now();
      const searchResult = await NasaDataService.searchLessons(messageText);
      console.log(`[ChatScreen] ⏱️ Search completed: ${Date.now() - searchStart}ms`);
      
      if (searchResult.lessons.length === 0) {
        throw new Error('No relevant lessons found');
      }

      // Step 2: Convert to clean format (NO AI SANITIZATION - TOO SLOW!)
      // Extract ONLY essential fields - strip HTML and unnecessary details
      const cleanLessons = searchResult.lessons.slice(0, 5).map(l => {
        // Helper to strip HTML and truncate
        const stripHTML = (html: string | undefined, maxLength = 200) => {
          if (!html) return 'Not specified';
          return html.replace(/<[^>]*>/g, ' ')
                    .replace(/\s+/g, ' ')
                    .trim()
                    .substring(0, maxLength);
        };

        return {
          lesson_id: l.lesson_id,
          title: l.title.substring(0, 150), // Truncate title
          abstract: stripHTML(l.abstract, 250), // Short abstract only
          // SKIP driving_event - too much HTML garbage!
          driving_event: '', 
          root_cause: stripHTML(l.lesson, 300), // Core lesson only
          recommendation: stripHTML(l.recommendation, 200), // Brief recommendation
          metadata: {
            mission: l.mission?.substring(0, 50) || '',
            center: l.center?.substring(0, 30) || '',
            subjects: [], // Skip subjects - not needed
          },
        };
      });

      setCurrentContext(cleanLessons);

      // Step 3: Generate AI response with STREAMING
      const aiStart = Date.now();
      
      // Keep loading message until first chunk arrives
      let firstChunkReceived = false;
      
      // Stream response chunks to UI
      const streamingMessageId = `${Date.now()}-streaming`;
      
      const aiResult = await GeminiService.answerQuestionStream(
        messageText, 
        cleanLessons,
        (chunk) => {
          // On first chunk, replace loading message with streaming message
          if (!firstChunkReceived) {
            firstChunkReceived = true;
            setMessages(prev => {
              const filtered = prev.filter(m => !m.isLoading);
              const streamingMessage: ChatMessage = {
                id: streamingMessageId,
                role: 'assistant',
                content: chunk,
                timestamp: new Date(),
              };
              return [...filtered, streamingMessage];
            });
          } else {
            // Update existing streaming message
            setMessages(prev => prev.map(m => 
              m.id === streamingMessageId 
                ? { ...m, content: m.content + chunk }
                : m
            ));
          }
        }
      );
      
      console.log(`[ChatScreen] ⏱️ AI response completed: ${Date.now() - aiStart}ms`);

      const totalTime = Date.now() - startTime;
      console.log(`[ChatScreen] ⏱️ ✅ TOTAL QUERY TIME: ${totalTime}ms (${(totalTime / 1000).toFixed(2)}s)`);

      // Update the streaming message with final citation IDs
      setMessages(prev => prev.map(m => 
        m.id === streamingMessageId 
          ? { ...m, lessonIds: aiResult.citedLessonIds }
          : m
      ));

    } catch (error: any) {
      console.error('Chat error:', error);
      console.log(`[ChatScreen] ⏱️ ❌ Query failed after ${Date.now() - startTime}ms`);

      // Remove loading and show error
      setMessages(prev => {
        const filtered = prev.filter(m => !m.isLoading);
        const errorMessage: ChatMessage = {
          id: Date.now().toString(),
          role: 'assistant',
          content: `I encountered an issue processing your request: ${error.message}. This might be due to API configuration. Please check your Gemini API key in the .env file.`,
          timestamp: new Date(),
        };
        return [...filtered, errorMessage];
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleLessonIdPress = async (lessonId: number) => {
    // Open NASA LLIS website for this lesson
    const nasaUrl = `https://llis.nasa.gov/lesson/${lessonId}`;
    
    try {
      const canOpen = await Linking.canOpenURL(nasaUrl);
      if (canOpen) {
        await Linking.openURL(nasaUrl);
      } else {
        console.error('Cannot open NASA URL');
        // Fallback: show lesson details in chat
        const lesson = await NasaDataService.getLessonById(lessonId);
        if (lesson) {
          const detailMessage: ChatMessage = {
            id: Date.now().toString(),
            role: 'assistant',
            content: `**Lesson ${lessonId}: ${lesson.title}**\n\n${lesson.abstract}\n\n**Mission:** ${lesson.mission || 'N/A'}\n**Center:** ${lesson.center || 'N/A'}\n\n_Note: Could not open NASA website. Try visiting: ${nasaUrl}_`,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, detailMessage]);
        }
      }
    } catch (error) {
      console.error('Error opening NASA URL:', error);
    }
  };

  const renderMessage = (message: ChatMessage) => {
    const isUser = message.role === 'user';

    if (message.isLoading) {
      return (
        <View key={message.id} style={styles.messageContainer}>
          <GlassCard style={styles.assistantBubble}>
            <View style={styles.loadingContainer}>
              <LoadingSpinner size={20} />
              <Text style={styles.loadingText}>{message.content}</Text>
            </View>
          </GlassCard>
        </View>
      );
    }

    return (
      <View 
        key={message.id} 
        style={[
          styles.messageContainer,
          isUser && styles.userMessageContainer,
        ]}
      >
        <GlassCard 
          style={isUser ? styles.userBubble : styles.assistantBubble}
          gradient={isUser}
          gradientColors={isUser ? [Colors.primary, Colors.primaryDark] : undefined}
        >
          {isUser ? (
            <Text style={styles.userText}>{message.content}</Text>
          ) : (
            <Markdown
              style={markdownStyles}
              onLinkPress={(url) => {
                // Handle lesson links
                const lessonMatch = url.match(/lesson\/(\d+)/);
                if (lessonMatch) {
                  const lessonId = parseInt(lessonMatch[1]);
                  handleLessonIdPress(lessonId);
                  return false; // Prevent default
                }
                // Open other URLs normally
                Linking.openURL(url);
                return false;
              }}
            >
              {/* Convert [Lesson 1234] to markdown links */}
              {message.content.replace(
                /\[Lesson (\d+)\]/g,
                '[Lesson $1](https://llis.nasa.gov/lesson/$1)'
              )}
            </Markdown>
          )}
          
          {/* Render cited lesson IDs as clickable links to NASA */}
          {message.lessonIds && message.lessonIds.length > 0 && (
            <View style={styles.citationsContainer}>
              <Text style={styles.citationsLabel}>📚 View on NASA LLIS:</Text>
              <View style={styles.citationButtons}>
                {message.lessonIds.map(id => (
                  <TouchableOpacity
                    key={id}
                    style={styles.citationButton}
                    onPress={() => handleLessonIdPress(id)}
                  >
                    <Text style={styles.citationText}>Lesson {id} →</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          )}
        </GlassCard>
      </View>
    );
  };

  return (
    <KeyboardAvoidingView 
      style={styles.container}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      keyboardVerticalOffset={Platform.OS === 'ios' ? 90 : 0}
    >
      <View style={styles.container}>
        {/* AstroBot Banner */}
        <GlassCard style={styles.headerBanner} gradient gradientColors={[Colors.primary + '40', Colors.primaryDark + '40']}>
          <View style={styles.bannerContent}>
            <Text style={styles.bannerIcon}>🤖</Text>
            <View style={styles.bannerTextContainer}>
              <Text style={styles.bannerTitle}>AstroBot</Text>
              <Text style={styles.bannerSubtitle}>NASA Mission Intelligence Assistant</Text>
            </View>
          </View>
        </GlassCard>

        <ScrollView
          ref={scrollViewRef}
          style={styles.messagesContainer}
          contentContainerStyle={styles.messagesContent}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
          onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
        >
          {messages.length === 0 ? (
            <View style={styles.emptyState}>
              <Text style={styles.emptyIcon}>🛸</Text>
              <Text style={styles.emptyTitle}>AstroScope Mission Intelligence</Text>
              <Text style={styles.emptySubtitle}>
                Ask me anything about NASA missions, failures, and lessons learned
              </Text>
              
              <View style={styles.suggestionsContainer}>
                <Text style={styles.suggestionsTitle}>Try asking:</Text>
                {DEMO_QUERIES.slice(0, 4).map((query, index) => (
                  <TouchableOpacity
                    key={index}
                    style={styles.suggestionButton}
                    onPress={() => handleSendMessage(query)}
                  >
                    <Text style={styles.suggestionText}>"{query}"</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : (
            messages.map(renderMessage)
          )}
        </ScrollView>

        <View style={styles.inputContainer}>
          <GlassCard style={styles.inputCard}>
            <TextInput
              style={styles.input}
              value={inputText}
              onChangeText={setInputText}
              placeholder="Ask about NASA missions..."
              placeholderTextColor={Colors.textTertiary}
              multiline
              maxLength={500}
              editable={!isLoading}
            />
            <TouchableOpacity
              style={[styles.sendButton, !inputText.trim() && styles.sendButtonDisabled]}
              onPress={() => handleSendMessage()}
              disabled={!inputText.trim() || isLoading}
            >
              <Text style={styles.sendButtonText}>
                {isLoading ? '⏳' : '🚀'}
              </Text>
            </TouchableOpacity>
          </GlassCard>
        </View>
      </View>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: Colors.background,
  },
  headerBanner: {
    marginHorizontal: Spacing.md,
    marginTop: Spacing.xl + Spacing.sm, // Extra padding for notch/camera cutouts
    marginBottom: Spacing.xs,
    paddingVertical: Spacing.sm,
    paddingHorizontal: Spacing.md,
  },
  bannerContent: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  bannerIcon: {
    fontSize: 32,
    marginRight: Spacing.sm,
  },
  bannerTextContainer: {
    flex: 1,
  },
  bannerTitle: {
    fontSize: Typography.fontSize.lg,
    fontWeight: 'bold',
    color: Colors.primary,
  },
  bannerSubtitle: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginTop: 2,
  },
  messagesContainer: {
    flex: 1,
  },
  messagesContent: {
    flexGrow: 1,
    padding: Spacing.md,
  },
  messageContainer: {
    marginBottom: Spacing.md,
    maxWidth: '85%',
  },
  userMessageContainer: {
    alignSelf: 'flex-end',
  },
  userBubble: {
    backgroundColor: Colors.primary,
  },
  assistantBubble: {
    backgroundColor: Colors.glass,
  },
  userText: {
    color: Colors.text,
    fontSize: Typography.fontSize.md,
    lineHeight: 22,
  },
  assistantText: {
    color: Colors.text,
    fontSize: Typography.fontSize.md,
    lineHeight: 22,
  },
  loadingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: Spacing.sm,
  },
  loadingText: {
    color: Colors.textSecondary,
    fontSize: Typography.fontSize.sm,
    fontStyle: 'italic',
  },
  citationsContainer: {
    marginTop: Spacing.md,
    paddingTop: Spacing.md,
    borderTopWidth: 1,
    borderTopColor: Colors.glassBorder,
  },
  citationsLabel: {
    fontSize: Typography.fontSize.xs,
    color: Colors.textSecondary,
    marginBottom: Spacing.xs,
  },
  citationButtons: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: Spacing.xs,
  },
  citationButton: {
    backgroundColor: Colors.glassHighlight,
    paddingHorizontal: Spacing.sm,
    paddingVertical: Spacing.xs,
    borderRadius: BorderRadius.sm,
    borderWidth: 1,
    borderColor: Colors.primary,
  },
  citationText: {
    color: Colors.primary,
    fontSize: Typography.fontSize.xs,
    fontWeight: '600',
  },
  emptyState: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: Spacing.xl,
  },
  emptyIcon: {
    fontSize: 80,
    marginBottom: Spacing.lg,
  },
  emptyTitle: {
    fontSize: Typography.fontSize.xl,
    fontWeight: 'bold',
    color: Colors.text,
    marginBottom: Spacing.sm,
    textAlign: 'center',
  },
  emptySubtitle: {
    fontSize: Typography.fontSize.md,
    color: Colors.textSecondary,
    textAlign: 'center',
    marginBottom: Spacing.xl,
  },
  suggestionsContainer: {
    width: '100%',
    marginTop: Spacing.lg,
  },
  suggestionsTitle: {
    fontSize: Typography.fontSize.sm,
    color: Colors.textSecondary,
    marginBottom: Spacing.md,
    textAlign: 'center',
  },
  suggestionButton: {
    backgroundColor: Colors.glass,
    borderWidth: 1,
    borderColor: Colors.glassBorder,
    borderRadius: BorderRadius.md,
    padding: Spacing.md,
    marginBottom: Spacing.sm,
  },
  suggestionText: {
    color: Colors.text,
    fontSize: Typography.fontSize.sm,
    textAlign: 'center',
  },
  inputContainer: {
    padding: Spacing.md,
    paddingBottom: Platform.OS === 'ios' ? Spacing.xl : Spacing.md,
  },
  inputCard: {
    flexDirection: 'row',
    alignItems: 'flex-end',
    padding: Spacing.sm,
  },
  input: {
    flex: 1,
    color: Colors.text,
    fontSize: Typography.fontSize.md,
    maxHeight: 100,
    paddingHorizontal: Spacing.sm,
  },
  sendButton: {
    width: 44,
    height: 44,
    borderRadius: BorderRadius.full,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginLeft: Spacing.sm,
  },
  sendButtonDisabled: {
    backgroundColor: Colors.glass,
    opacity: 0.5,
  },
  sendButtonText: {
    fontSize: 24,
  },
});

// Markdown styles for AI responses
const markdownStyles = {
  body: {
    color: Colors.text,
    fontSize: Typography.fontSize.md,
    lineHeight: 22,
  },
  paragraph: {
    marginTop: 0,
    marginBottom: Spacing.sm,
    color: Colors.text,
  },
  strong: {
    fontWeight: 'bold' as const,
    color: Colors.primary,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  list_item: {
    flexDirection: 'row' as const,
    marginBottom: Spacing.xs,
  },
  bullet_list: {
    marginBottom: Spacing.sm,
  },
  ordered_list: {
    marginBottom: Spacing.sm,
  },
  code_inline: {
    backgroundColor: Colors.glassHighlight,
    color: Colors.primary,
    paddingHorizontal: 4,
    paddingVertical: 2,
    borderRadius: 4,
    fontFamily: Platform.OS === 'ios' ? 'Courier' : 'monospace',
  },
  fence: {
    backgroundColor: Colors.glassHighlight,
    padding: Spacing.sm,
    borderRadius: BorderRadius.sm,
    marginVertical: Spacing.xs,
  },
  heading1: {
    fontSize: Typography.fontSize.xl,
    fontWeight: 'bold' as const,
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  heading2: {
    fontSize: Typography.fontSize.lg,
    fontWeight: 'bold' as const,
    color: Colors.text,
    marginTop: Spacing.sm,
    marginBottom: Spacing.xs,
  },
  heading3: {
    fontSize: Typography.fontSize.md,
    fontWeight: 'bold' as const,
    color: Colors.primary,
    marginTop: Spacing.xs,
    marginBottom: Spacing.xs,
  },
  link: {
    color: Colors.primary,
    textDecorationLine: 'underline' as const,
    fontWeight: '600' as const,
  },
};
