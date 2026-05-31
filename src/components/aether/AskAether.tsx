'use client'

import { useState, useRef, useEffect, useMemo, useCallback, memo } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import {
  Brain,
  Send,
  Mic,
  FileText,
  Link2,
  Image as ImageIcon,
  Loader2,
  Plus,
  Sparkles,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAetherStore } from '@/store/aether-store'
import { useOnlineStatus } from '@/hooks/use-online-status'
import type { ChatMessage, MemoryType } from '@/components/aether/types'

const starterQuestions = [
  'What ideas did I save this week?',
  'What was that book recommendation?',
  'Show me everything about my travel plans',
]

const typeIconMap: Record<MemoryType, typeof FileText> = {
  text: FileText,
  voice: Mic,
  link: Link2,
  image: ImageIcon,
}

/* ─────────── Typing Indicator (memoized) ─────────── */
const TypingIndicator = memo(function TypingIndicator() {
  return (
    <div className="flex justify-start">
      <div
        className="px-4 sm:px-5 py-3.5 max-w-[80%] border"
        style={{
          background: 'rgba(15,15,26,0.9)',
          borderColor: 'rgba(157,139,167,0.15)',
          borderRadius: '4px 16px 16px 16px',
        }}
      >
        <div className="flex items-center gap-2 mb-2">
          <div
            className="h-7 w-7 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center"
            style={{ boxShadow: '0 0 12px rgba(157,139,167,0.4)' }}
          >
            <Brain size={11} className="text-white" />
          </div>
          <span className="text-[10px] font-semibold text-[#9D8BA7] uppercase tracking-wider">
            Aether
          </span>
        </div>
        <div className="flex items-center gap-1.5 py-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full"
              style={{ backgroundColor: 'rgba(157,139,167,0.6)' }}
              animate={{ y: [0, -6, 0] }}
              transition={{
                duration: 0.6,
                delay: i * 0.15,
                repeat: Infinity,
                ease: 'easeInOut',
              }}
            />
          ))}
        </div>
        <p
          className="text-[10px] mt-1.5"
          style={{ color: 'rgba(240,240,248,0.3)' }}
        >
          Aether is thinking...
        </p>
      </div>
    </div>
  )
})

/* ─────────── Inline Memory Card (memoized) ─────────── */
const InlineMemoryCard = memo(function InlineMemoryCard({ memory }: { memory: { id: string; title: string; content: string; type: MemoryType } }) {
  const Icon = typeIconMap[memory.type]
  return (
    <div
      className="rounded-xl border p-3 mt-2 transition-all duration-300 hover:border-[#9D8BA7]/25"
      style={{
        background: 'rgba(15,15,26,0.6)',
        borderColor: 'rgba(157,139,167,0.1)',
      }}
    >
      <div className="flex items-start gap-2.5">
        <div
          className="h-7 w-7 rounded-lg flex items-center justify-center flex-shrink-0 mt-0.5"
          style={{ background: 'rgba(157,139,167,0.08)' }}
        >
          <Icon size={13} className="text-[#9D8BA7]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-[#f0f0f8] truncate">{memory.title}</p>
          <p
            className="text-[11px] line-clamp-2 mt-0.5 leading-relaxed"
            style={{ color: 'rgba(240,240,248,0.45)' }}
          >
            {memory.content}
          </p>
        </div>
      </div>
    </div>
  )
})

/* ─────────── Chat Message Bubble (memoized) ─────────── */
const ChatBubble = memo(function ChatBubble({
  message,
  memories,
}: {
  message: ChatMessage
  memories: { id: string; title: string; content: string; type: MemoryType }[]
}) {
  const isUser = message.role === 'user'

  // Character-by-character typing animation for short assistant messages
  const shouldAnimateTyping =
    !isUser &&
    message.content.length < 200 &&
    message.content.length > 0

  const [displayedChars, setDisplayedChars] = useState(() => {
    if (!shouldAnimateTyping) return message.content.length
    // If the message is older than 3 seconds, show it instantly
    const msgAge = Date.now() - new Date(message.timestamp).getTime()
    if (msgAge > 3000) return message.content.length
    return 0
  })

  useEffect(() => {
    if (!shouldAnimateTyping || displayedChars >= message.content.length) return

    const interval = setInterval(() => {
      setDisplayedChars((prev) => {
        if (prev >= message.content.length) {
          clearInterval(interval)
          return prev
        }
        return prev + 1
      })
    }, 18)

    return () => clearInterval(interval)
  }, [message.id])

  const isTyping = shouldAnimateTyping && displayedChars < message.content.length
  const displayContent = isUser
    ? message.content
    : message.content.slice(0, displayedChars)

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div
          className="px-4 sm:px-5 py-3 max-w-[80%] border"
          style={{
            background: 'linear-gradient(135deg, rgba(157,139,167,0.15), rgba(192,132,252,0.1))',
            borderColor: 'rgba(157,139,167,0.2)',
            borderRadius: '16px 4px 16px 16px',
            color: '#f0f0f8',
          }}
        >
          <p className="text-sm leading-relaxed">{message.content}</p>
        </div>
      </div>
    )
  }

  const referencedMems = message.referencedMemories
    ? memories.filter((m) => message.referencedMemories?.includes(m.id))
    : []

  return (
    <div className="flex justify-start">
      <div
        className="px-4 sm:px-5 py-3.5 sm:py-4 max-w-[80%] border"
        style={{
          background: 'rgba(15,15,26,0.9)',
          borderColor: 'rgba(157,139,167,0.15)',
          borderRadius: '4px 16px 16px 16px',
        }}
      >
        <div className="flex items-center gap-2 mb-2.5">
          <div
            className="h-7 w-7 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center"
            style={{ boxShadow: '0 0 12px rgba(157,139,167,0.4)' }}
          >
            <Brain size={12} className="text-white" />
          </div>
          <span className="text-[10px] font-semibold text-[#9D8BA7] uppercase tracking-wider">
            Aether
          </span>
        </div>

        <p className="text-sm text-[#f0f0f8] leading-relaxed">
          {displayContent}
          {isTyping && (
            <span className="animate-blink-cursor inline-block ml-0.5 w-[2px] h-[14px] align-middle bg-[#c084fc]" />
          )}
        </p>

        {referencedMems.length > 0 && (
          <div className="mt-3 space-y-2">
            {referencedMems.map((mem) => (
              <InlineMemoryCard key={mem.id} memory={mem} />
            ))}
          </div>
        )}

        {message.sourcesCount && message.sourcesCount > 0 && (
          <div
            className="mt-3 pt-2 border-t"
            style={{ borderColor: 'rgba(157,139,167,0.1)' }}
          >
            <span className="inline-flex items-center gap-1.5 text-[10px] font-medium text-[#9D8BA7]/70">
              <FileText size={10} />
              Sources: {message.sourcesCount} memories
            </span>
          </div>
        )}
      </div>
    </div>
  )
})

/* ─────────── Ask Aether ─────────── */
export function AskAether() {
  const { chatMessages, addChatMessage, isChatThinking, setChatThinking, memories, setCurrentView, setCaptureModalOpen } = useAetherStore()
  const isOnline = useOnlineStatus()
  const [input, setInput] = useState('')
  const [inputFocused, setInputFocused] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)

  // Memoize the memory list for lookup
  const memoryLookup = useMemo(
    () =>
      memories.map((m) => ({
        id: m.id,
        title: m.title,
        content: m.content,
        type: m.type,
      })),
    [memories]
  )

  // Memoize the full memory data for API calls
  const memoriesForApi = useMemo(
    () =>
      memories.map((m) => ({
        id: m.id,
        type: m.type,
        title: m.title,
        content: m.content,
        tags: m.tags,
        createdAt: m.createdAt,
        aiSummary: m.aiSummary,
        collectionId: m.collectionId,
      })),
    [memories]
  )

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [chatMessages, isChatThinking])

  const processMessage = useCallback(async (text: string) => {
    if (!text.trim()) return

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }
    addChatMessage(userMsg)
    setInput('')
    setChatThinking(true)

    // If offline, do a local keyword search through cached memories
    if (!isOnline) {
      const query = text.trim().toLowerCase()
      const results = memories.filter((m) => {
        const searchable = `${m.title} ${m.content} ${m.tags.join(' ')}`.toLowerCase()
        return query.split(' ').some((word) => word.length > 2 && searchable.includes(word))
      })

      const offlineAnswer = results.length > 0
        ? `I found ${results.length} cached memor${results.length === 1 ? 'y' : 'ies'} matching your question. Here's what I found:\n\n${results.slice(0, 3).map((m) => `- **${m.title}**: ${m.content.slice(0, 100)}...`).join('\n')}\n\n_Searching your cached memories — reconnect for full AI-powered results._`
        : "I couldn't find any cached memories matching your question. _Searching your cached memories — reconnect for full AI-powered results._"

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: offlineAnswer,
        referencedMemories: results.slice(0, 3).map((m) => m.id),
        sourcesCount: results.length,
        timestamp: new Date().toISOString(),
      }
      addChatMessage(assistantMsg)
      setChatThinking(false)
      return
    }

    try {
      // Call the AI ask API (Groq-powered)
      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text.trim(),
          memories: memoriesForApi,
        }),
      })

      const data = await res.json()

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || "I couldn't find any relevant memories for your question.",
        referencedMemories: data.referencedIds || [],
        sourcesCount: data.sourcesCount || 0,
        timestamp: new Date().toISOString(),
      }
      addChatMessage(assistantMsg)
    } catch {
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: "Sorry, I had trouble searching your memories. Please try again.",
        referencedMemories: [],
        sourcesCount: 0,
        timestamp: new Date().toISOString(),
      }
      addChatMessage(assistantMsg)
    } finally {
      setChatThinking(false)
    }
  }, [addChatMessage, setChatThinking, memoriesForApi, isOnline, memories])

  const handleSend = useCallback(() => {
    processMessage(input)
  }, [input, processMessage])

  const handleStarterClick = useCallback((question: string) => {
    processMessage(question)
  }, [processMessage])

  return (
    <div
      className="flex flex-col flex-1 min-h-0 overflow-hidden"
      style={{ background: '#07070f' }}
    >
      {/* Header — compact, transparent */}
      <div
        className="flex-shrink-0 px-4 sm:px-6 pt-3 sm:pt-5 pb-2 sm:pb-3"
        style={{
          background: 'rgba(7,7,15,0.85)',
          backdropFilter: 'blur(12px)',
          borderBottom: '1px solid rgba(157,139,167,0.08)',
        }}
      >
        <div className="md:max-w-3xl md:mx-auto">
          <div className="flex items-center gap-3">
            <div
              className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center"
              style={{ boxShadow: '0 0 20px rgba(157,139,167,0.35)' }}
            >
              <Brain size={18} className="text-white sm:size-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-[#f0f0f8]">Ask Aether</h1>
              <p
                className="hidden sm:block text-xs"
                style={{ color: 'rgba(240,240,248,0.45)' }}
              >
                Ask anything about your memories in natural language
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Questions — deep-space pill styling */}
      {memories.length > 0 && chatMessages.length === 0 && (
        <div
          className="flex-shrink-0 py-2.5 px-4"
          style={{
            background: 'rgba(7,7,15,0.6)',
            borderBottom: '1px solid rgba(157,139,167,0.06)',
          }}
        >
          <div className="md:max-w-3xl md:mx-auto">
            <div className="flex flex-wrap gap-2">
              {starterQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => handleStarterClick(question)}
                  className="px-3.5 py-2 rounded-xl border text-sm min-h-[40px] transition-all duration-300 hover:border-[rgba(157,139,167,0.3)]"
                  style={{
                    background: 'rgba(15,15,26,0.8)',
                    borderColor: 'rgba(157,139,167,0.15)',
                    color: '#f0f0f8',
                  }}
                  onMouseEnter={(e) => {
                    e.currentTarget.style.background = 'rgba(157,139,167,0.08)'
                    e.currentTarget.style.borderColor = 'rgba(157,139,167,0.3)'
                  }}
                  onMouseLeave={(e) => {
                    e.currentTarget.style.background = 'rgba(15,15,26,0.8)'
                    e.currentTarget.style.borderColor = 'rgba(157,139,167,0.15)'
                  }}
                >
                  <span className="text-[#9D8BA7] mr-0.5">&ldquo;</span>
                  {question.replace(/^"|"$/g, '')}
                  <span className="text-[#9D8BA7] ml-0.5">&rdquo;</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat Area — deep space with holographic grid */}
      <div
        ref={chatContainerRef}
        className="flex-1 min-h-0 overflow-y-auto ios-scroll px-4 sm:px-6 py-4 sm:py-6"
        style={{
          backgroundImage:
            'linear-gradient(rgba(157,139,167,0.03) 1px, transparent 1px), linear-gradient(90deg, rgba(157,139,167,0.03) 1px, transparent 1px)',
          backgroundSize: '50px 50px',
          animation: 'grid-scan 20s linear infinite',
        }}
      >
        <div className="md:max-w-3xl md:mx-auto flex flex-col min-h-full gap-3 sm:gap-4">
          {/* Empty state — no memories yet */}
          {memories.length === 0 && chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
              <div
                className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[#9D8BA7]/15 to-[#9D8BA7]/5 flex items-center justify-center mb-6 animate-star-pulse"
                style={{ boxShadow: '0 0 30px rgba(157,139,167,0.15)' }}
              >
                <Sparkles size={36} className="text-[#9D8BA7]" />
              </div>
              <h2 className="text-xl font-bold text-[#f0f0f8] mb-3">Ask Aether</h2>
              <p
                className="text-sm max-w-xs mb-6 leading-relaxed"
                style={{ color: 'rgba(240,240,248,0.45)' }}
              >
                Your AI-powered memory assistant. Save some memories and then ask me anything about them.
              </p>
              <Button
                onClick={() => { setCurrentView('dashboard'); setCaptureModalOpen(true); }}
                className="w-full sm:w-auto rounded-full px-6 min-h-[48px] bg-gradient-to-r from-[#9D8BA7] to-[#c084fc] hover:from-[#9D8BA7]/90 hover:to-[#c084fc]/90 text-white border-none shadow-lg shadow-[#9D8BA7]/20"
              >
                <Plus className="size-4 mr-1.5" />
                Capture a Memory
              </Button>
            </div>
          )}

          {/* Empty state — has memories but no chat messages */}
          {memories.length > 0 && chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
              <div
                className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[#9D8BA7]/15 to-[#9D8BA7]/5 flex items-center justify-center mb-5 animate-star-pulse"
                style={{ boxShadow: '0 0 25px rgba(157,139,167,0.12)' }}
              >
                <Brain size={32} className="text-[#9D8BA7]/70" />
              </div>
              <h3 className="text-lg font-semibold text-[#f0f0f8] mb-2">What would you like to know?</h3>
              <p
                className="text-sm max-w-xs leading-relaxed"
                style={{ color: 'rgba(240,240,248,0.45)' }}
              >
                Ask a question about your memories and I&apos;ll search through everything you&apos;ve saved.
              </p>
            </div>
          )}

          {/* Chat messages */}
          {chatMessages.map((msg) => (
            <ChatBubble key={msg.id} message={msg} memories={memoryLookup} />
          ))}

          {/* Typing indicator */}
          {isChatThinking && <TypingIndicator />}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Bar — futuristic deep-space style */}
      <div
        className="shrink-0 z-30 pb-16 md:pb-2"
        style={{
          background: 'rgba(15,15,26,0.95)',
          backdropFilter: 'blur(12px)',
          borderTop: '1px solid rgba(157,139,167,0.1)',
        }}
      >
        <div className="md:max-w-3xl md:mx-auto px-4 sm:px-6 py-2.5 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setInputFocused(false)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask Aether anything..."
                disabled={isChatThinking}
                aria-label="Ask Aether a question"
                className="w-full px-4 sm:px-5 py-2.5 text-sm min-h-[44px] resize-none transition-all duration-300 disabled:opacity-50 outline-none"
                style={{
                  background: 'rgba(255,255,255,0.04)',
                  border: inputFocused
                    ? '1px solid rgba(192,132,252,0.4)'
                    : '1px solid rgba(157,139,167,0.15)',
                  borderRadius: '12px',
                  color: '#f0f0f8',
                  boxShadow: inputFocused
                    ? '0 0 0 3px rgba(192,132,252,0.1)'
                    : 'none',
                  caretColor: '#c084fc',
                }}
              />
              {/* Microphone button inside input */}
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-colors duration-150 active:bg-[#9D8BA7]/10"
                style={{ color: 'rgba(240,240,248,0.35)' }}
                aria-label="Voice input"
                onMouseEnter={(e) => {
                  e.currentTarget.style.color = '#9D8BA7'
                  e.currentTarget.style.background = 'rgba(157,139,167,0.05)'
                }}
                onMouseLeave={(e) => {
                  e.currentTarget.style.color = 'rgba(240,240,248,0.35)'
                  e.currentTarget.style.background = 'transparent'
                }}
              >
                <Mic size={18} />
              </button>
            </div>
            {/* Send button — purple gradient circle with glow */}
            <button
              onClick={handleSend}
              disabled={!input.trim() || isChatThinking}
              aria-label="Send message"
              className="h-11 w-11 sm:h-11 sm:w-11 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#c084fc] flex items-center justify-center flex-shrink-0 text-white transition-all duration-300 disabled:opacity-30 disabled:shadow-none"
              style={{
                boxShadow:
                  input.trim() && !isChatThinking
                    ? '0 4px 20px rgba(157,139,167,0.3)'
                    : '0 2px 10px rgba(157,139,167,0.15)',
              }}
              onMouseEnter={(e) => {
                if (input.trim() && !isChatThinking) {
                  e.currentTarget.style.boxShadow = '0 6px 28px rgba(157,139,167,0.45)'
                }
              }}
              onMouseLeave={(e) => {
                if (input.trim() && !isChatThinking) {
                  e.currentTarget.style.boxShadow = '0 4px 20px rgba(157,139,167,0.3)'
                }
              }}
            >
              {isChatThinking ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
