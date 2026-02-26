'use client'

import React, { useState, useRef, useEffect, useCallback } from 'react'
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Badge } from '@/components/ui/badge'
import { ScrollArea } from '@/components/ui/scroll-area'
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs'
import { Separator } from '@/components/ui/separator'
import { Switch } from '@/components/ui/switch'
import { Label } from '@/components/ui/label'
import { Sheet, SheetTrigger, SheetContent, SheetHeader, SheetTitle, SheetDescription } from '@/components/ui/sheet'
import { Collapsible, CollapsibleTrigger, CollapsibleContent } from '@/components/ui/collapsible'
import { uploadAndTrainDocument, getDocuments, deleteDocuments } from '@/lib/ragKnowledgeBase'
import type { RAGDocument } from '@/lib/ragKnowledgeBase'
import {
  FiPhone, FiPhoneOff, FiMic, FiMicOff, FiClock, FiSearch,
  FiTrash2, FiUpload, FiFile, FiChevronDown, FiChevronUp,
  FiSettings, FiActivity, FiShield, FiMessageCircle, FiUser
} from 'react-icons/fi'
import {
  HiOutlineDocumentText, HiOutlineHeart, HiOutlineCurrencyDollar,
  HiOutlineUserGroup, HiOutlineClipboardCheck
} from 'react-icons/hi'

// ==================== CONSTANTS ====================

const AGENT_ID = '69a0ae4450d509e818489859'
const RAG_ID = '69a0a64500c2d274880eff35'

const THEME_VARS = {
  '--background': '160 35% 96%',
  '--foreground': '160 35% 8%',
  '--card': '160 30% 99%',
  '--card-foreground': '160 35% 8%',
  '--primary': '160 85% 35%',
  '--primary-foreground': '0 0% 100%',
  '--secondary': '160 30% 93%',
  '--secondary-foreground': '160 35% 12%',
  '--accent': '45 95% 50%',
  '--accent-foreground': '160 35% 8%',
  '--muted': '160 25% 90%',
  '--muted-foreground': '160 25% 40%',
  '--border': '160 28% 88%',
  '--input': '160 25% 85%',
  '--ring': '160 85% 35%',
  '--radius': '0.875rem',
} as React.CSSProperties

const SUGGESTED_TOPICS = [
  { label: 'Coverage Details', icon: HiOutlineDocumentText },
  { label: 'Claims', icon: HiOutlineClipboardCheck },
  { label: 'Find a Provider', icon: HiOutlineUserGroup },
  { label: 'Deductibles & Copays', icon: HiOutlineCurrencyDollar },
  { label: 'Wellness Benefits', icon: HiOutlineHeart },
]

const STORAGE_KEY = 'healthguard-conversations'

// ==================== TYPES ====================

interface TranscriptEntry {
  role: 'user' | 'agent'
  text: string
  timestamp: string
}

interface Conversation {
  id: string
  date: string
  duration: number
  transcript: TranscriptEntry[]
  summary: string
}

// ==================== SAMPLE DATA ====================

const SAMPLE_CONVERSATIONS: Conversation[] = [
  {
    id: 'sample-1',
    date: '2026-02-25T14:30:00.000Z',
    duration: 245,
    transcript: [
      { role: 'user', text: 'Hi, I want to know about my dental coverage.', timestamp: '0:00' },
      { role: 'agent', text: 'Of course! Your plan includes preventive dental care at 100% coverage, including two cleanings per year. Basic procedures like fillings are covered at 80%, and major procedures at 50% after your deductible.', timestamp: '0:03' },
      { role: 'user', text: 'What is my deductible for dental?', timestamp: '0:18' },
      { role: 'agent', text: 'Your annual dental deductible is $50 per individual or $150 per family. Preventive services are exempt from the deductible.', timestamp: '0:21' },
    ],
    summary: 'Inquiry about dental coverage details and deductibles',
  },
  {
    id: 'sample-2',
    date: '2026-02-24T10:15:00.000Z',
    duration: 180,
    transcript: [
      { role: 'user', text: 'How do I file a claim for my recent hospital visit?', timestamp: '0:00' },
      { role: 'agent', text: 'I can help you with that. For hospital visits, your provider typically files the claim directly. However, if you need to submit one yourself, you can do so through our member portal or by mailing the claim form with your itemized bill.', timestamp: '0:04' },
      { role: 'user', text: 'How long does it take to process?', timestamp: '0:22' },
      { role: 'agent', text: 'Claims are usually processed within 15-30 business days. You will receive an Explanation of Benefits once it is reviewed.', timestamp: '0:25' },
    ],
    summary: 'Help with filing a hospital visit claim',
  },
  {
    id: 'sample-3',
    date: '2026-02-21T16:45:00.000Z',
    duration: 120,
    transcript: [
      { role: 'user', text: 'Can I see a specialist without a referral?', timestamp: '0:00' },
      { role: 'agent', text: 'It depends on your plan type. If you are on a PPO plan, you can see specialists without a referral, though using in-network providers will save you money. If you are on an HMO plan, you will need a referral from your primary care physician first.', timestamp: '0:03' },
    ],
    summary: 'Question about specialist referral requirements',
  },
]

// ==================== HELPERS ====================

function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60)
  const secs = seconds % 60
  return `${mins}:${secs.toString().padStart(2, '0')}`
}

function formatDate(dateStr: string): string {
  try {
    const d = new Date(dateStr)
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' })
  } catch {
    return dateStr
  }
}

function float32ToPCM16(float32Array: Float32Array): Int16Array {
  const pcm16 = new Int16Array(float32Array.length)
  for (let i = 0; i < float32Array.length; i++) {
    const s = Math.max(-1, Math.min(1, float32Array[i]))
    pcm16[i] = s < 0 ? s * 0x8000 : s * 0x7FFF
  }
  return pcm16
}

function arrayBufferToBase64(buffer: ArrayBuffer): string {
  const bytes = new Uint8Array(buffer)
  let binary = ''
  for (let i = 0; i < bytes.byteLength; i++) {
    binary += String.fromCharCode(bytes[i])
  }
  return btoa(binary)
}

// ==================== ERROR BOUNDARY ====================

class ErrorBoundary extends React.Component<
  { children: React.ReactNode },
  { hasError: boolean; error: string }
> {
  constructor(props: { children: React.ReactNode }) {
    super(props)
    this.state = { hasError: false, error: '' }
  }
  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error: error.message }
  }
  render() {
    if (this.state.hasError) {
      return (
        <div className="min-h-screen flex items-center justify-center bg-background text-foreground">
          <div className="text-center p-8 max-w-md">
            <h2 className="text-xl font-semibold mb-2">Something went wrong</h2>
            <p className="text-muted-foreground mb-4 text-sm">{this.state.error}</p>
            <button onClick={() => this.setState({ hasError: false, error: '' })}
              className="px-4 py-2 bg-primary text-primary-foreground rounded-md text-sm">
              Try again
            </button>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}

// ==================== VOICE VISUALIZER ====================

function VoiceVisualizer({ status }: { status: 'idle' | 'connecting' | 'active' }) {
  const [bars, setBars] = useState<number[]>([12, 16, 10, 18, 14])

  useEffect(() => {
    if (status !== 'active') return
    const interval = setInterval(() => {
      setBars(prev => prev.map(() => 6 + Math.floor(Math.random() * 20)))
    }, 300)
    return () => clearInterval(interval)
  }, [status])

  return (
    <div className="relative flex items-center justify-center w-52 h-52 mx-auto">
      {/* Concentric rings for active state */}
      {status === 'active' && (
        <>
          <div className="absolute inset-0 rounded-full border-2 border-primary/15 animate-ping" style={{ animationDuration: '2.5s' }} />
          <div className="absolute inset-4 rounded-full border-2 border-primary/25 animate-ping" style={{ animationDuration: '3s', animationDelay: '0.4s' }} />
          <div className="absolute inset-8 rounded-full border-2 border-primary/35 animate-ping" style={{ animationDuration: '3.5s', animationDelay: '0.8s' }} />
        </>
      )}
      {status === 'connecting' && (
        <>
          <div className="absolute inset-0 rounded-full border-2 border-primary/20 animate-pulse" />
          <div className="absolute inset-4 rounded-full border-2 border-primary/30 animate-pulse" style={{ animationDelay: '0.5s' }} />
        </>
      )}
      {/* Core circle with glass effect */}
      <div className={`relative z-10 w-32 h-32 rounded-full flex flex-col items-center justify-center transition-all duration-500 border ${status === 'active' ? 'bg-primary shadow-2xl shadow-primary/30 scale-110 border-primary/50' : status === 'connecting' ? 'bg-primary/70 animate-pulse border-primary/40' : 'bg-card/80 backdrop-blur-[16px] border-border/50 shadow-lg'}`}>
        {status === 'active' ? (
          <>
            <FiMic className="w-9 h-9 text-primary-foreground mb-1" />
            <div className="flex items-end gap-0.5 h-5">
              {bars.map((h, i) => (
                <div key={i} className="w-1 bg-primary-foreground/70 rounded-full transition-all duration-300" style={{ height: `${h}px` }} />
              ))}
            </div>
          </>
        ) : status === 'connecting' ? (
          <FiActivity className="w-9 h-9 text-primary-foreground animate-pulse" />
        ) : (
          <FiPhone className="w-9 h-9 text-muted-foreground" />
        )}
      </div>
    </div>
  )
}

// ==================== TRANSCRIPT PANEL ====================

function TranscriptPanel({ entries, isThinking }: { entries: TranscriptEntry[]; isThinking: boolean }) {
  const bottomRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [entries, isThinking])

  if (entries.length === 0 && !isThinking) {
    return (
      <div className="flex flex-col items-center justify-center py-12 text-muted-foreground">
        <FiMessageCircle className="w-8 h-8 mb-3 opacity-40" />
        <p className="text-sm">Conversation transcript will appear here</p>
      </div>
    )
  }

  return (
    <ScrollArea className="h-64 w-full">
      <div className="space-y-3 p-4">
        {entries.map((entry, i) => (
          <div key={i} className={`flex gap-3 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
            {entry.role === 'agent' && (
              <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
                <FiShield className="w-3.5 h-3.5 text-primary-foreground" />
              </div>
            )}
            <div className={`max-w-[75%] rounded-2xl px-4 py-2.5 text-sm ${entry.role === 'user' ? 'bg-primary text-primary-foreground rounded-br-sm' : 'bg-secondary text-secondary-foreground rounded-bl-sm'}`}>
              <p style={{ lineHeight: '1.55', letterSpacing: '-0.01em' }}>{entry.text}</p>
              <p className={`text-xs mt-1.5 ${entry.role === 'user' ? 'text-primary-foreground/60' : 'text-muted-foreground'}`}>{entry.timestamp}</p>
            </div>
            {entry.role === 'user' && (
              <div className="w-7 h-7 rounded-full bg-muted flex items-center justify-center flex-shrink-0 mt-1">
                <FiUser className="w-3.5 h-3.5 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}
        {isThinking && (
          <div className="flex gap-3 justify-start">
            <div className="w-7 h-7 rounded-full bg-primary flex items-center justify-center flex-shrink-0 mt-1">
              <FiShield className="w-3.5 h-3.5 text-primary-foreground" />
            </div>
            <div className="bg-secondary text-secondary-foreground rounded-2xl rounded-bl-sm px-4 py-3">
              <div className="flex gap-1.5">
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0s' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0.15s' }} />
                <div className="w-2 h-2 rounded-full bg-muted-foreground/40 animate-bounce" style={{ animationDelay: '0.3s' }} />
              </div>
            </div>
          </div>
        )}
        <div ref={bottomRef} />
      </div>
    </ScrollArea>
  )
}

// ==================== CONVERSATION HISTORY CARD ====================

function ConversationCard({ conversation, onSelect, isSelected }: { conversation: Conversation; onSelect: () => void; isSelected: boolean }) {
  return (
    <Card className={`cursor-pointer transition-all duration-300 hover:shadow-lg border-border/50 backdrop-blur-[16px] bg-card/75 ${isSelected ? 'ring-2 ring-primary/30 shadow-lg' : 'hover:scale-[1.01]'}`} onClick={onSelect}>
      <CardContent className="p-4">
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2">
            <FiClock className="w-3.5 h-3.5 text-muted-foreground" />
            <span className="text-xs text-muted-foreground">{formatDate(conversation.date)}</span>
          </div>
          <Badge variant="secondary" className="text-xs">{formatDuration(conversation.duration)}</Badge>
        </div>
        <p className="text-sm font-medium text-foreground mb-2" style={{ letterSpacing: '-0.01em' }}>{conversation.summary}</p>
        <p className="text-xs text-muted-foreground">{conversation.transcript.length} messages</p>
        {isSelected && (
          <div className="mt-4 pt-3 border-t border-border/50">
            <ScrollArea className="h-52">
              <div className="space-y-2.5 pr-2">
                {conversation.transcript.map((entry, i) => (
                  <div key={i} className={`flex gap-2 ${entry.role === 'user' ? 'justify-end' : 'justify-start'}`}>
                    <div className={`max-w-[85%] rounded-xl px-3 py-2 text-xs ${entry.role === 'user' ? 'bg-primary/10 text-foreground' : 'bg-secondary text-secondary-foreground'}`}>
                      <span className="font-semibold">{entry.role === 'user' ? 'You' : 'Agent'}:</span>{' '}{entry.text}
                      <span className="block text-xs text-muted-foreground mt-1">{entry.timestamp}</span>
                    </div>
                  </div>
                ))}
              </div>
            </ScrollArea>
          </div>
        )}
      </CardContent>
    </Card>
  )
}

// ==================== KNOWLEDGE BASE SECTION ====================

function KnowledgeBaseSection() {
  const [isOpen, setIsOpen] = useState(false)
  const [documents, setDocuments] = useState<RAGDocument[]>([])
  const [loadingDocs, setLoadingDocs] = useState(false)
  const [uploading, setUploading] = useState(false)
  const [kbError, setKbError] = useState<string | null>(null)
  const [kbSuccess, setKbSuccess] = useState<string | null>(null)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const fetchDocs = useCallback(async () => {
    setLoadingDocs(true)
    setKbError(null)
    try {
      const result = await getDocuments(RAG_ID)
      if (result.success && Array.isArray(result.documents)) {
        setDocuments(result.documents)
      } else {
        setKbError(result.error ?? 'Failed to fetch documents')
      }
    } catch {
      setKbError('Failed to fetch documents')
    }
    setLoadingDocs(false)
  }, [])

  useEffect(() => {
    if (isOpen) fetchDocs()
  }, [isOpen, fetchDocs])

  const handleUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    setUploading(true)
    setKbError(null)
    setKbSuccess(null)
    try {
      const result = await uploadAndTrainDocument(RAG_ID, file)
      if (result.success) {
        setKbSuccess(`"${file.name}" uploaded successfully`)
        await fetchDocs()
      } else {
        setKbError(result.error ?? 'Upload failed')
      }
    } catch {
      setKbError('Upload failed')
    }
    setUploading(false)
    if (fileInputRef.current) fileInputRef.current.value = ''
  }

  const handleDelete = async (fileName: string) => {
    setKbError(null)
    setKbSuccess(null)
    try {
      const result = await deleteDocuments(RAG_ID, [fileName])
      if (result.success) {
        setKbSuccess(`"${fileName}" deleted`)
        setDocuments(prev => prev.filter(d => d.fileName !== fileName))
      } else {
        setKbError(result.error ?? 'Delete failed')
      }
    } catch {
      setKbError('Delete failed')
    }
  }

  return (
    <Collapsible open={isOpen} onOpenChange={setIsOpen}>
      <CollapsibleTrigger asChild>
        <Button variant="ghost" className="w-full justify-between px-4 py-3 h-auto text-sm font-medium text-foreground hover:bg-secondary/50">
          <span className="flex items-center gap-2">
            <FiFile className="w-4 h-4" />
            Knowledge Base
          </span>
          {isOpen ? <FiChevronUp className="w-4 h-4" /> : <FiChevronDown className="w-4 h-4" />}
        </Button>
      </CollapsibleTrigger>
      <CollapsibleContent>
        <div className="px-4 pb-4 space-y-4">
          {/* Upload */}
          <div className="flex items-center gap-2">
            <input
              ref={fileInputRef}
              type="file"
              accept=".pdf,.docx,.txt"
              onChange={handleUpload}
              className="hidden"
              id="kb-upload"
            />
            <Button
              variant="outline"
              size="sm"
              disabled={uploading}
              onClick={() => fileInputRef.current?.click()}
              className="flex items-center gap-2 text-xs"
            >
              {uploading ? (
                <FiActivity className="w-3.5 h-3.5 animate-spin" />
              ) : (
                <FiUpload className="w-3.5 h-3.5" />
              )}
              {uploading ? 'Uploading...' : 'Upload Document'}
            </Button>
            <span className="text-xs text-muted-foreground">PDF, DOCX, TXT</span>
          </div>

          {/* Messages */}
          {kbError && <p className="text-xs text-red-600 bg-red-50 px-3 py-2 rounded-lg">{kbError}</p>}
          {kbSuccess && <p className="text-xs text-green-700 bg-green-50 px-3 py-2 rounded-lg">{kbSuccess}</p>}

          {/* Document list */}
          {loadingDocs ? (
            <div className="space-y-2">
              {[1, 2].map((i) => (
                <div key={i} className="animate-pulse bg-muted rounded-lg h-10 w-full" />
              ))}
            </div>
          ) : documents.length === 0 ? (
            <p className="text-xs text-muted-foreground text-center py-4">No documents uploaded yet</p>
          ) : (
            <div className="space-y-2">
              {documents.map((doc, i) => (
                <div key={doc.id ?? i} className="flex items-center justify-between py-2 px-3 bg-secondary/50 rounded-lg">
                  <div className="flex items-center gap-2 min-w-0">
                    <HiOutlineDocumentText className="w-4 h-4 text-muted-foreground flex-shrink-0" />
                    <span className="text-xs text-foreground truncate">{doc.fileName}</span>
                    {doc.status && (
                      <Badge variant={doc.status === 'active' ? 'default' : 'secondary'} className="text-xs flex-shrink-0">
                        {doc.status}
                      </Badge>
                    )}
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDelete(doc.fileName)}
                    className="h-7 w-7 p-0 text-muted-foreground hover:text-red-500 flex-shrink-0"
                  >
                    <FiTrash2 className="w-3.5 h-3.5" />
                  </Button>
                </div>
              ))}
            </div>
          )}
        </div>
      </CollapsibleContent>
    </Collapsible>
  )
}

// ==================== AGENT STATUS ====================

function AgentStatusPanel({ callStatus }: { callStatus: 'idle' | 'connecting' | 'active' }) {
  return (
    <Card className="border-border/50 backdrop-blur-[16px] bg-card/75">
      <CardContent className="p-4">
        <div className="flex items-center gap-3">
          <div className={`w-2.5 h-2.5 rounded-full flex-shrink-0 ${callStatus === 'active' ? 'bg-green-500 animate-pulse' : callStatus === 'connecting' ? 'bg-yellow-500 animate-pulse' : 'bg-muted-foreground/30'}`} />
          <div className="min-w-0">
            <p className="text-sm font-medium text-foreground" style={{ letterSpacing: '-0.01em' }}>Health Insurance Voice Agent</p>
            <p className="text-xs text-muted-foreground">
              {callStatus === 'active' ? 'In call - listening' : callStatus === 'connecting' ? 'Connecting...' : 'Ready to assist'}
            </p>
          </div>
          <Badge variant={callStatus === 'active' ? 'default' : 'secondary'} className="ml-auto text-xs flex-shrink-0">
            {callStatus === 'active' ? 'Active' : callStatus === 'connecting' ? 'Connecting' : 'Idle'}
          </Badge>
        </div>
      </CardContent>
    </Card>
  )
}

// ==================== MAIN PAGE ====================

export default function Page() {
  // Voice state
  const [callStatus, setCallStatus] = useState<'idle' | 'connecting' | 'active'>('idle')
  const [transcript, setTranscript] = useState<TranscriptEntry[]>([])
  const [isAgentThinking, setIsAgentThinking] = useState(false)
  const [isMuted, setIsMuted] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [callStartTime, setCallStartTime] = useState<number>(0)
  const [callDuration, setCallDuration] = useState(0)

  // UI state
  const [activeTab, setActiveTab] = useState('home')
  const [showSampleData, setShowSampleData] = useState(false)
  const [historySearch, setHistorySearch] = useState('')
  const [selectedConversation, setSelectedConversation] = useState<string | null>(null)
  const [conversations, setConversations] = useState<Conversation[]>([])

  // Voice refs
  const wsRef = useRef<WebSocket | null>(null)
  const audioContextRef = useRef<AudioContext | null>(null)
  const processorRef = useRef<ScriptProcessorNode | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const sampleRateRef = useRef<number>(24000)
  const nextPlayTimeRef = useRef<number>(0)
  const isMutedRef = useRef(false)
  const durationIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null)
  const callStatusRef = useRef<'idle' | 'connecting' | 'active'>('idle')

  // Keep refs in sync
  useEffect(() => {
    isMutedRef.current = isMuted
  }, [isMuted])

  useEffect(() => {
    callStatusRef.current = callStatus
  }, [callStatus])

  // Load conversations from localStorage
  useEffect(() => {
    try {
      const stored = localStorage.getItem(STORAGE_KEY)
      if (stored) {
        const parsed = JSON.parse(stored)
        if (Array.isArray(parsed)) setConversations(parsed)
      }
    } catch { /* ignore */ }
  }, [])

  // Duration timer
  useEffect(() => {
    if (callStatus === 'active' && callStartTime > 0) {
      durationIntervalRef.current = setInterval(() => {
        setCallDuration(Math.floor((Date.now() - callStartTime) / 1000))
      }, 1000)
    } else {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    }
    return () => {
      if (durationIntervalRef.current) clearInterval(durationIntervalRef.current)
    }
  }, [callStatus, callStartTime])

  // Play audio chunk
  const playAudioChunk = useCallback((base64Audio: string, audioContext: AudioContext) => {
    try {
      const binaryString = atob(base64Audio)
      const bytes = new Uint8Array(binaryString.length)
      for (let i = 0; i < binaryString.length; i++) {
        bytes[i] = binaryString.charCodeAt(i)
      }
      const pcm16 = new Int16Array(bytes.buffer)
      const float32 = new Float32Array(pcm16.length)
      for (let i = 0; i < pcm16.length; i++) {
        float32[i] = pcm16[i] / 32768
      }
      const audioBuffer = audioContext.createBuffer(1, float32.length, sampleRateRef.current)
      audioBuffer.getChannelData(0).set(float32)
      const source = audioContext.createBufferSource()
      source.buffer = audioBuffer
      source.connect(audioContext.destination)
      const now = audioContext.currentTime
      const startTime = Math.max(now, nextPlayTimeRef.current)
      source.start(startTime)
      nextPlayTimeRef.current = startTime + audioBuffer.duration
    } catch (err) {
      console.error('Audio playback error:', err)
    }
  }, [])

  // Handle transcript messages
  const handleTranscript = useCallback((msg: { role?: string; text?: string }) => {
    const role = msg.role === 'user' ? 'user' as const : 'agent' as const
    const now = new Date()
    const timestamp = `${now.getMinutes()}:${now.getSeconds().toString().padStart(2, '0')}`
    setTranscript(prev => [...prev, { role, text: msg.text ?? '', timestamp }])
    setIsAgentThinking(false)
  }, [])

  // End voice call
  const endCall = useCallback(() => {
    if (wsRef.current) {
      wsRef.current.close()
      wsRef.current = null
    }
    if (processorRef.current) {
      processorRef.current.disconnect()
      processorRef.current = null
    }
    if (streamRef.current) {
      streamRef.current.getTracks().forEach(t => t.stop())
      streamRef.current = null
    }
    if (audioContextRef.current) {
      audioContextRef.current.close()
      audioContextRef.current = null
    }
    nextPlayTimeRef.current = 0
    setIsAgentThinking(false)
    setCallStatus('idle')
  }, [])

  // Save conversation
  const saveConversation = useCallback(() => {
    setTranscript(currentTranscript => {
      if (currentTranscript.length === 0) return currentTranscript
      const conv: Conversation = {
        id: `conv-${Date.now()}`,
        date: new Date().toISOString(),
        duration: callDuration,
        transcript: [...currentTranscript],
        summary: currentTranscript.length > 0
          ? (currentTranscript[0]?.text ?? '').slice(0, 80) + ((currentTranscript[0]?.text?.length ?? 0) > 80 ? '...' : '')
          : 'Voice conversation',
      }
      setConversations(prev => {
        const updated = [conv, ...prev]
        try {
          localStorage.setItem(STORAGE_KEY, JSON.stringify(updated))
        } catch { /* ignore */ }
        return updated
      })
      return currentTranscript
    })
  }, [callDuration])

  // End call and save
  const handleEndCall = useCallback(() => {
    saveConversation()
    endCall()
  }, [endCall, saveConversation])

  // Start voice call
  const startCall = async () => {
    try {
      setError(null)
      setCallStatus('connecting')
      setTranscript([])
      setCallDuration(0)

      // 1. Start session
      const res = await fetch('https://voice-sip.studio.lyzr.ai/session/start', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ agentId: AGENT_ID }),
      })
      const data = await res.json()
      if (!data.wsUrl) throw new Error('No WebSocket URL returned')

      sampleRateRef.current = data.audioConfig?.sampleRate || 24000

      // 2. Get microphone
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true })
      streamRef.current = stream

      // 3. Setup AudioContext
      const audioContext = new AudioContext({ sampleRate: sampleRateRef.current })
      audioContextRef.current = audioContext

      const source = audioContext.createMediaStreamSource(stream)
      const processor = audioContext.createScriptProcessor(4096, 1, 1)
      processorRef.current = processor

      // Silent gain node to satisfy processor connection without echoing mic
      const silentGain = audioContext.createGain()
      silentGain.gain.value = 0
      silentGain.connect(audioContext.destination)

      source.connect(processor)
      processor.connect(silentGain) // NOT audioContext.destination

      // 4. Connect WebSocket
      const ws = new WebSocket(data.wsUrl)
      wsRef.current = ws

      ws.onopen = () => {
        setCallStatus('active')
        setCallStartTime(Date.now())

        processor.onaudioprocess = (e) => {
          if (ws.readyState !== WebSocket.OPEN) return
          if (isMutedRef.current) return
          const inputData = e.inputBuffer.getChannelData(0)
          const pcm16 = float32ToPCM16(inputData)
          const base64 = arrayBufferToBase64(pcm16.buffer)
          ws.send(JSON.stringify({
            type: 'audio',
            audio: base64,
            sampleRate: sampleRateRef.current,
          }))
        }
      }

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data)
          if (msg.type === 'audio' && msg.audio) {
            playAudioChunk(msg.audio, audioContext)
          } else if (msg.type === 'transcript') {
            handleTranscript(msg)
          } else if (msg.type === 'thinking') {
            setIsAgentThinking(true)
          } else if (msg.type === 'clear') {
            setIsAgentThinking(false)
          } else if (msg.type === 'error') {
            console.error('Voice error:', msg.message)
            setError(msg.message ?? 'Voice error occurred')
          }
        } catch { /* ignore parse errors */ }
      }

      ws.onerror = () => {
        endCall()
        setError('Connection error. Please try again.')
      }

      ws.onclose = () => {
        if (callStatusRef.current === 'active') {
          endCall()
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to start call. Please check microphone permissions.')
      setCallStatus('idle')
    }
  }

  // Filtered conversations
  const displayConversations = showSampleData
    ? [...SAMPLE_CONVERSATIONS, ...conversations]
    : conversations

  const filteredConversations = displayConversations.filter(c =>
    historySearch.trim() === '' ||
    c.summary.toLowerCase().includes(historySearch.toLowerCase()) ||
    c.transcript.some(t => t.text.toLowerCase().includes(historySearch.toLowerCase()))
  )

  // Sample transcript for home view
  const sampleTranscript: TranscriptEntry[] = showSampleData ? [
    { role: 'agent', text: 'Hello! Welcome to HealthGuard. I am your insurance assistant. How can I help you today?', timestamp: '0:00' },
    { role: 'user', text: 'I want to understand my copay for specialist visits.', timestamp: '0:05' },
    { role: 'agent', text: 'Your plan has a $40 copay for specialist visits when you use in-network providers. Out-of-network specialists will be subject to your deductible and coinsurance. Would you like me to help you find an in-network specialist?', timestamp: '0:08' },
  ] : []

  return (
    <ErrorBoundary>
      <div style={THEME_VARS} className="min-h-screen bg-background text-foreground font-sans">
        {/* Gradient Background */}
        <div className="fixed inset-0 -z-10" style={{ background: 'linear-gradient(135deg, hsl(160 40% 94%) 0%, hsl(180 35% 93%) 30%, hsl(160 35% 95%) 60%, hsl(140 40% 94%) 100%)' }} />

        {/* Header */}
        <header className="sticky top-0 z-40 backdrop-blur-[16px] border-b" style={{ background: 'rgba(255,255,255,0.75)', borderColor: 'rgba(255,255,255,0.18)' }}>
          <div className="max-w-5xl mx-auto px-4 sm:px-6 py-3 flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="w-9 h-9 rounded-xl bg-primary flex items-center justify-center shadow-md shadow-primary/20">
                <FiShield className="w-5 h-5 text-primary-foreground" />
              </div>
              <div>
                <h1 className="text-lg font-semibold text-foreground" style={{ letterSpacing: '-0.01em' }}>HealthGuard</h1>
                <p className="text-xs text-muted-foreground hidden sm:block">AI Insurance Assistant</p>
              </div>
            </div>

            <div className="flex items-center gap-4">
              {/* Sample Data Toggle */}
              <div className="flex items-center gap-2">
                <Label htmlFor="sample-toggle" className="text-xs text-muted-foreground hidden sm:block">Sample Data</Label>
                <Switch
                  id="sample-toggle"
                  checked={showSampleData}
                  onCheckedChange={setShowSampleData}
                />
              </div>

              {/* Settings Sheet */}
              <Sheet>
                <SheetTrigger asChild>
                  <Button variant="ghost" size="sm" className="h-9 w-9 p-0">
                    <FiSettings className="w-4 h-4" />
                  </Button>
                </SheetTrigger>
                <SheetContent>
                  <SheetHeader>
                    <SheetTitle>Settings</SheetTitle>
                    <SheetDescription>Manage knowledge base and view agent details</SheetDescription>
                  </SheetHeader>
                  <div className="mt-6">
                    <KnowledgeBaseSection />
                  </div>
                  <Separator className="my-6" />
                  <div className="px-4">
                    <h4 className="text-sm font-medium text-foreground mb-3">Agent Info</h4>
                    <div className="space-y-3 text-xs">
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Agent</span>
                        <span className="text-foreground font-medium">Health Insurance Voice Agent</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Type</span>
                        <Badge variant="secondary" className="text-xs">Voice</Badge>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Purpose</span>
                        <span className="text-foreground">Insurance Q&A</span>
                      </div>
                      <div className="flex justify-between items-center">
                        <span className="text-muted-foreground">Status</span>
                        <div className="flex items-center gap-1.5">
                          <div className={`w-2 h-2 rounded-full ${callStatus === 'active' ? 'bg-green-500' : 'bg-muted-foreground/30'}`} />
                          <span className="text-foreground">{callStatus === 'active' ? 'In Call' : 'Ready'}</span>
                        </div>
                      </div>
                    </div>
                  </div>
                </SheetContent>
              </Sheet>
            </div>
          </div>
        </header>

        {/* Main Content */}
        <main className="max-w-5xl mx-auto px-4 sm:px-6 py-6">
          <Tabs value={activeTab} onValueChange={setActiveTab}>
            <TabsList className="mb-6 backdrop-blur-[16px]">
              <TabsTrigger value="home" className="gap-1.5 text-sm">
                <FiPhone className="w-3.5 h-3.5" />
                Home
              </TabsTrigger>
              <TabsTrigger value="history" className="gap-1.5 text-sm">
                <FiClock className="w-3.5 h-3.5" />
                History
              </TabsTrigger>
            </TabsList>

            {/* ==================== HOME TAB ==================== */}
            <TabsContent value="home">
              <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Main Voice Card */}
                <div className="lg:col-span-2 space-y-6">
                  <Card className="border-border/50 backdrop-blur-[16px] bg-card/75 shadow-xl overflow-hidden" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
                    <CardHeader className="text-center pb-2">
                      <CardTitle className="text-xl font-semibold" style={{ letterSpacing: '-0.01em' }}>
                        {callStatus === 'active' ? 'Call in Progress' : callStatus === 'connecting' ? 'Connecting...' : 'Start a Conversation'}
                      </CardTitle>
                      <CardDescription className="text-sm">
                        {callStatus === 'active'
                          ? `Duration: ${formatDuration(callDuration)}`
                          : callStatus === 'connecting'
                          ? 'Setting up your secure connection...'
                          : 'Speak with our AI assistant about your health insurance'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent className="flex flex-col items-center pb-8 pt-4">
                      {/* Voice Visualizer */}
                      <VoiceVisualizer status={callStatus} />

                      {/* Controls */}
                      <div className="flex items-center gap-4 mt-8">
                        {callStatus === 'active' && (
                          <Button
                            variant="outline"
                            size="sm"
                            onClick={() => setIsMuted(prev => !prev)}
                            className={`h-12 w-12 rounded-full p-0 transition-all duration-300 ${isMuted ? 'bg-red-50 border-red-200 text-red-500 hover:bg-red-100' : 'hover:bg-secondary'}`}
                          >
                            {isMuted ? <FiMicOff className="w-5 h-5" /> : <FiMic className="w-5 h-5" />}
                          </Button>
                        )}

                        {callStatus === 'idle' ? (
                          <Button
                            onClick={startCall}
                            className="h-14 px-8 rounded-full text-base font-medium shadow-lg shadow-primary/25 hover:shadow-xl hover:shadow-primary/30 transition-all duration-300 hover:scale-105 bg-primary text-primary-foreground"
                          >
                            <FiPhone className="w-5 h-5 mr-2" />
                            Start Call
                          </Button>
                        ) : callStatus === 'connecting' ? (
                          <Button disabled className="h-14 px-8 rounded-full text-base font-medium bg-primary/80 text-primary-foreground">
                            <FiActivity className="w-5 h-5 mr-2 animate-spin" />
                            Connecting...
                          </Button>
                        ) : (
                          <Button
                            onClick={handleEndCall}
                            variant="destructive"
                            className="h-14 px-8 rounded-full text-base font-medium shadow-lg hover:shadow-xl transition-all duration-300 hover:scale-105"
                          >
                            <FiPhoneOff className="w-5 h-5 mr-2" />
                            End Call
                          </Button>
                        )}
                      </div>

                      {/* Error */}
                      {error && (
                        <div className="mt-4 w-full max-w-md">
                          <div className="bg-red-50 border border-red-200 text-red-700 text-sm rounded-xl px-4 py-3 flex items-center justify-between">
                            <p className="flex-1">{error}</p>
                            <Button variant="ghost" size="sm" onClick={() => { setError(null); startCall() }} className="text-red-700 hover:text-red-800 text-xs ml-2 flex-shrink-0">
                              Retry
                            </Button>
                          </div>
                        </div>
                      )}
                    </CardContent>
                  </Card>

                  {/* Suggested Topics - show before call starts */}
                  {callStatus === 'idle' && !showSampleData && transcript.length === 0 && (
                    <div className="space-y-3">
                      <h3 className="text-sm font-medium text-muted-foreground px-1">Suggested Topics</h3>
                      <div className="flex flex-wrap gap-2">
                        {SUGGESTED_TOPICS.map((topic) => {
                          const Icon = topic.icon
                          return (
                            <Badge
                              key={topic.label}
                              variant="secondary"
                              className="py-2 px-4 text-sm font-normal cursor-default hover:bg-secondary/80 transition-colors backdrop-blur-[16px] bg-secondary/60 border border-border/30"
                            >
                              <Icon className="w-4 h-4 mr-1.5" />
                              {topic.label}
                            </Badge>
                          )
                        })}
                      </div>
                    </div>
                  )}

                  {/* Transcript Panel */}
                  {(callStatus === 'active' || transcript.length > 0 || showSampleData) && (
                    <Card className="border-border/50 backdrop-blur-[16px] bg-card/75 shadow-md" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
                      <CardHeader className="py-3 px-4">
                        <CardTitle className="text-sm font-medium flex items-center gap-2">
                          <FiMessageCircle className="w-4 h-4" />
                          Live Transcript
                          {callStatus === 'active' && (
                            <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
                          )}
                        </CardTitle>
                      </CardHeader>
                      <Separator />
                      <TranscriptPanel
                        entries={showSampleData && transcript.length === 0 ? sampleTranscript : transcript}
                        isThinking={isAgentThinking}
                      />
                    </Card>
                  )}
                </div>

                {/* Sidebar */}
                <div className="space-y-4">
                  <AgentStatusPanel callStatus={callStatus} />

                  {/* How It Works */}
                  <Card className="border-border/50 backdrop-blur-[16px] bg-card/75" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
                    <CardHeader className="pb-2">
                      <CardTitle className="text-sm font-medium">How It Works</CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-3">
                      {[
                        { step: '1', text: 'Click "Start Call" and allow microphone access' },
                        { step: '2', text: 'Speak naturally about your insurance questions' },
                        { step: '3', text: 'Get instant answers from our AI assistant' },
                        { step: '4', text: 'Review transcripts in your history anytime' },
                      ].map((item) => (
                        <div key={item.step} className="flex items-start gap-3">
                          <div className="w-6 h-6 rounded-full bg-primary/10 flex items-center justify-center flex-shrink-0 mt-0.5">
                            <span className="text-xs font-semibold text-primary">{item.step}</span>
                          </div>
                          <p className="text-xs text-muted-foreground" style={{ lineHeight: '1.55' }}>{item.text}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>

                  {/* Privacy Note */}
                  <Card className="border-border/50 backdrop-blur-[16px] bg-card/75" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
                    <CardContent className="p-4">
                      <div className="flex items-start gap-2.5">
                        <FiShield className="w-4 h-4 text-primary flex-shrink-0 mt-0.5" />
                        <div>
                          <p className="text-xs font-medium text-foreground mb-1">Secure & Private</p>
                          <p className="text-xs text-muted-foreground" style={{ lineHeight: '1.55' }}>Your conversations are processed securely. Transcripts are stored locally on your device only.</p>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                </div>
              </div>
            </TabsContent>

            {/* ==================== HISTORY TAB ==================== */}
            <TabsContent value="history">
              <div className="space-y-4">
                {/* Search Bar */}
                <div className="flex items-center gap-3">
                  <div className="relative flex-1">
                    <FiSearch className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground" />
                    <Input
                      placeholder="Search conversations..."
                      value={historySearch}
                      onChange={(e) => setHistorySearch(e.target.value)}
                      className="pl-10 backdrop-blur-[16px] bg-card/75 border-border/50"
                    />
                  </div>
                  <Badge variant="secondary" className="text-xs whitespace-nowrap">
                    {filteredConversations.length} conversation{filteredConversations.length !== 1 ? 's' : ''}
                  </Badge>
                </div>

                {/* Conversation List */}
                {filteredConversations.length === 0 ? (
                  <Card className="border-border/50 backdrop-blur-[16px] bg-card/75" style={{ borderColor: 'rgba(255,255,255,0.18)' }}>
                    <CardContent className="flex flex-col items-center justify-center py-16">
                      <div className="w-16 h-16 rounded-full bg-muted/50 flex items-center justify-center mb-4">
                        <FiMessageCircle className="w-7 h-7 text-muted-foreground/50" />
                      </div>
                      <h3 className="text-base font-medium text-foreground mb-2">No conversations yet</h3>
                      <p className="text-sm text-muted-foreground text-center max-w-sm mb-6" style={{ lineHeight: '1.55' }}>Start your first call to get answers about your health insurance coverage, claims, and benefits.</p>
                      <Button
                        onClick={() => setActiveTab('home')}
                        className="bg-primary text-primary-foreground hover:bg-primary/90 transition-all duration-300"
                      >
                        <FiPhone className="w-4 h-4 mr-2" />
                        Start Your First Call
                      </Button>
                    </CardContent>
                  </Card>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {filteredConversations.map((conv) => (
                      <ConversationCard
                        key={conv.id}
                        conversation={conv}
                        onSelect={() => setSelectedConversation(prev => prev === conv.id ? null : conv.id)}
                        isSelected={selectedConversation === conv.id}
                      />
                    ))}
                  </div>
                )}
              </div>
            </TabsContent>
          </Tabs>
        </main>

        {/* Footer */}
        <footer className="mt-auto py-6 text-center">
          <p className="text-xs text-muted-foreground">Powered by HealthGuard AI &middot; Voice Agent</p>
        </footer>
      </div>
    </ErrorBoundary>
  )
}
