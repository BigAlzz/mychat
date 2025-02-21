import React, { useState, useRef, useEffect } from 'react';
import Markdown from 'marked-react';
import { Message } from '../types';
import { sendMessage } from '../services/llmService';
import LoadingIndicator from './LoadingIndicator';
import StopIcon from './StopIcon';
import { SearchTypeSelector } from './SearchTypeSelector';
import './ChatPanel.css';

interface ChatPanelProps {
  selectedModel: string | null;
}

const ChatPanel: React.FC<ChatPanelProps> = ({ selectedModel }) => {
  const [messages, setMessages] = useState<Message[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [isWebSearch, setIsWebSearch] = useState(false);
  const [showSearchTypes, setShowSearchTypes] = useState(false);
  const [streamController, setStreamController] = useState<AbortController | null>(null);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const handleStopStream = () => {
    if (streamController) {
      streamController.abort();
      setStreamController(null);
      setIsLoading(false);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const value = e.target.value;
    setInputMessage(value);
    
    // Show search types when "@web" is typed
    if (value.toLowerCase().endsWith('@web')) {
      setShowSearchTypes(true);
    } else {
      setShowSearchTypes(false);
    }
  };

  const handleSearchTypeSelect = (template: string) => {
    setInputMessage(template);
    setShowSearchTypes(false);
  };

  const handleSendMessage = async () => {
    if (!inputMessage.trim() || !selectedModel) return;

    // Clean up any previous stream
    if (streamController) {
      handleStopStream();
    }

    const isWebCommand = inputMessage.toLowerCase().includes('@web');
    setIsWebSearch(isWebCommand);

    const userMessage: Message = { role: 'user', content: inputMessage };
    const assistantMessage: Message = { 
      role: 'assistant', 
      content: '', 
      model: selectedModel,
      isStreaming: true 
    };

    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInputMessage('');
    setIsLoading(true);

    try {
      const controller = new AbortController();
      setStreamController(controller);

      await sendMessage(
        userMessage.content,
        selectedModel,
        controller,
        (chunk: { content: string; done: boolean }) => {
          setMessages(prev => {
            const newMessages = [...prev];
            const lastMessage = newMessages[newMessages.length - 1];
            if (lastMessage && lastMessage.role === 'assistant') {
              lastMessage.content = chunk.content;
              if (chunk.done) {
                lastMessage.isStreaming = false;
                setIsLoading(false);
                setStreamController(null);
                setIsWebSearch(false);
              } else {
                lastMessage.isStreaming = true;
              }
            }
            return newMessages;
          });
        }
      );
    } catch (error) {
      if (!(error instanceof Error) || error.name !== 'AbortError') {
        console.error('Error sending message:', error);
        setMessages(prev => {
          const newMessages = [...prev];
          const lastMessage = newMessages[newMessages.length - 1];
          if (lastMessage && lastMessage.role === 'assistant') {
            lastMessage.content = lastMessage.content || (isWebSearch ? 
              'Sorry, there was an error performing the web search. Please try again.' :
              'Sorry, an error occurred while processing your message.');
            lastMessage.isStreaming = false;
          }
          return newMessages;
        });
      }
      setIsLoading(false);
      setStreamController(null);
      setIsWebSearch(false);
    }
  };

  return (
    <div className="chat-panel">
      <div className="messages">
        {messages.map((message, index) => (
          <div
            key={index}
            className={`message ${message.role === 'user' ? 'user' : 'assistant'}`}
          >
            <div className="message-content">
              {message.content ? (
                <Markdown breaks>{message.content}</Markdown>
              ) : message.isStreaming ? (
                <div className="loading-container">
                  <LoadingIndicator isWebSearch={isWebSearch} />
                </div>
              ) : null}
              {message.model && (
                <div className="message-footer">
                  <div className="model-info">
                    Model: {message.model}
                    {message.isStreaming && <span className="streaming">...</span>}
                  </div>
                  {message.isStreaming && (
                    <button 
                      className="stop-button" 
                      onClick={handleStopStream}
                      title="Stop generating"
                    >
                      <StopIcon />
                    </button>
                  )}
                </div>
              )}
            </div>
          </div>
        ))}
        <div ref={messagesEndRef} />
      </div>

      <div className="input-area">
        {showSearchTypes && (
          <SearchTypeSelector
            onSelect={handleSearchTypeSelect}
            onClose={() => setShowSearchTypes(false)}
          />
        )}
        <input
          type="text"
          value={inputMessage}
          onChange={handleInputChange}
          onKeyPress={(e) => e.key === 'Enter' && !e.shiftKey && handleSendMessage()}
          placeholder="Type @web to search local documents, @web to search the internet, or just chat..."
          disabled={isLoading || !selectedModel}
        />
        <button 
          onClick={handleSendMessage}
          disabled={isLoading || !selectedModel || !inputMessage.trim()}
        >
          Send
        </button>
      </div>
    </div>
  );
};

export default ChatPanel;
