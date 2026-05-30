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
  AlertCircle,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { useAetherStore } from '@/store/aether-store'
import { useOnlineStatus } from '@/hooks/use-online-status'
import type { ChatMessage, MemoryType } from '@/components/aether/types'

function getSupportedMimeType(): string {
  const types = [
    'audio/webm;codecs=opus',
    'audio/webm',
    'audio/ogg;codecs=opus',
    'audio/mp4',
  ]
  for (const type of types) {
    if (MediaRecorder.isTypeSupported(type)) return type
  }
  return '' // let browser decide
}

const starterQuestions = [
  'What ideas did I save this week?',
  'What was that book recommendation?',
  'Show me everything about my travel plans',
  "Hey Aether, what's up?",
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

        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">{message.content}</p>

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

        {message.confidence === 'low' && (
          <div className="mt-2 flex items-start gap-1.5">
            <AlertCircle size={11} className="text-muted-foreground/50 mt-0.5 flex-shrink-0" />
            <span className="text-[11px] text-muted-foreground/50 leading-relaxed">
              I couldn&apos;t find anything about that in your memories — it might not be saved yet
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
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const chatEndRef = useRef<HTMLDivElement>(null)
  const chatContainerRef = useRef<HTMLDivElement>(null)
  const mediaRecorderRef = useRef<MediaRecorder | null>(null)
  const audioChunksRef = useRef<Blob[]>([])

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

  // Build conversation history for the API (last N messages for context)
  const chatHistoryForApi = useMemo(
    () =>
      chatMessages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    [chatMessages]
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

    // Check if memories are loaded before sending API request
    if (memories.length === 0) {
      // Wait a moment for hydration, then proceed
      await new Promise((resolve) => setTimeout(resolve, 1500))
      // Re-check after waiting
      const currentMemories = useAetherStore.getState().memories
      if (currentMemories.length === 0) {
        // Still no memories — send request anyway (API handles empty case gracefully)
        // But log the state for debugging
        console.log('[Aether] Sending request with 0 memories — may still be loading')
      }
    }

    try {
      // Get fresh memories from store (may have loaded since component mounted)
      const freshMemories = useAetherStore.getState().memories
      const apiMemories = freshMemories.length > 0
        ? freshMemories.map((m) => ({
            id: m.id,
            type: m.type,
            title: m.title,
            content: m.content,
            tags: m.tags,
            createdAt: m.createdAt,
            aiSummary: m.aiSummary,
            collectionId: m.collectionId,
          }))
        : memoriesForApi

      console.log(`[Aether] Sending request with ${apiMemories.length} memories`)

      // 15 second timeout for slow mobile connections
      const controller = new AbortController()
      const timeoutId = setTimeout(() => controller.abort(), 15000)

      const res = await fetch('/api/ai/ask', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          question: text.trim(),
          memories: apiMemories,
          chatHistory: chatHistoryForApi,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const data = await res.json()

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: data.answer || "I couldn't find anything about that in your memories — it might not be saved yet.",
        referencedMemories: data.referencedIds || [],
        sourcesCount: data.sourcesCount || 0,
        detectedMode: data.detectedMode,
        confidence: data.confidence,
        timestamp: new Date().toISOString(),
      }
      addChatMessage(assistantMsg)
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError'
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: isTimeout
          ? "That took too long — try again when you have a stronger connection. I'm here whenever you're ready!"
          : "I had trouble reaching my thinking space. Please try again — I'm here for you.",
        referencedMemories: [],
        sourcesCount: 0,
        timestamp: new Date().toISOString(),
      }
      addChatMessage(assistantMsg)
    } finally {
      setChatThinking(false)
    }
  }, [addChatMessage, setChatThinking, memoriesForApi, chatHistoryForApi, isOnline, memories])

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      const mimeType = getSupportedMimeType()
      const mediaRecorder = mimeType
        ? new MediaRecorder(stream, { mimeType })
        : new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          audioChunksRef.current.push(event.data)
        }
      }

      mediaRecorder.onstop = async () => {
        // Stop all tracks to release microphone
        stream.getTracks().forEach((track) => track.stop())

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })

        // Convert to base64
        const reader = new FileReader()
        reader.onloadend = async () => {
          const base64Audio = (reader.result as string).split(',')[1]
          setIsTranscribing(true)

          try {
            const res = await fetch('/api/ai/transcribe', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ audio: base64Audio }),
            })

            const data = await res.json()
            if (data.transcription?.trim()) {
              setInput((prev) => (prev ? prev + ' ' + data.transcription.trim() : data.transcription.trim()))
            }
          } catch {
            // Silently fail — transcription not critical
          } finally {
            setIsTranscribing(false)
          }
        }
        reader.readAsDataURL(audioBlob)
      }

      mediaRecorderRef.current = mediaRecorder
      mediaRecorder.start()
      setIsRecording(true)
    } catch {
      // Microphone permission denied or not available
      setIsRecording(false)
    }
  }, [])

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state === 'recording') {
      mediaRecorderRef.current.stop()
      setIsRecording(false)
    }
  }, [])

  const toggleRecording = useCallback(() => {
    if (isRecording) {
      stopRecording()
    } else {
      startRecording()
    }
  }, [isRecording, startRecording, stopRecording])

  const handleSend = useCallback(() => {
    processMessage(input)
  }, [input, processMessage])

  const handleStarterClick = useCallback((question: string) => {
    processMessage(question)
  }, [processMessage])

  // Mix of starter questions
  const displayStarters = memories.length > 0
    ? starterQuestions
    : starterQuestions.slice(3)

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
              <p className="hidden sm:block text-xs text-muted-foreground">
                Search your memories or just ask me anything
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Questions — horizontally scrollable on all viewports */}
      {chatMessages.length === 0 && (
        <div className="flex-shrink-0 py-2.5 px-4 border-b border-border/50 bg-background/60">
          <div className="md:max-w-3xl md:mx-auto">
            <div className="overflow-x-auto flex-nowrap scrollbar-none gap-2 flex">
              {displayStarters.map((question) => (
                <button
                  key={question}
                  onClick={() => handleStarterClick(question)}
                  className="px-3.5 py-2 rounded-2xl border border-[#9D8BA7]/15 bg-card text-sm text-foreground hover:bg-[#9D8BA7]/5 hover:border-[#9D8BA7]/30 transition-all duration-300 shadow-sm min-h-[40px] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <span className="text-[#9D8BA7]">&ldquo;</span>
                  {question.replace(/^"|"$/g, '')}
                  <span className="text-[#9D8BA7]">&rdquo;</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      )}

      {/* Chat Area — fills remaining space */}
      <div
        ref={chatContainerRef}
        className="flex-1 min-h-0 overflow-y-auto ios-scroll px-4 sm:px-6 py-4 sm:py-6 pb-4 md:pb-6"
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
                Your AI companion — search your memories, ask questions, or just chat. I&apos;ll understand what you need.
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
                Ask about your memories or just say hi — I&apos;ll understand what you need.
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

      {/* Input Bar — fixed above bottom nav on mobile, adapts to keyboard */}
      <div
        className="shrink-0 z-30 bg-card/95 backdrop-blur-sm border-t border-border"
        style={{
          paddingBottom: 'max(0.5rem, env(safe-area-inset-bottom, 0px))',
        }}
      >
        <div className="md:max-w-3xl md:mx-auto px-4 sm:px-6 py-2.5 sm:py-3">
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
                onClick={toggleRecording}
                className={`absolute right-3 top-1/2 -translate-y-1/2 min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center transition-all duration-200 ${
                  isRecording
                    ? 'text-red-500 bg-red-500/10'
                    : 'text-muted-foreground hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 active:bg-[#9D8BA7]/10'
                }`}
                aria-label={isRecording ? 'Stop recording' : 'Voice input'}
              >
                {isRecording ? (
                  <span className="relative flex h-5 w-5 items-center justify-center">
                    <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-50" />
                    <Mic size={18} className="relative" />
                  </span>
                ) : (
                  <Mic size={18} />
                )}
              </button>
              {/* Transcribing indicator */}
              {isTranscribing && (
                <span className="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-muted-foreground">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="hidden sm:inline">Transcribing…</span>
                </span>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isChatThinking}
              size="icon"
              aria-label="Send message"
              className="h-12 w-12 rounded-2xl bg-[#9D8BA7] hover:bg-[#6D597A] text-white shadow-lg shadow-[#9D8BA7]/20 transition-all duration-300 hover:shadow-xl hover:shadow-[#9D8BA7]/30 disabled:opacity-40 disabled:shadow-none flex-shrink-0 active:scale-95"
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
