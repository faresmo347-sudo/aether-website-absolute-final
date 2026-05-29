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
      <div className="bg-card rounded-2xl rounded-bl-md px-4 sm:px-5 py-3.5 border border-border shadow-sm max-w-[85%]">
        <div className="flex items-center gap-2 mb-2">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center">
            <Brain size={10} className="text-white" />
          </div>
          <span className="text-[10px] font-semibold text-[#9D8BA7] uppercase tracking-wider">
            Aether
          </span>
        </div>
        <div className="flex items-center gap-1.5 py-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-2 w-2 rounded-full bg-[#9D8BA7]/40"
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
      </div>
    </div>
  )
})

/* ─────────── Inline Memory Card (memoized) ─────────── */
const InlineMemoryCard = memo(function InlineMemoryCard({ memory }: { memory: { id: string; title: string; content: string; type: MemoryType } }) {
  const Icon = typeIconMap[memory.type]
  return (
    <div className="rounded-xl border border-border bg-background p-3 mt-2 hover:border-[#9D8BA7]/20 transition-all duration-300">
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-[#9D8BA7]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon size={13} className="text-[#9D8BA7]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{memory.title}</p>
          <p className="text-[11px] text-muted-foreground line-clamp-2 mt-0.5 leading-relaxed">{memory.content}</p>
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

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-[#9D8BA7] text-white rounded-2xl rounded-br-md px-4 sm:px-5 py-3 max-w-[75%] ml-auto shadow-sm">
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
      <div className="bg-card rounded-2xl rounded-bl-md px-4 sm:px-5 py-3.5 sm:py-4 max-w-[85%] border border-border shadow-sm">
        <div className="flex items-center gap-2 mb-2.5">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center">
            <Brain size={12} className="text-white" />
          </div>
          <span className="text-[10px] font-semibold text-[#9D8BA7] uppercase tracking-wider">
            Aether
          </span>
        </div>

        <p className="text-sm text-foreground leading-relaxed">{message.content}</p>

        {referencedMems.length > 0 && (
          <div className="mt-3 space-y-2">
            {referencedMems.map((mem) => (
              <InlineMemoryCard key={mem.id} memory={mem} />
            ))}
          </div>
        )}

        {message.sourcesCount && message.sourcesCount > 0 && (
          <div className="mt-3 pt-2 border-t border-border">
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
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden bg-background">
      {/* Header — compact on mobile */}
      <div className="flex-shrink-0 px-4 sm:px-6 pt-3 sm:pt-6 pb-2 sm:pb-4 border-b border-border bg-background/80 backdrop-blur-sm">
        <div className="md:max-w-3xl md:mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-9 w-9 sm:h-10 sm:w-10 rounded-2xl bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center shadow-lg shadow-[#9D8BA7]/20">
              <Brain size={18} className="text-white sm:size-5" />
            </div>
            <div>
              <h1 className="text-lg sm:text-xl font-bold text-foreground">Ask Aether</h1>
              {/* Subtitle hidden on mobile to save space */}
              <p className="hidden sm:block text-xs text-muted-foreground">
                Ask anything about your memories in natural language
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Questions — wraps on mobile, scrollable horizontal on desktop */}
      {memories.length > 0 && chatMessages.length === 0 && (
        <div className="flex-shrink-0 py-2.5 px-4 border-b border-border/50 bg-background/60">
          <div className="md:max-w-3xl md:mx-auto">
            <div className="flex flex-wrap gap-2">
              {starterQuestions.map((question) => (
                <button
                  key={question}
                  onClick={() => handleStarterClick(question)}
                  className="px-3.5 py-2 rounded-2xl border border-[#9D8BA7]/15 bg-card text-sm text-foreground hover:bg-[#9D8BA7]/5 hover:border-[#9D8BA7]/30 transition-all duration-300 shadow-sm min-h-[40px]"
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

      {/* Chat Area — fills remaining space */}
      <div
        ref={chatContainerRef}
        className="flex-1 min-h-0 overflow-y-auto ios-scroll px-4 sm:px-6 py-4 sm:py-6"
      >
        <div className="md:max-w-3xl md:mx-auto flex flex-col min-h-full gap-3 sm:gap-4">
          {/* Empty state — no memories yet */}
          {memories.length === 0 && chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[#9D8BA7]/15 to-[#9D8BA7]/5 flex items-center justify-center mb-6 shadow-sm">
                <Brain size={36} className="text-[#9D8BA7]" />
              </div>
              <h2 className="text-xl font-bold text-foreground mb-3">Ask Aether</h2>
              <p className="text-sm text-muted-foreground max-w-xs mb-6 leading-relaxed">
                Your AI-powered memory assistant. Save some memories and then ask me anything about them.
              </p>
              <Button
                onClick={() => { setCurrentView('dashboard'); setCaptureModalOpen(true); }}
                className="w-full sm:w-auto rounded-full px-6 shadow-lg shadow-[#9D8BA7]/20 min-h-[48px]"
                style={{ backgroundColor: '#9D8BA7', color: '#fff', border: 'none' }}
              >
                <Plus className="size-4 mr-1.5" />
                Capture a Memory
              </Button>
            </div>
          )}

          {/* Empty state — has memories but no chat messages */}
          {memories.length > 0 && chatMessages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
              <div className="h-20 w-20 rounded-3xl bg-gradient-to-br from-[#9D8BA7]/15 to-[#9D8BA7]/5 flex items-center justify-center mb-5 shadow-sm">
                <Brain size={32} className="text-[#9D8BA7]/70" />
              </div>
              <h3 className="text-lg font-semibold text-foreground mb-2">What would you like to know?</h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed">
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

      {/* Input Bar — fixed above bottom nav on mobile */}
      <div className="shrink-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border pb-16 md:pb-2">
        <div className="md:max-w-3xl md:mx-auto px-4 sm:px-6 py-2.5 sm:py-4">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                    e.preventDefault()
                    handleSend()
                  }
                }}
                placeholder="Ask Aether anything..."
                disabled={isChatThinking}
                aria-label="Ask Aether a question"
                className="w-full bg-background rounded-2xl border border-border px-4 sm:px-5 py-2.5 text-sm text-foreground placeholder:text-muted-foreground/50 focus:outline-none focus:border-[#9D8BA7]/30 focus:ring-2 focus:ring-[#9D8BA7]/10 transition-all duration-300 disabled:opacity-50 shadow-sm min-h-[44px] resize-none"
              />
              {/* Microphone button inside input */}
              <button
                className="absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center text-muted-foreground hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 transition-colors duration-150 active:bg-[#9D8BA7]/10"
                aria-label="Voice input"
              >
                <Mic size={18} />
              </button>
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isChatThinking}
              size="icon"
              aria-label="Send message"
              className="h-11 w-11 sm:h-11 sm:w-11 rounded-2xl bg-[#9D8BA7] hover:bg-[#6D597A] text-white shadow-lg shadow-[#9D8BA7]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#9D8BA7]/30 disabled:opacity-40 disabled:shadow-none flex-shrink-0"
            >
              {isChatThinking ? (
                <Loader2 size={18} className="animate-spin" />
              ) : (
                <Send size={18} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </div>
  )
}
