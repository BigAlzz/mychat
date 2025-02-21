export interface Message {
  role: 'user' | 'assistant';
  content: string;
  model?: string;
  isStreaming?: boolean;
}
