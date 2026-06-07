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
  Sparkles,
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

function formatRelativeDate(iso: string): string {
  const now = new Date()
  const date = new Date(iso)
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)
  if (diffMins < 1) return 'just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })
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
const TypingIndicator = memo(function TypingIndicator({ darkMode }: { darkMode: boolean }) {
  return (
    <div className="flex justify-start">
      <div className={`rounded-2xl rounded-bl-sm px-4 sm:px-5 py-3.5 max-w-[85%] sm:max-w-[70%] ${
        darkMode
          ? 'bg-[#9D8BA7]/5 border border-[#9D8BA7]/10'
          : 'bg-[#9D8BA7]/5 border border-[#9D8BA7]/15'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center">
            <Brain size={10} className="text-white animate-pulse-glow" />
          </div>
          <span className="text-[10px] font-semibold text-[#9D8BA7] uppercase tracking-wider">
            Aether is thinking...
          </span>
        </div>
        <div className="flex items-center gap-1.5 py-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#9D8BA7]/50"
              initial={{ opacity: 0.3, scale: 0.8 }}
              animate={{ opacity: [0.3, 1, 0.3], scale: [0.8, 1.1, 0.8] }}
              transition={{
                duration: 1.2,
                delay: i * 0.2,
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
const InlineMemoryCard = memo(function InlineMemoryCard({ memory, darkMode }: { memory: { id: string; title: string; content: string; type: MemoryType }; darkMode: boolean }) {
  const Icon = typeIconMap[memory.type]
  return (
    <div className={`rounded-xl border p-3 mt-2 hover:border-[#9D8BA7]/20 transition-all duration-300 ${
      darkMode
        ? 'border-border bg-background'
        : 'border-gray-200 bg-gray-50/50'
    }`}>
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-[#9D8BA7]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon size={13} className="text-[#9D8BA7]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{memory.title}</p>
          <p className={`text-[11px] line-clamp-2 mt-0.5 leading-relaxed ${
            darkMode ? 'text-muted-foreground' : 'text-gray-500'
          }`}>{memory.content}</p>
        </div>
      </div>
    </div>
  )
})

/* ─────────── Chat Message Bubble (memoized) ─────────── */
const ChatBubble = memo(function ChatBubble({
  message,
  memories,
  isStreaming,
  darkMode,
}: {
  message: ChatMessage
  memories: { id: string; title: string; content: string; type: MemoryType }[]
  isStreaming?: boolean
  darkMode: boolean
}) {
  const isUser = message.role === 'user'

  if (isUser) {
    return (
      <div className="flex justify-end">
        <div className="bg-[#9D8BA7] text-white rounded-2xl rounded-br-sm px-3 sm:px-5 py-2.5 sm:py-3 max-w-[85%] sm:max-w-[70%] ml-auto shadow-[inset_0_1px_0_rgba(255,255,255,0.1)]">
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
      <div className={`rounded-2xl rounded-bl-sm px-3 sm:px-5 py-2.5 sm:py-4 max-w-[85%] sm:max-w-[70%] relative overflow-hidden ${
        darkMode
          ? 'bg-[#9D8BA7]/8 border border-[#9D8BA7]/12'
          : 'bg-[#9D8BA7]/5 border border-[#9D8BA7]/12'
      }`}>
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] bg-[#9D8BA7]/30 rounded-l-2xl" />

        <div className="flex items-center gap-2 mb-2.5">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center">
            <Brain size={12} className="text-white" />
          </div>
          <span className="text-[10px] font-semibold text-[#9D8BA7] uppercase tracking-wider">
            Aether
          </span>
        </div>

        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {message.content}
          {isStreaming && (
            <span className="animate-blink-cursor text-[#9D8BA7] ml-0.5">▊</span>
          )}
        </p>

        {referencedMems.length > 0 && (
          <div className="mt-3 space-y-2">
            {referencedMems.map((mem) => (
              <InlineMemoryCard key={mem.id} memory={mem} darkMode={darkMode} />
            ))}
          </div>
        )}

        {message.confidence === 'low' && (
          <div className="mt-2 flex items-start gap-1.5">
            <AlertCircle size={11} className="text-muted-foreground/50 mt-0.5 flex-shrink-0" />
            <span className={`text-[11px] leading-relaxed ${
              darkMode ? 'text-muted-foreground/50' : 'text-gray-400'
            }`}>
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
  const { memories, setCurrentView, setCaptureModalOpen, user, darkMode } = useAetherStore()
  const isOnline = useOnlineStatus()

  // FIX 2: Local state only — no Zustand persistence, fresh on every mount
  const [messages, setMessages] = useState<ChatMessage[]>([])
  const [input, setInput] = useState('')
  const [isRecording, setIsRecording] = useState(false)
  const [isTranscribing, setIsTranscribing] = useState(false)
  const [isThinking, setIsThinking] = useState(false)
  const [streamingMessageId, setStreamingMessageId] = useState<string | null>(null)

  const [inputFocused, setInputFocused] = useState(false)
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
      messages.slice(-10).map((m) => ({
        role: m.role,
        content: m.content,
      })),
    [messages]
  )

  // Track streaming message for typing cursor effect
  const prevMessageCountRef = useRef(messages.length)
  useEffect(() => {
    if (messages.length > prevMessageCountRef.current) {
      const lastMsg = messages[messages.length - 1]
      if (lastMsg && lastMsg.role === 'assistant') {
        setStreamingMessageId(lastMsg.id)
        const timer = setTimeout(() => setStreamingMessageId(null), 1500)
        prevMessageCountRef.current = messages.length
        return () => clearTimeout(timer)
      }
    }
    prevMessageCountRef.current = messages.length
  }, [messages])

  // Auto-scroll to bottom on new messages
  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isThinking])

  const processMessage = useCallback(async (text: string) => {
    if (!text.trim()) return

    // Add user message
    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsThinking(true)

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
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
      setIsThinking(false)
      return
    }

    // Check if memories are loaded before sending API request
    if (memories.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }

    try {
      // Get fresh memories from store
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
          userId: user?.id,
        }),
        signal: controller.signal,
      })

      clearTimeout(timeoutId)

      const rawResponse = await res.json()

      // Safe response parsing — ONLY ever display the "answer" field
      let displayAnswer = ''
      let referencedIds: string[] = []

      try {
        if (rawResponse && typeof rawResponse === 'object' && typeof rawResponse.answer === 'string') {
          displayAnswer = rawResponse.answer.trim()
          referencedIds = Array.isArray(rawResponse.referencedIds) ? rawResponse.referencedIds : []
        } else if (typeof rawResponse === 'string') {
          try {
            const parsed = JSON.parse(rawResponse)
            displayAnswer = (parsed.answer || '').trim()
            referencedIds = Array.isArray(parsed.referencedIds) ? parsed.referencedIds : []
          } catch {
            displayAnswer = rawResponse.trim()
          }
        }
      } catch {
        displayAnswer = ''
      }

      // Clean any JSON artifacts that might have leaked into the answer
      displayAnswer = displayAnswer
        .replace(/\{[^}]*"referencedIds"[^}]*\}/g, '')
        .replace(/\{[^}]*"sourcesCount"[^}]*\}/g, '')
        .replace(/\{[^}]*"detectedMode"[^}]*\}/g, '')
        .replace(/\{[^}]*"confidence"[^}]*\}/g, '')
        .replace(/^\s*\{[\s\S]*\}\s*$/g, (match) => {
          try {
            const parsed = JSON.parse(match)
            return parsed.answer || ''
          } catch {
            return match
          }
        })
        .trim()

      // Fallback if answer is empty
      if (!displayAnswer) {
        displayAnswer = "Hmm something went wrong — try asking me again? 😊"
      }

      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: displayAnswer,
        referencedMemories: referencedIds,
        detectedMode: rawResponse?.detectedMode || 'conversation',
        confidence: rawResponse?.confidence || 'high',
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])

      // Fire-and-forget: Learn about the user from this conversation
      if (user?.id) {
        try {
          fetch('/api/ai/learn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              userMessage: text.trim(),
              conversationHistory: [...messages.slice(-6), assistantMsg].map((m) => ({
                role: m.role,
                content: m.content,
              })),
            }),
          }).catch(() => {
            // Fire-and-forget — never block or crash
          })
        } catch {
          // Silently ignore
        }
      }
    } catch (err: any) {
      const isTimeout = err?.name === 'AbortError'
      const assistantMsg: ChatMessage = {
        id: `assistant-${Date.now()}`,
        role: 'assistant',
        content: isTimeout
          ? "That took too long — try again when you have a stronger connection. I'm here whenever you're ready!"
          : "I had trouble reaching my thinking space. Please try again — I'm here for you.",
        referencedMemories: [],
        timestamp: new Date().toISOString(),
      }
      setMessages((prev) => [...prev, assistantMsg])
    } finally {
      setIsThinking(false)
    }
  }, [memoriesForApi, chatHistoryForApi, isOnline, memories, messages, user])

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
        stream.getTracks().forEach((track) => track.stop())

        const audioBlob = new Blob(audioChunksRef.current, { type: mimeType || 'audio/webm' })

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

  // Show suggestions inline when: no messages (always), or input focused with messages
  const showSuggestions = messages.length === 0 || (inputFocused && messages.length > 0)

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden overflow-x-hidden max-w-screen bg-background relative z-10">
      {/* Header — compact on mobile, flat bg */}
      <div className={`flex-shrink-0 px-4 md:px-6 pt-3 md:pt-5 pb-2 md:pb-3 border-b z-10 ${
        darkMode
          ? 'bg-[#0a0a0f] border-gray-800'
          : 'bg-white border-gray-200'
      }`}>
        <div className="md:max-w-3xl md:mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-2xl bg-gradient-to-br from-[#9D8BA7] to-[#6D597A] flex items-center justify-center shadow-lg shadow-[#9D8BA7]/20">
              <Brain size={16} className="text-white md:size-5" />
            </div>
            <div>
              <h1 className={`text-base md:text-xl font-bold ${darkMode ? 'text-white' : 'text-gray-900'}`}>Ask Aether</h1>
              <p className="hidden sm:block text-xs text-muted-foreground">
                Search your memories or just ask me anything
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Questions — INLINE, solid background, pushes content down */}
      <AnimatePresence>
        {showSuggestions && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.2, ease: 'easeInOut' }}
            className="flex-shrink-0 overflow-hidden z-20"
          >
            <div className={`py-2 px-4 border-b ${
              darkMode
                ? 'bg-[#0a0a0f] border-gray-800'
                : 'bg-white border-gray-200'
            }`}>
              <div className="md:max-w-3xl md:mx-auto">
                <div className="flex flex-col gap-2">
                  {displayStarters.map((question) => (
                    <button
                      key={question}
                      onClick={() => {
                        handleStarterClick(question)
                        setInputFocused(false)
                      }}
                      className={`w-full px-3 py-3 rounded-xl border text-[13px] transition-all duration-200 min-h-[44px] flex items-center gap-1.5 text-left active:scale-[0.97] cursor-pointer ${
                        darkMode
                          ? 'border-gray-700 bg-gray-800/50 text-gray-300 hover:bg-gray-800'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-[#9D8BA7]">&ldquo;</span>
                      {question.replace(/^"|"$/g, '')}
                      <span className="text-[#9D8BA7]">&rdquo;</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area — clean flat bg on mobile */}
      <div
        ref={chatContainerRef}
        className={`flex-1 min-h-0 overflow-y-auto ios-scroll px-4 md:px-6 py-3 md:py-5 pb-4 md:pb-6 ${darkMode ? 'bg-[#050505]' : 'bg-gray-50'}`}
      >
        <div className="md:max-w-3xl md:mx-auto flex flex-col min-h-full gap-2 md:gap-4">
          {/* Empty state — no memories yet */}
          {memories.length === 0 && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
              <div className="h-14 w-14 md:h-20 md:w-20 rounded-3xl bg-gradient-to-br from-[#9D8BA7]/15 to-[#9D8BA7]/5 flex items-center justify-center mb-3 md:mb-6 shadow-sm">
                <Brain size={24} className="text-[#9D8BA7] md:size-8" />
              </div>
              <h2 className="text-base md:text-lg font-bold text-foreground mb-1.5 md:mb-3">Ask Aether</h2>
              <p className="text-sm text-muted-foreground max-w-xs mb-3 md:mb-6 leading-relaxed">
                Your AI companion — search your memories, ask questions, or just chat. I&apos;ll understand what you need.
              </p>
              <Button
                onClick={() => { setCurrentView('dashboard'); setCaptureModalOpen(true); }}
                className="w-full sm:w-auto rounded-full px-6 shadow-lg shadow-[#9D8BA7]/20 min-h-[48px] active:scale-[0.97]"
                style={{ backgroundColor: '#9D8BA7', color: '#fff', border: 'none' }}
              >
                <Plus className="size-4 mr-1.5" />
                Capture a Memory
              </Button>
            </div>
          )}

          {/* Empty state — has memories but no chat messages */}
          {memories.length > 0 && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
              <div className="h-14 w-14 md:h-20 md:w-20 rounded-3xl bg-gradient-to-br from-[#9D8BA7]/15 to-[#9D8BA7]/5 flex items-center justify-center mb-3 md:mb-5 shadow-sm">
                <Brain size={22} className="text-[#9D8BA7]/70 md:size-7" />
              </div>
              <h3 className="text-base md:text-lg font-semibold text-foreground mb-1 md:mb-2">What would you like to know?</h3>
              <p className="text-sm text-muted-foreground max-w-xs leading-relaxed mb-6">
                Ask about your memories or just say hi — I&apos;ll understand what you need.
              </p>
              {/* PRINCIPLE 4: The Dopamine Hit — Rediscover button */}
              <motion.button
                onClick={() => {
                  if (memories.length === 0) return
                  const randomIndex = Math.floor(Math.random() * memories.length)
                  const memory = memories[randomIndex]
                  const typeEmoji = memory.type === 'link' ? '🔗' : memory.type === 'voice' ? '🎤' : memory.type === 'image' ? '🖼️' : '💭'
                  const rediscoverMsg: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: `I found this from your past ${typeEmoji}\n\n**${memory.title}**\n${memory.content.slice(0, 200)}${memory.content.length > 200 ? '...' : ''}\n\n_Saved ${formatRelativeDate(memory.createdAt)}_${memory.tags.length > 0 ? ` · ${memory.tags.slice(0, 3).join(' ')}` : ''}`,
                    referencedMemories: [memory.id],
                    timestamp: new Date().toISOString(),
                  }
                  setMessages([rediscoverMsg])
                }}
                whileHover={{ scale: 1.03 }}
                whileTap={{ scale: 0.97 }}
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium transition-all duration-200 min-h-[48px] shadow-lg active:scale-95 cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, rgba(157,139,167,0.15), rgba(192,132,252,0.15))',
                  border: '1px solid rgba(157,139,167,0.2)',
                  color: darkMode ? '#c084fc' : '#9333ea',
                  boxShadow: '0 4px 20px rgba(157,139,167,0.15)',
                }}
              >
                <Sparkles size={16} />
                Rediscover a thought ✨
              </motion.button>
            </div>
          )}

          {/* Chat messages with entrance animation */}
          <AnimatePresence mode="popLayout">
            {messages.map((msg) => (
              <motion.div
                key={msg.id}
                initial={{ opacity: 0, y: 10, scale: 0.98 }}
                animate={{ opacity: 1, y: 0, scale: 1 }}
                transition={{ duration: 0.3, ease: 'easeOut' }}
              >
                <ChatBubble
                  message={msg}
                  memories={memoryLookup}
                  isStreaming={streamingMessageId === msg.id}
                  darkMode={darkMode}
                />
              </motion.div>
            ))}
          </AnimatePresence>

          {/* Typing indicator */}
          {isThinking && <TypingIndicator darkMode={darkMode} />}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Bar — padding-bottom handled by AppShell mobile-bottom-pad on <main> */}
      <div
        className={`shrink-0 z-10 border-t ${
          darkMode
            ? 'bg-[#0a0a0f] border-gray-800'
            : 'bg-white border-gray-200'
        }`}
      >
        <div className="md:max-w-3xl md:mx-auto px-3 md:px-6 py-2 md:py-3">
          {/* Rediscover button — shown when there are messages */}
          {messages.length > 0 && memories.length > 0 && (
            <div className="mb-2 flex justify-center">
              <motion.button
                onClick={() => {
                  const randomIndex = Math.floor(Math.random() * memories.length)
                  const memory = memories[randomIndex]
                  const typeEmoji = memory.type === 'link' ? '🔗' : memory.type === 'voice' ? '🎤' : memory.type === 'image' ? '🖼️' : '💭'
                  const rediscoverMsg: ChatMessage = {
                    id: `assistant-${Date.now()}`,
                    role: 'assistant',
                    content: `I found this from your past ${typeEmoji}\n\n**${memory.title}**\n${memory.content.slice(0, 200)}${memory.content.length > 200 ? '...' : ''}\n\n_Saved ${formatRelativeDate(memory.createdAt)}_${memory.tags.length > 0 ? ` · ${memory.tags.slice(0, 3).join(' ')}` : ''}`,
                    referencedMemories: [memory.id],
                    timestamp: new Date().toISOString(),
                  }
                  setMessages((prev) => [...prev, rediscoverMsg])
                }}
                whileTap={{ scale: 0.95 }}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-[11px] font-medium transition-all duration-200 cursor-pointer ${
                  darkMode
                    ? 'text-[#c084fc]/70 hover:text-[#c084fc] bg-[#9D8BA7]/5 hover:bg-[#9D8BA7]/10'
                    : 'text-purple-600/70 hover:text-purple-600 bg-purple-50 hover:bg-purple-100'
                }`}
              >
                <Sparkles size={12} />
                Rediscover ✨
              </motion.button>
            </div>
          )}
          <div className="flex items-center gap-2">
            {/* Input field */}
            <div className="flex-1 relative">
              <input
                type="text"
                value={input}
                onChange={(e) => setInput(e.target.value)}
                onFocus={() => setInputFocused(true)}
                onBlur={() => setTimeout(() => setInputFocused(false), 200)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' && !e.shiftKey && input.trim()) {
                    e.preventDefault()
                    handleSend()
                    setInputFocused(false)
                  }
                }}
                placeholder="Ask Aether anything..."
                disabled={isThinking}
                autoComplete="off"
                aria-label="Ask Aether a question"
                className={`w-full rounded-xl p-3 text-sm focus:outline-none focus:border-[#9D8BA7]/40 transition-all duration-200 disabled:opacity-50 h-12 resize-none ${
                  darkMode
                    ? 'bg-gray-800 border border-gray-700 text-white placeholder:text-gray-500'
                    : 'bg-gray-100 border border-gray-200 text-gray-900 placeholder:text-gray-400'
                }`}
              />
              {/* Microphone button inside input */}
              <button
                onClick={toggleRecording}
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isRecording
                    ? 'text-red-500 bg-red-500/10'
                    : darkMode
                      ? 'text-muted-foreground hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 active:bg-[#9D8BA7]/10'
                      : 'text-gray-400 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5 active:bg-[#9D8BA7]/10'
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
            {/* Send button */}
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              size="icon"
              aria-label="Send message"
              className={`h-12 w-12 rounded-2xl shadow-lg transition-all duration-300 hover:shadow-xl disabled:opacity-40 disabled:shadow-none flex-shrink-0 active:scale-95 cursor-pointer ${
                darkMode
                  ? 'bg-white text-black hover:bg-white/90 shadow-white/10'
                  : 'bg-slate-900 text-white hover:bg-slate-800 shadow-slate-900/20'
              }`}
            >
              {isThinking ? (
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
