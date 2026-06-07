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
  return ''
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

/* ─────────── Typing Indicator ─────────── */
const TypingIndicator = memo(function TypingIndicator({ darkMode }: { darkMode: boolean }) {
  return (
    <div className="flex justify-start">
      <div className={`rounded-2xl rounded-bl-sm px-4 sm:px-5 py-3.5 max-w-[85%] sm:max-w-[70%] ${
        darkMode
          ? 'bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl'
          : 'bg-[#9D8BA7]/5 border border-[#9D8BA7]/15'
      }`}>
        <div className="flex items-center gap-2 mb-2">
          <div className="h-5 w-5 rounded-full bg-gradient-to-br from-[#c084fc] to-[#7c3aed] flex items-center justify-center">
            <Brain size={10} className="text-white animate-pulse-glow" />
          </div>
          <span className="text-[10px] font-semibold text-[#c084fc]/60 uppercase tracking-wider">
            Aether is thinking...
          </span>
        </div>
        <div className="flex items-center gap-1.5 py-1">
          {[0, 1, 2].map((i) => (
            <motion.div
              key={i}
              className="h-1.5 w-1.5 rounded-full bg-[#c084fc]/30"
              initial={{ opacity: 0.3, scale: 0.8 }}
              animate={{ opacity: [0.3, 0.8, 0.3], scale: [0.8, 1.1, 0.8] }}
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

/* ─────────── Inline Memory Card ─────────── */
const InlineMemoryCard = memo(function InlineMemoryCard({ memory, darkMode }: { memory: { id: string; title: string; content: string; type: MemoryType }; darkMode: boolean }) {
  const Icon = typeIconMap[memory.type]
  return (
    <div className={`rounded-xl border p-3 mt-2 transition-all duration-300 ${
      darkMode
        ? 'border-white/[0.06] bg-white/[0.03] hover:border-[#c084fc]/15'
        : 'border-gray-200 bg-gray-50/50'
    }`}>
      <div className="flex items-start gap-2.5">
        <div className="h-7 w-7 rounded-lg bg-[#c084fc]/8 flex items-center justify-center flex-shrink-0 mt-0.5">
          <Icon size={13} className="text-[#c084fc]" />
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{memory.title}</p>
          <p className={`text-[11px] line-clamp-2 mt-0.5 leading-relaxed ${
            darkMode ? 'text-white/25' : 'text-gray-500'
          }`}>{memory.content}</p>
        </div>
      </div>
    </div>
  )
})

/* ─────────── Chat Message Bubble ─────────── */
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
        <div className="rounded-2xl rounded-br-sm px-3 sm:px-5 py-2.5 sm:py-3 max-w-[85%] sm:max-w-[70%] ml-auto text-white"
          style={{
            background: 'linear-gradient(135deg, #9D8BA7, #7c3aed)',
            boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.1), 0 4px 20px rgba(124, 58, 237, 0.2)',
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
      <div className={`rounded-2xl rounded-bl-sm px-3 sm:px-5 py-2.5 sm:py-4 max-w-[85%] sm:max-w-[70%] relative overflow-hidden ${
        darkMode
          ? 'bg-white/[0.03] border border-white/[0.06] backdrop-blur-xl'
          : 'bg-[#9D8BA7]/5 border border-[#9D8BA7]/12'
      }`}>
        {/* Left accent bar */}
        <div className="absolute left-0 top-0 bottom-0 w-[3px] rounded-l-2xl"
          style={{ background: 'linear-gradient(to bottom, #c084fc, #9D8BA7)' }}
        />

        <div className="flex items-center gap-2 mb-2.5">
          <div className="h-6 w-6 rounded-full bg-gradient-to-br from-[#c084fc] to-[#7c3aed] flex items-center justify-center">
            <Brain size={12} className="text-white" />
          </div>
          <span className="text-[10px] font-semibold text-[#c084fc]/50 uppercase tracking-wider">
            Aether
          </span>
        </div>

        <p className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
          {message.content}
          {isStreaming && (
            <span className="animate-blink-cursor text-[#c084fc] ml-0.5">▊</span>
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
            <AlertCircle size={11} className="text-white/20 mt-0.5 flex-shrink-0" />
            <span className={`text-[11px] leading-relaxed ${
              darkMode ? 'text-white/20' : 'text-gray-400'
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

  const memoryLookup = useMemo(
    () => memories.map((m) => ({ id: m.id, title: m.title, content: m.content, type: m.type })),
    [memories]
  )

  const memoriesForApi = useMemo(
    () => memories.map((m) => ({
      id: m.id, type: m.type, title: m.title, content: m.content,
      tags: m.tags, createdAt: m.createdAt, aiSummary: m.aiSummary, collectionId: m.collectionId,
    })),
    [memories]
  )

  const chatHistoryForApi = useMemo(
    () => messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
    [messages]
  )

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

  useEffect(() => {
    if (chatEndRef.current) {
      chatEndRef.current.scrollIntoView({ behavior: 'smooth' })
    }
  }, [messages, isThinking])

  const processMessage = useCallback(async (text: string) => {
    if (!text.trim()) return

    const userMsg: ChatMessage = {
      id: `user-${Date.now()}`,
      role: 'user',
      content: text.trim(),
      timestamp: new Date().toISOString(),
    }
    setMessages((prev) => [...prev, userMsg])
    setInput('')
    setIsThinking(true)

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

    if (memories.length === 0) {
      await new Promise((resolve) => setTimeout(resolve, 1500))
    }

    try {
      const freshMemories = useAetherStore.getState().memories
      const apiMemories = freshMemories.length > 0
        ? freshMemories.map((m) => ({
            id: m.id, type: m.type, title: m.title, content: m.content,
            tags: m.tags, createdAt: m.createdAt, aiSummary: m.aiSummary, collectionId: m.collectionId,
          }))
        : memoriesForApi

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

      displayAnswer = displayAnswer
        .replace(/\{[^}]*"referencedIds"[^}]*\}/g, '')
        .replace(/\{[^}]*"sourcesCount"[^}]*\}/g, '')
        .replace(/\{[^}]*"detectedMode"[^}]*\}/g, '')
        .replace(/\{[^}]*"confidence"[^}]*\}/g, '')
        .replace(/^\s*\{[\s\S]*\}\s*$/g, (match) => {
          try { const parsed = JSON.parse(match); return parsed.answer || '' } catch { return match }
        })
        .trim()

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

      if (user?.id) {
        try {
          fetch('/api/ai/learn', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              userId: user.id,
              userMessage: text.trim(),
              conversationHistory: [...messages.slice(-6), assistantMsg].map((m) => ({
                role: m.role, content: m.content,
              })),
            }),
          }).catch(() => {})
        } catch {}
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
      const mediaRecorder = mimeType ? new MediaRecorder(stream, { mimeType }) : new MediaRecorder(stream)
      audioChunksRef.current = []

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) audioChunksRef.current.push(event.data)
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
          } catch {} finally {
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
    if (isRecording) stopRecording()
    else startRecording()
  }, [isRecording, startRecording, stopRecording])

  const handleSend = useCallback(() => {
    processMessage(input)
  }, [input, processMessage])

  const handleStarterClick = useCallback((question: string) => {
    processMessage(question)
  }, [processMessage])

  const displayStarters = memories.length > 0 ? starterQuestions : starterQuestions.slice(3)
  const showSuggestions = messages.length === 0 || (inputFocused && messages.length > 0)

  return (
    <div className="flex flex-col flex-1 min-h-0 overflow-hidden overflow-x-hidden max-w-screen bg-background relative z-10">
      {/* Header */}
      <div className={`flex-shrink-0 px-4 md:px-6 pt-3 md:pt-5 pb-2 md:pb-3 border-b z-10 ${
        darkMode ? 'bg-[#0A0A14] border-white/[0.04]' : 'bg-white border-gray-200'
      }`}>
        <div className="md:max-w-3xl md:mx-auto">
          <div className="flex items-center gap-3">
            <div className="h-8 w-8 md:h-10 md:w-10 rounded-2xl bg-gradient-to-br from-[#c084fc] to-[#7c3aed] flex items-center justify-center shadow-lg shadow-[#7c3aed]/20">
              <Brain size={16} className="text-white md:size-5" />
            </div>
            <div>
              <h1 className={`text-base md:text-xl font-bold ${darkMode ? 'text-white/90' : 'text-gray-900'}`}>Ask Aether</h1>
              <p className="hidden sm:block text-xs text-white/20">
                Search your memories or just ask me anything
              </p>
            </div>
          </div>
        </div>
      </div>

      {/* Suggested Questions */}
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
              darkMode ? 'bg-[#0A0A14] border-white/[0.04]' : 'bg-white border-gray-200'
            }`}>
              <div className="md:max-w-3xl md:mx-auto">
                <div className="flex flex-col gap-2">
                  {displayStarters.map((question) => (
                    <button
                      key={question}
                      onClick={() => { handleStarterClick(question); setInputFocused(false) }}
                      className={`w-full px-3 py-3 rounded-xl border text-[13px] transition-all duration-200 min-h-[44px] flex items-center gap-1.5 text-left active:scale-[0.97] cursor-pointer ${
                        darkMode
                          ? 'border-white/[0.06] bg-white/[0.03] text-white/40 hover:bg-white/[0.05] hover:text-white/60 hover:border-[#c084fc]/15'
                          : 'border-gray-200 bg-gray-50 text-gray-600 hover:bg-gray-100'
                      }`}
                    >
                      <span className="text-[#c084fc]/60">&ldquo;</span>
                      {question.replace(/^"|"$/g, '')}
                      <span className="text-[#c084fc]/60">&rdquo;</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat Area */}
      <div
        ref={chatContainerRef}
        className={`flex-1 min-h-0 overflow-y-auto ios-scroll px-4 md:px-6 py-3 md:py-5 pb-4 md:pb-6 ${darkMode ? 'bg-[#0A0A14]' : 'bg-gray-50'}`}
      >
        <div className="md:max-w-3xl md:mx-auto flex flex-col min-h-full gap-3 md:gap-4">
          {/* Empty state — no memories */}
          {memories.length === 0 && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
              <div className="h-14 w-14 md:h-20 md:w-20 rounded-3xl bg-gradient-to-br from-[#c084fc]/10 to-[#7c3aed]/5 flex items-center justify-center mb-3 md:mb-6">
                <Brain size={24} className="text-[#c084fc]/50 md:size-8" />
              </div>
              <h2 className="text-base md:text-lg font-bold text-foreground mb-1.5 md:mb-3">Ask Aether</h2>
              <p className="text-sm text-white/25 max-w-xs mb-3 md:mb-6 leading-relaxed">
                Your AI companion — search your memories, ask questions, or just chat.
              </p>
              <Button
                onClick={() => { setCurrentView('dashboard'); setCaptureModalOpen(true); }}
                className="w-full sm:w-auto rounded-full px-6 min-h-[48px] active:scale-[0.97]"
                style={{ background: 'linear-gradient(135deg, #9D8BA7, #7c3aed)', color: '#fff', border: 'none', boxShadow: '0 4px 20px rgba(124, 58, 237, 0.2)' }}
              >
                <Plus className="size-4 mr-1.5" />
                Capture a Memory
              </Button>
            </div>
          )}

          {/* Empty state — has memories but no chat */}
          {memories.length > 0 && messages.length === 0 && (
            <div className="flex flex-col items-center justify-center flex-1 px-4 text-center">
              <div className="h-14 w-14 md:h-20 md:w-20 rounded-3xl bg-gradient-to-br from-[#c084fc]/10 to-[#7c3aed]/5 flex items-center justify-center mb-3 md:mb-5">
                <Brain size={22} className="text-[#c084fc]/40 md:size-7" />
              </div>
              <h3 className="text-base md:text-lg font-semibold text-foreground mb-1 md:mb-2">What would you like to know?</h3>
              <p className="text-sm text-white/25 max-w-xs leading-relaxed mb-6">
                Ask about your memories or just say hi — I&apos;ll understand what you need.
              </p>
              {/* ✨ Rediscover a thought ✨ */}
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
                className="inline-flex items-center gap-2 px-5 py-3 rounded-2xl text-sm font-medium transition-all duration-200 min-h-[48px] cursor-pointer"
                style={{
                  background: 'linear-gradient(135deg, rgba(192,132,252,0.1), rgba(124,58,237,0.1))',
                  border: '1px solid rgba(192,132,252,0.15)',
                  color: '#c084fc',
                  boxShadow: '0 4px 20px rgba(124, 58, 237, 0.1)',
                }}
              >
                <Sparkles size={16} />
                Rediscover a thought ✨
              </motion.button>
            </div>
          )}

          {/* Chat messages */}
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

          {isThinking && <TypingIndicator darkMode={darkMode} />}

          <div ref={chatEndRef} />
        </div>
      </div>

      {/* Input Bar */}
      <div
        className={`shrink-0 z-10 border-t ${
          darkMode ? 'bg-[#0A0A14] border-white/[0.04]' : 'bg-white border-gray-200'
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
                    ? 'text-[#c084fc]/50 hover:text-[#c084fc] bg-[#c084fc]/5 hover:bg-[#c084fc]/10'
                    : 'text-purple-600/70 hover:text-purple-600 bg-purple-50 hover:bg-purple-100'
                }`}
              >
                <Sparkles size={12} />
                Rediscover ✨
              </motion.button>
            </div>
          )}
          <div className="flex items-center gap-2">
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
                className={`w-full rounded-xl p-3 text-sm focus:outline-none transition-all duration-200 disabled:opacity-50 h-12 resize-none ${
                  darkMode
                    ? 'bg-white/[0.03] border border-white/[0.06] text-white/85 placeholder:text-white/15 focus:border-[#c084fc]/25'
                    : 'bg-gray-100 border border-gray-200 text-gray-900 placeholder:text-gray-400 focus:border-[#9D8BA7]/30'
                }`}
              />
              <button
                onClick={toggleRecording}
                className={`absolute right-2 top-1/2 -translate-y-1/2 h-10 w-10 rounded-xl flex items-center justify-center transition-all duration-200 cursor-pointer ${
                  isRecording
                    ? 'text-red-500 bg-red-500/10'
                    : darkMode
                      ? 'text-white/15 hover:text-[#c084fc] hover:bg-[#c084fc]/5'
                      : 'text-gray-400 hover:text-[#9D8BA7] hover:bg-[#9D8BA7]/5'
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
              {isTranscribing && (
                <span className="absolute right-14 top-1/2 -translate-y-1/2 flex items-center gap-1.5 text-xs text-white/30">
                  <Loader2 size={14} className="animate-spin" />
                  <span className="hidden sm:inline">Transcribing…</span>
                </span>
              )}
            </div>
            <Button
              onClick={handleSend}
              disabled={!input.trim() || isThinking}
              size="icon"
              aria-label="Send message"
              className="h-12 w-12 rounded-2xl transition-all duration-300 disabled:opacity-30 flex-shrink-0 active:scale-95 cursor-pointer"
              style={{
                background: input.trim() && !isThinking ? 'linear-gradient(135deg, #9D8BA7, #7c3aed)' : undefined,
                color: 'white',
                boxShadow: input.trim() && !isThinking ? '0 4px 20px rgba(124, 58, 237, 0.25)' : 'none',
              }}
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
