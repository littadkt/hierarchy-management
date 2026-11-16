"use client";

import React, { useEffect, useRef, useState } from "react";
import Link from "next/link";
import {
  Bot,
  Send,
  Sparkles,
  ArrowLeft,
  RefreshCw,
  Copy,
  Check,
  FileText,
  MessageSquare,
  Zap,
  Target,
  Briefcase,
  ExternalLink,
} from "lucide-react";
import { crmApi, getErrorMessage } from "@/lib/api";
import { CrmAiDraftResponse } from "@/lib/types";
import { ProtectedRoute } from "@/components/ProtectedRoute";

interface ChatMessage {
  id: string;
  sender: "user" | "ai";
  text: string;
  links?: Array<{ label: string; url: string }>;
  timestamp: string;
}

export default function CrmAiAgentPage() {
  const [messages, setMessages] = useState<ChatMessage[]>([
    {
      id: "initial-1",
      sender: "ai",
      text: "### 👋 Hello! I am your Littad CRM AI Copilot.\n\nI monitor your commercial pipeline in real-time, compute predictive lead qualification scores, analyze deal win probabilities, and draft high-converting proposals.\n\n**Ask me anything about your leads, deals, tickets or customer accounts!**",
      links: [
        { label: "View Leads", url: "/crm/leads" },
        { label: "View Deals", url: "/crm/deals" },
      ],
      timestamp: "Active",
    },
  ]);
  const [inputQuery, setInputQuery] = useState("");
  const [chatLoading, setChatLoading] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // Smart Drafter Tool State
  const [draftType, setDraftType] = useState("sales_pitch");
  const [recipientName, setRecipientName] = useState("");
  const [topicSubject, setTopicSubject] = useState("");
  const [additionalContext, setAdditionalContext] = useState("");
  const [draftLoading, setDraftLoading] = useState(false);
  const [generatedDraft, setGeneratedDraft] = useState<CrmAiDraftResponse | null>(null);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, chatLoading]);

  const handleSendMessage = async (queryText?: string) => {
    const textToSend = queryText || inputQuery;
    if (!textToSend.trim() || chatLoading) return;

    const userMsg: ChatMessage = {
      id: "user-" + Date.now(),
      sender: "user",
      text: textToSend.trim(),
      timestamp: "Active",
    };

    setMessages((prev) => [...prev, userMsg]);
    setInputQuery("");
    setChatLoading(true);

    try {
      const data = await crmApi.chatCopilot(textToSend.trim());
      const aiMsg: ChatMessage = {
        id: "ai-" + Date.now(),
        sender: "ai",
        text: data.response,
        links: data.relevant_links,
        timestamp: "Active",
      };
      setMessages((prev) => [...prev, aiMsg]);
    } catch (err) {
      const errMsg: ChatMessage = {
        id: "err-" + Date.now(),
        sender: "ai",
        text: `⚠️ Error fetching response: ${getErrorMessage(err)}`,
        timestamp: "Active",
      };
      setMessages((prev) => [...prev, errMsg]);
    } finally {
      setChatLoading(false);
    }
  };

  const handleGenerateDraft = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!recipientName.trim() || !topicSubject.trim()) {
      alert("Please specify the recipient name and topic.");
      return;
    }
    setDraftLoading(true);
    try {
      const res = await crmApi.draftContent({
        context_type: draftType,
        recipient_name: recipientName.trim(),
        topic_or_subject: topicSubject.trim(),
        additional_context: additionalContext.trim() || undefined,
      });
      setGeneratedDraft(res);
    } catch (err) {
      alert(getErrorMessage(err));
    } finally {
      setDraftLoading(false);
    }
  };

  const copyToClipboard = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const quickPrompts = [
    { label: "🎯 Hottest Leads", query: "Which leads are highest priority and have the best AI score?" },
    { label: "💼 Deal Pipeline Analysis", query: "Summarize our open deals and predicted win probabilities" },
    { label: "🎫 Pending Support Tickets", query: "What customer support tickets are currently open or at SLA risk?" },
    { label: "📊 Commercial Health", query: "Give me an executive commercial summary of our CRM pipeline" },
  ];

  return (
    <ProtectedRoute>
      <div className="space-y-6">
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2 mb-1">
            <Link
              href="/crm"
              className="text-xs font-semibold text-purple-600 dark:text-purple-400 hover:underline flex items-center gap-1"
            >
              <ArrowLeft className="w-3.5 h-3.5" />
              <span>CRM Suite</span>
            </Link>
            <span className="text-slate-300 dark:text-slate-700">•</span>
            <span className="text-xs font-medium text-slate-500">Autonomous Sales Intelligence</span>
          </div>
          <h1 className="text-2xl font-bold text-slate-900 dark:text-white flex items-center gap-2">
            <Bot className="w-7 h-7 text-amber-500" />
            <span>CRM AI Copilot & Agent</span>
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 dark:text-slate-400 mt-0.5">
            Query live commercial pipelines, calculate predictive qualification metrics, and draft enterprise communications.
          </p>
        </div>
      </div>

      {/* Main Grid: Interactive Chat on Left (2 cols), Content Drafter Tool on Right (1 col) */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left Column: Conversational AI Agent */}
        <div className="lg:col-span-2 bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl shadow-xs flex flex-col h-[650px] overflow-hidden">
          {/* Chat Header */}
          <div className="p-4 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between bg-slate-50/50 dark:bg-slate-800/50">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 text-white flex items-center justify-center shadow-md shadow-amber-500/20">
                <Sparkles className="w-4 h-4" />
              </div>
              <div>
                <h3 className="font-bold text-sm text-slate-900 dark:text-white leading-tight">
                  Commercial AI Agent
                </h3>
                <span className="text-[10px] text-emerald-600 dark:text-emerald-400 font-medium flex items-center gap-1">
                  <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 animate-pulse" />
                  Live Synced with CRM & ERP DB
                </span>
              </div>
            </div>

            <button
              onClick={() =>
                setMessages([
                  {
                    id: "init-reset",
                    sender: "ai",
                    text: "Conversation refreshed. How can I assist with your sales pipeline or customer accounts today?",
                    timestamp: "Active",
                  },
                ])
              }
              className="p-1.5 text-slate-400 hover:text-slate-600 dark:hover:text-slate-200 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors cursor-pointer text-xs flex items-center gap-1"
            >
              <RefreshCw className="w-3.5 h-3.5" />
              <span>Clear Chat</span>
            </button>
          </div>

          {/* Quick Prompts Bar */}
          <div className="p-2.5 border-b border-slate-100 dark:border-slate-800 flex items-center gap-1.5 overflow-x-auto bg-slate-50/30 dark:bg-slate-900/30">
            {quickPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p.query)}
                disabled={chatLoading}
                className="px-2.5 py-1 rounded-xl bg-slate-100 dark:bg-slate-800 hover:bg-purple-50 dark:hover:bg-purple-950/40 text-slate-700 dark:text-slate-300 hover:text-purple-700 text-[11px] font-semibold whitespace-nowrap transition-colors cursor-pointer border border-slate-200 dark:border-slate-700/60"
              >
                {p.label}
              </button>
            ))}
          </div>

          {/* Messages Thread */}
          <div className="flex-1 p-4 overflow-y-auto space-y-4">
            {messages.map((msg) => (
              <div
                key={msg.id}
                className={`flex gap-3 ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
              >
                {msg.sender === "ai" && (
                  <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 text-white flex items-center justify-center shrink-0 shadow-xs mt-1">
                    <Bot className="w-4 h-4" />
                  </div>
                )}

                <div
                  className={`max-w-[85%] rounded-2xl p-4 text-xs sm:text-sm leading-relaxed ${
                    msg.sender === "user"
                      ? "bg-purple-600 text-white shadow-md shadow-purple-600/20"
                      : "bg-slate-50 dark:bg-slate-800/70 border border-slate-200/80 dark:border-slate-700/60 text-slate-800 dark:text-slate-200"
                  }`}
                >
                  <div className="whitespace-pre-wrap">{msg.text}</div>

                  {msg.links && msg.links.length > 0 && (
                    <div className="mt-3 pt-2.5 border-t border-slate-200 dark:border-slate-700/60 flex items-center gap-2 flex-wrap">
                      <span className="text-[10px] text-slate-400 uppercase font-bold">Quick Links:</span>
                      {msg.links.map((lnk, i) => (
                        <Link
                          key={i}
                          href={lnk.url}
                          className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg bg-white dark:bg-slate-900 text-purple-700 dark:text-purple-300 border border-purple-200 dark:border-purple-800 text-xs font-semibold hover:bg-purple-50 dark:hover:bg-purple-950/60 transition-colors"
                        >
                          <span>{lnk.label}</span>
                          <ExternalLink className="w-3 h-3" />
                        </Link>
                      ))}
                    </div>
                  )}

                  <div
                    className={`text-[9px] mt-1.5 ${
                      msg.sender === "user" ? "text-purple-200 text-right" : "text-slate-400"
                    }`}
                  >
                    {msg.timestamp}
                  </div>
                </div>
              </div>
            ))}

            {chatLoading && (
              <div className="flex gap-3 justify-start">
                <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-amber-500 to-purple-600 text-white flex items-center justify-center shrink-0">
                  <Bot className="w-4 h-4" />
                </div>
                <div className="bg-slate-50 dark:bg-slate-800/70 border border-slate-200 dark:border-slate-700/60 rounded-2xl p-4 text-xs text-slate-500 flex items-center gap-2">
                  <RefreshCw className="w-3.5 h-3.5 animate-spin text-purple-600" />
                  <span>Agent analyzing live CRM dataset...</span>
                </div>
              </div>
            )}
            <div ref={messagesEndRef} />
          </div>

          {/* Chat Input Field */}
          <div className="p-3 border-t border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900">
            <form
              onSubmit={(e) => {
                e.preventDefault();
                handleSendMessage();
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={inputQuery}
                onChange={(e) => setInputQuery(e.target.value)}
                placeholder="Ask about pipeline, lead scores, deal probabilities or drafts..."
                className="flex-1 px-4 py-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white placeholder-slate-400 focus:outline-none focus:ring-2 focus:ring-purple-500"
              />
              <button
                type="submit"
                disabled={!inputQuery.trim() || chatLoading}
                className="p-2.5 rounded-xl bg-purple-600 hover:bg-purple-500 text-white disabled:opacity-40 transition-colors shadow-md shadow-purple-600/20 cursor-pointer"
                title="Send Message"
              >
                <Send className="w-4 h-4" />
              </button>
            </form>
          </div>
        </div>

        {/* Right Column: AI Content & Proposal Drafter Tool */}
        <div className="bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-800 rounded-3xl p-6 shadow-xs flex flex-col justify-between">
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              <h2 className="font-bold text-base text-slate-900 dark:text-white">
                Sales Copy & Proposal Drafter
              </h2>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mb-4">
              Generate tailor-made sales pitches, support ticket resolution replies, and enterprise deal proposals.
            </p>

            <form onSubmit={handleGenerateDraft} className="space-y-3">
              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Draft Type
                </label>
                <select
                  value={draftType}
                  onChange={(e) => setDraftType(e.target.value)}
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                >
                  <option value="sales_pitch">Introductory Sales Pitch</option>
                  <option value="deal_proposal">Enterprise Deal Proposal</option>
                  <option value="ticket_response">Support Ticket Resolution Email</option>
                </select>
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Recipient Name / Client
                </label>
                <input
                  type="text"
                  required
                  value={recipientName}
                  onChange={(e) => setRecipientName(e.target.value)}
                  placeholder="e.g. Rajesh Kumar"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Topic / Product Interest
                </label>
                <input
                  type="text"
                  required
                  value={topicSubject}
                  onChange={(e) => setTopicSubject(e.target.value)}
                  placeholder="e.g. Caterpillar Genset Fleet Leasing"
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-slate-700 dark:text-slate-300 uppercase mb-1">
                  Additional Context
                </label>
                <textarea
                  rows={2}
                  value={additionalContext}
                  onChange={(e) => setAdditionalContext(e.target.value)}
                  placeholder="Specific requirements, 10% discount, Kakkanad site..."
                  className="w-full px-3 py-2 text-xs rounded-xl border border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-800 text-slate-900 dark:text-white"
                />
              </div>

              <button
                type="submit"
                disabled={draftLoading}
                className="w-full py-2.5 px-4 rounded-xl bg-purple-600 hover:bg-purple-500 text-white text-xs font-bold shadow-md shadow-purple-600/20 transition-all cursor-pointer flex items-center justify-center gap-2 disabled:opacity-50"
              >
                {draftLoading ? (
                  <>
                    <RefreshCw className="w-3.5 h-3.5 animate-spin" />
                    <span>Generating Copy...</span>
                  </>
                ) : (
                  <>
                    <Zap className="w-3.5 h-3.5 text-amber-300" />
                    <span>Generate Proposal / Copy</span>
                  </>
                )}
              </button>
            </form>

            {/* Generated Output Preview */}
            {generatedDraft && (
              <div className="mt-4 p-3.5 rounded-2xl bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 space-y-2">
                <div className="flex items-center justify-between pb-2 border-b border-slate-200 dark:border-slate-700">
                  <span className="text-xs font-bold text-slate-900 dark:text-white truncate">
                    {generatedDraft.subject}
                  </span>
                  <button
                    onClick={() => copyToClipboard(`${generatedDraft.subject}\n\n${generatedDraft.content}`)}
                    className="p-1 rounded-lg text-slate-400 hover:text-purple-600 cursor-pointer"
                    title="Copy to Clipboard"
                  >
                    {copied ? <Check className="w-3.5 h-3.5 text-emerald-500" /> : <Copy className="w-3.5 h-3.5" />}
                  </button>
                </div>
                <div className="text-[11px] text-slate-700 dark:text-slate-300 whitespace-pre-wrap leading-relaxed max-h-48 overflow-y-auto">
                  {generatedDraft.content}
                </div>
                <div className="text-[10px] text-purple-700 dark:text-purple-300 font-semibold pt-1">
                  CTA: {generatedDraft.suggested_call_to_action}
                </div>
              </div>
            )}
          </div>
        </div>
      </div>
      </div>
    </ProtectedRoute>
  );
}
