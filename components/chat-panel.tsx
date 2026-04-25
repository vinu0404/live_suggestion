import type { RefObject } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { ChatMessage } from "@/lib/types";

interface ChatPanelProps {
  chat: ChatMessage[];
  input: string;
  isSending: boolean;
  onInputChange: (value: string) => void;
  onSubmit: () => void;
  bodyRef?: RefObject<HTMLDivElement | null>;
}

export function ChatPanel({ chat, input, isSending, onInputChange, onSubmit, bodyRef }: ChatPanelProps) {
  return (
    <div className="col">
      <header>
        <span>3. Chat (detailed answers)</span>
        <span>session-only</span>
      </header>
      <div className="body" ref={bodyRef}>
        <div className="help-banner">
          Clicking a suggestion seeds the chat with that suggestion and streams a richer answer. You can also type
          follow-up questions directly and keep one continuous conversation for the whole session.
        </div>
        {chat.length === 0 ? (
          <div className="empty">Click a suggestion or type a question below.</div>
        ) : (
          chat.map((message) => (
            <div className={`chat-msg ${message.role}`} key={message.id}>
              <div className="who">{message.role === "user" ? "You" : "Assistant"}</div>
              <div className="bubble">
                <ReactMarkdown
                  remarkPlugins={[remarkGfm]}
                  components={{
                    p: ({ children }) => <p className="md-paragraph">{children}</p>,
                    ul: ({ children }) => <ul className="md-list">{children}</ul>,
                    ol: ({ children }) => <ol className="md-list md-list-ordered">{children}</ol>,
                    li: ({ children }) => <li className="md-list-item">{children}</li>,
                    table: ({ children }) => <div className="md-table-wrap"><table className="md-table">{children}</table></div>,
                    th: ({ children }) => <th className="md-table-head">{children}</th>,
                    td: ({ children }) => <td className="md-table-cell">{children}</td>,
                    code: ({ children }) => <code className="md-code">{children}</code>,
                  }}
                >
                  {message.text || (message.status === "streaming" ? "Thinking..." : "")}
                </ReactMarkdown>
                {message.status === "streaming" ? <span className="cursor">▍</span> : null}
              </div>
            </div>
          ))
        )}
      </div>
      <div className="chat-input-row">
        <input
          value={input}
          onChange={(event) => onInputChange(event.target.value)}
          onKeyDown={(event) => {
            if (event.key === "Enter" && !event.shiftKey) {
              event.preventDefault();
              onSubmit();
            }
          }}
          placeholder="Ask anything…"
        />
        <button onClick={onSubmit} type="button" disabled={isSending}>
          {isSending ? "Sending..." : "Send"}
        </button>
      </div>
    </div>
  );
}
