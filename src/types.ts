export interface UnifiedSession {
  id: string
  platform: 'hermes' | 'claude-code' | 'codex'
  title: string
  project?: string | null
  branch?: string | null
  started_at?: string | null
  last_active?: string | null
  message_count: number
  messages: UnifiedMessage[]
  resume_command: string
  is_cron: boolean
}

export interface UnifiedMessage {
  role: 'user' | 'assistant' | 'tool'
  content: string
  timestamp: string | null
  session_id?: string
  platform?: string
}

export interface Topic {
  id: string
  name: string
  platforms: string[]
  sessions: UnifiedSession[]
  session_count: number
  message_count: number
  message_count_exported: number
  last_active: number
  last_active_iso: string | null
  messages: UnifiedMessage[]
  is_cron: boolean
}

export interface TopicsData {
  generated_at: string
  platforms: string[]
  total_sessions: number
  total_messages_approx: number
  topics: Topic[]
}
