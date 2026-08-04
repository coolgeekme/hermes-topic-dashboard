export interface Topic {
  id: string
  name: string
  sessions: string[]
  message_count: number
  session_count: number
  last_active: number
  last_active_iso: string | null
  preview: string
  is_cron: boolean
  message_count_exported: number
  messages: Message[]
}

export interface Message {
  id: number
  session_id: string
  role: 'user' | 'assistant' | 'tool'
  content: string | null
  timestamp: number
  timestamp_iso: string | null
  tool_name: string | null
  display_kind: string | null
}

export interface TopicsData {
  generated_at: string
  generated_at_ts: number
  total_sessions: number
  total_messages_approx: number
  topics: Topic[]
}
