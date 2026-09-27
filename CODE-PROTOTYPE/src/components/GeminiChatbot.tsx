import React, { useState, useEffect, useRef } from 'react';
import { GeminiChatMessage, GeminiChatRole, User } from '../types/index.ts';
import { api } from '../services/api.ts';
import {
  Sparkles,
  Send,
  Bot,
  User as UserIcon,
  Trash2,
  Minimize2,
  Maximize2,
  X,
  Copy,
  Check,
  ChevronDown,
  BookOpen,
  ShieldCheck,
  Database,
  FileText,
  AlertTriangle,
  Info,
  CheckCircle2,
} from 'lucide-react';

interface GeminiChatbotProps {
  currentUser: User;
  isOpen: boolean;
  onClose: () => void;
  initialRole?: string;
}

export const GeminiChatbot: React.FC<GeminiChatbotProps> = ({
  currentUser,
  isOpen,
  onClose,
  initialRole = 'matura-general',
}) => {
  const [roles, setRoles] = useState<GeminiChatRole[]>([]);
  const [selectedRoleId, setSelectedRoleId] = useState<string>(initialRole);
  const [selectedModel, setSelectedModel] = useState<string>('gemini-2.5-flash');
  const [showKnowledgeModal, setShowKnowledgeModal] = useState(false);
  const [knowledgeBaseInfo, setKnowledgeBaseInfo] = useState<{
    totalDocuments: number;
    totalChunks: number;
    documents: any[];
  } | null>(null);
  const [expandedChunkMsgId, setExpandedChunkMsgId] = useState<string | null>(null);

  const [messages, setMessages] = useState<GeminiChatMessage[]>([
    {
      id: 'welcome-1',
      role: 'model',
      text: `Pozdrav, ${currentUser.fullName}! Ja sam zvanični IDSS Asistent.
Moji odgovori su utemeljeni isključivo na internoj bazi znanja i USTAV-u škole (Zakon o osnovnom odgoju KS, Pravilnik o eksternoj maturi, ispitni katalozi i interni propisi).

Postavite mi bilo koje pitanje vezano za ispitne procedure, pragove prolaznosti, tajnost testova, formule ili nastavne cjeline.`,
      timestamp: new Date().toISOString(),
      modelUsed: 'gemini-2.5-flash',
      roleId: 'matura-general',
      confidence: 'HIGH',
      similarityScore: 1.0,
    },
  ]);
  const [inputText, setInputText] = useState('');
  const [loading, setLoading] = useState(false);
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [isExpanded, setIsExpanded] = useState(false);

  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // Load available roles and knowledge base overview
  useEffect(() => {
    async function loadInitialData() {
      try {
        const [rolesData, kbData] = await Promise.all([
          api.getGeminiRoles(),
          api.getKnowledgeBaseOverview(),
        ]);
        if (rolesData && rolesData.length > 0) {
          setRoles(rolesData);
        }
        if (kbData) {
          setKnowledgeBaseInfo(kbData);
        }
      } catch (err) {
        console.error('Greška pri učitavanju uloga ili baze znanja:', err);
      }
    }
    loadInitialData();
  }, []);

  // Scroll to bottom when messages update
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const currentRole = roles.find((r) => r.id === selectedRoleId) || {
    id: 'matura-general',
    name: 'IDSS Asistent (RAG Baza Znanja)',
    shortTitle: 'IDSS Asistent',
    description: 'Sveobuhvatna priprema utemeljena isključivo na USTAV-u, propisima i katalozima IDSS.',
    systemInstruction: '',
    suggestedPrompts: [
      'Koji je prag prolaznosti na eksternoj maturi i koliko traje ispit?',
      'Ko ima pristup sefu sa ispitnim materijalima u IDSS-u?',
      'Koji je pribor dozvoljen, a koji strogo zabranjen u ispitnoj sali?',
      'Koje su odobrene prilagodbe ispita za učenike sa posebnim potrebama?',
      'Kako se rješavaju linearne jednačine sa razlomcima i predznakom minus?',
      'Objasni pravilo reda riječi sa veznikom weil u njemačkom jeziku.',
    ],
  };

  const handleSendMessage = async (textToSend?: string) => {
    const text = textToSend || inputText;
    if (!text.trim() || loading) return;

    const userMessage: GeminiChatMessage = {
      id: 'user-' + Date.now(),
      role: 'user',
      text: text.trim(),
      timestamp: new Date().toISOString(),
    };

    const newHistory = [...messages, userMessage];
    setMessages(newHistory);
    if (!textToSend) setInputText('');
    setLoading(true);

    try {
      // Map previous conversation turns for context
      const historyPayload = newHistory.slice(-8).map((m) => ({
        role: m.role,
        text: m.text,
      }));

      const reply = await api.sendGeminiChatMessage({
        message: text.trim(),
        history: historyPayload,
        model: selectedModel,
        roleId: selectedRoleId,
      });

      setMessages((prev) => [...prev, reply]);
    } catch (err: any) {
      console.error('Greška pri slanju upita RAG servisu:', err);
      setMessages((prev) => [
        ...prev,
        {
          id: 'err-' + Date.now(),
          role: 'model',
          text: 'Došlo je do privremene greške u komunikaciji sa servisom baze znanja. Molimo pokušajte ponovo.',
          timestamp: new Date().toISOString(),
          modelUsed: selectedModel,
        },
      ]);
    } finally {
      setLoading(false);
    }
  };

  const handleClearHistory = () => {
    if (window.confirm('Da li ste sigurni da želite obrisati historiju trenutnog razgovora?')) {
      setMessages([
        {
          id: 'welcome-cleared',
          role: 'model',
          text: `Historija razgovora je resetovana. Postavite pitanje vezano za pravila, propise ili nastavne ispitne cjeline IDSS-a!`,
          timestamp: new Date().toISOString(),
          modelUsed: selectedModel,
          roleId: selectedRoleId,
          confidence: 'HIGH',
        },
      ]);
    }
  };

  const handleCopyText = (id: string, text: string) => {
    navigator.clipboard.writeText(text);
    setCopiedId(id);
    setTimeout(() => setCopiedId(null), 2000);
  };

  if (!isOpen) return null;

  return (
    <>
      <div
        className={`fixed z-50 transition-all duration-200 shadow-2xl flex flex-col bg-white border border-slate-300 overflow-hidden ${
          isExpanded
            ? 'inset-3 sm:inset-6 md:inset-10 rounded-2xl'
            : 'bottom-4 right-4 sm:bottom-6 sm:right-6 w-[94vw] sm:w-[480px] h-[650px] max-h-[92vh] rounded-2xl'
        }`}
      >
        {/* Header */}
        <div className="bg-slate-900 text-white p-3.5 border-b border-slate-800 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="w-9 h-9 rounded-xl bg-slate-950 border border-slate-700 p-1 flex items-center justify-center shrink-0 shadow-xs">
              <img
                src="https://idss.edu.ba/wp-content/uploads/2024/03/logo_white.png"
                alt="IDSS"
                className="w-full h-full object-contain"
              />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-sm text-white">IDSS Asistent</span>
                <span className="px-1.5 py-0.5 rounded-full text-[9px] font-bold bg-emerald-500/20 text-emerald-300 border border-emerald-500/30 flex items-center gap-1">
                  <ShieldCheck className="w-3 h-3" />
                  RAG Baza Znanja
                </span>
              </div>
              <p className="text-[11px] text-slate-400 truncate max-w-[260px]">
                Isključivo utemeljeno na USTAV-u i propisima škole
              </p>
            </div>
          </div>

          <div className="flex items-center gap-1.5 text-slate-300">
            <button
              onClick={() => setShowKnowledgeModal(true)}
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-emerald-400 transition-colors cursor-pointer"
              title="Pregledaj bazu znanja (USTAV)"
            >
              <BookOpen className="w-4 h-4" />
            </button>
            <button
              onClick={() => setIsExpanded(!isExpanded)}
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title={isExpanded ? 'Smanji prozor' : 'Povećaj prozor'}
            >
              {isExpanded ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
            </button>
            <button
              onClick={handleClearHistory}
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-rose-400 transition-colors cursor-pointer"
              title="Obriši historiju razgovora"
            >
              <Trash2 className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              className="p-1.5 rounded-lg hover:bg-slate-800 hover:text-white transition-colors cursor-pointer"
              title="Zatvori asistent"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Control Bar: Role, Model & Grounding Notice */}
        <div className="bg-slate-50 border-b border-slate-200 px-4 py-2 flex flex-wrap items-center justify-between gap-2 text-xs shrink-0">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500 font-medium">Uloga:</span>
            <select
              value={selectedRoleId}
              onChange={(e) => {
                setSelectedRoleId(e.target.value);
                const newRole = roles.find((r) => r.id === e.target.value);
                if (newRole) {
                  setMessages((prev) => [
                    ...prev,
                    {
                      id: 'role-switch-' + Date.now(),
                      role: 'model',
                      text: `Prebačen sam na ulogu: **${newRole.name}**.\nSvi odgovori ostaju strogo vezani za zvaničnu bazu znanja škole.`,
                      timestamp: new Date().toISOString(),
                      modelUsed: selectedModel,
                      roleId: newRole.id,
                      confidence: 'HIGH',
                    },
                  ]);
                }
              }}
              className="bg-white border border-slate-300 rounded-lg px-2 py-1 text-xs font-semibold text-slate-800 focus:outline-hidden focus:border-indigo-600 cursor-pointer"
            >
              {roles.map((r) => (
                <option key={r.id} value={r.id}>
                  {r.shortTitle}
                </option>
              ))}
            </select>
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowKnowledgeModal(true)}
              className="inline-flex items-center gap-1 text-[11px] font-semibold text-indigo-700 bg-indigo-50 border border-indigo-200 px-2 py-0.5 rounded-md hover:bg-indigo-100 transition-colors cursor-pointer"
            >
              <FileText className="w-3 h-3 text-indigo-600" />
              <span>{knowledgeBaseInfo ? `${knowledgeBaseInfo.totalDocuments} Dokumenata` : 'USTAV Izvori'}</span>
            </button>

            <div className="inline-flex rounded-lg border border-slate-300 bg-white p-0.5">
              <button
                onClick={() => setSelectedModel('gemini-2.5-flash')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  selectedModel === 'gemini-2.5-flash'
                    ? 'bg-indigo-600 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="gemini-2.5-flash: Standardni model specifikacije"
              >
                2.5 Flash
              </button>
              <button
                onClick={() => setSelectedModel('gemini-3.1-flash-lite')}
                className={`px-2 py-0.5 rounded-md text-[10px] font-semibold transition-all cursor-pointer ${
                  selectedModel === 'gemini-3.1-flash-lite'
                    ? 'bg-amber-500 text-white shadow-2xs'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
                title="gemini-3.1-flash-lite: Brzi model"
              >
                ⚡ Lite
              </button>
            </div>
          </div>
        </div>

        {/* Suggested Prompts Ribbon */}
        {currentRole.suggestedPrompts && currentRole.suggestedPrompts.length > 0 && (
          <div className="bg-slate-50/80 border-b border-slate-100 px-4 py-2 overflow-x-auto flex items-center gap-2 text-[11px] shrink-0 no-scrollbar">
            <span className="text-slate-400 font-medium shrink-0">Preporučeno:</span>
            {currentRole.suggestedPrompts.map((p, idx) => (
              <button
                key={idx}
                onClick={() => handleSendMessage(p)}
                disabled={loading}
                className="whitespace-nowrap px-2.5 py-1 rounded-md bg-white border border-slate-200 hover:border-indigo-400 hover:text-indigo-600 text-slate-700 transition-colors cursor-pointer shrink-0 disabled:opacity-50"
              >
                {p}
              </button>
            ))}
          </div>
        )}

        {/* Scrollable Message Thread */}
        <div className="flex-1 p-4 overflow-y-auto space-y-4 bg-slate-50/50">
          {messages.map((msg) => (
            <div
              key={msg.id}
              className={`flex gap-3 max-w-[88%] ${
                msg.role === 'user' ? 'ml-auto flex-row-reverse' : ''
              }`}
            >
              {/* Avatar */}
              <div
                className={`w-7 h-7 rounded-xl flex items-center justify-center text-xs font-bold shrink-0 p-1 ${
                  msg.role === 'user'
                    ? 'bg-slate-800 text-white'
                    : msg.isRefusal
                    ? 'bg-amber-600 text-white shadow-2xs'
                    : 'bg-slate-900 border border-slate-700 text-white shadow-2xs'
                }`}
              >
                {msg.role === 'user' ? (
                  <UserIcon className="w-3.5 h-3.5" />
                ) : msg.isRefusal ? (
                  <AlertTriangle className="w-3.5 h-3.5" />
                ) : (
                  <img
                    src="https://idss.edu.ba/wp-content/uploads/2024/03/logo_white.png"
                    alt="IDSS"
                    className="w-full h-full object-contain"
                  />
                )}
              </div>

              {/* Bubble */}
              <div
                className={`p-3.5 rounded-2xl text-xs sm:text-sm space-y-2 leading-relaxed shadow-2xs ${
                  msg.role === 'user'
                    ? 'bg-indigo-600 text-white rounded-tr-xs'
                    : msg.isRefusal
                    ? 'bg-amber-50/80 text-amber-950 border border-amber-200 rounded-tl-xs'
                    : 'bg-white text-slate-800 border border-slate-200/90 rounded-tl-xs'
                }`}
              >
                <div className="whitespace-pre-line break-words font-sans">
                  {msg.text}
                </div>

                {/* Refusal Notice */}
                {msg.role === 'model' && msg.isRefusal && (
                  <div className="pt-2 border-t border-amber-200/70 text-[11px] text-amber-800 flex items-start gap-1.5">
                    <Info className="w-3.5 h-3.5 text-amber-600 shrink-0 mt-0.5" />
                    <span>
                      Upit nije pronašao dovoljno relevantnih podataka u aktivnim dokumentima škole (prag pouzdanosti &lt; 75%).
                    </span>
                  </div>
                )}

                {/* Grounding & Evidence Section */}
                {msg.role === 'model' && !msg.isRefusal && msg.retrievedChunks && msg.retrievedChunks.length > 0 && (
                  <div className="pt-2 border-t border-slate-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-emerald-700">
                        <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
                        <span>Grounded u bazi znanja</span>
                        {msg.similarityScore && (
                          <span className="px-1.5 py-0.2 rounded text-[10px] font-mono bg-emerald-100 text-emerald-800">
                            {(msg.similarityScore * 100).toFixed(0)}% podudaranje
                          </span>
                        )}
                      </div>
                      <button
                        onClick={() =>
                          setExpandedChunkMsgId(expandedChunkMsgId === msg.id ? null : msg.id)
                        }
                        className="text-[11px] text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-0.5 cursor-pointer"
                      >
                        <span>
                          {expandedChunkMsgId === msg.id ? 'Sakrij izvore' : `Izvori (${msg.retrievedChunks.length})`}
                        </span>
                        <ChevronDown
                          className={`w-3 h-3 transition-transform ${
                            expandedChunkMsgId === msg.id ? 'rotate-180' : ''
                          }`}
                        />
                      </button>
                    </div>

                    {expandedChunkMsgId === msg.id && (
                      <div className="mt-2.5 space-y-2 text-[11px] bg-slate-50 p-2.5 rounded-lg border border-slate-200">
                        <div className="font-semibold text-slate-700 flex items-center gap-1">
                          <BookOpen className="w-3.5 h-3.5 text-indigo-600" />
                          <span>Pronađeni propisi i dijelovi ispitnih kataloga:</span>
                        </div>
                        {msg.retrievedChunks.map((chunk, cIdx) => (
                          <div
                            key={chunk.id || cIdx}
                            className="bg-white p-2.5 rounded border border-slate-200 text-slate-700 space-y-1"
                          >
                            <div className="flex items-center justify-between text-[11px] font-bold text-indigo-950">
                              <span>{chunk.documentTitle}</span>
                              <span className="text-emerald-700 bg-emerald-50 border border-emerald-200 px-1.5 py-0.2 rounded text-[10px] font-mono">
                                {(chunk.score * 100).toFixed(0)}%
                              </span>
                            </div>
                            <div className="text-[10px] text-slate-500 font-medium">{chunk.article}</div>
                            <div className="text-[11px] text-slate-600 italic bg-slate-50 p-1.5 rounded border border-slate-100">
                              "{chunk.text}"
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )}

                {/* Message metadata & copy button */}
                <div
                  className={`pt-1 border-t flex items-center justify-between gap-3 text-[10px] font-mono ${
                    msg.role === 'user' ? 'border-indigo-500/50 text-indigo-200' : 'border-slate-100 text-slate-400'
                  }`}
                >
                  <span>
                    {new Date(msg.timestamp).toLocaleTimeString('bs', {
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                    {msg.modelUsed && <span className="ml-1.5 opacity-80">· {msg.modelUsed}</span>}
                  </span>

                  {msg.role === 'model' && (
                    <button
                      onClick={() => handleCopyText(msg.id, msg.text)}
                      className="hover:text-slate-700 transition-colors flex items-center gap-1 cursor-pointer"
                      title="Kopiraj odgovor"
                    >
                      {copiedId === msg.id ? (
                        <>
                          <Check className="w-3 h-3 text-emerald-600" />
                          <span className="text-emerald-600">Kopirano</span>
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          <span>Kopiraj</span>
                        </>
                      )}
                    </button>
                  )}
                </div>
              </div>
            </div>
          ))}

          {loading && (
            <div className="flex gap-3 max-w-[85%]">
              <div className="w-7 h-7 rounded-xl bg-slate-900 border border-slate-700 text-white flex items-center justify-center shrink-0 p-1 shadow-2xs">
                <img
                  src="https://idss.edu.ba/wp-content/uploads/2024/03/logo_white.png"
                  alt="IDSS"
                  className="w-full h-full object-contain animate-pulse"
                />
              </div>
              <div className="p-3.5 rounded-2xl bg-white border border-slate-200 text-slate-600 text-xs italic flex items-center gap-2 shadow-2xs">
                <Sparkles className="w-3.5 h-3.5 text-emerald-500 animate-spin" />
                <span>Pretraga USTAV baze znanja i verifikacija činjenica...</span>
              </div>
            </div>
          )}

          <div ref={messagesEndRef} />
        </div>

        {/* Input Bar */}
        <div className="p-3 bg-white border-t border-slate-200 shrink-0 space-y-2">
          <div className="flex items-center gap-2">
            <textarea
              ref={textareaRef}
              rows={1}
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                  e.preventDefault();
                  handleSendMessage();
                }
              }}
              placeholder={`Postavite pitanje o ispitima, pravilima ili gradivu...`}
              className="flex-1 bg-slate-50 border border-slate-300 rounded-xl px-3.5 py-2.5 text-xs text-slate-900 focus:outline-hidden focus:border-indigo-600 focus:bg-white resize-none"
            />

            <button
              onClick={() => handleSendMessage()}
              disabled={!inputText.trim() || loading}
              className="p-2.5 rounded-xl bg-indigo-600 hover:bg-indigo-700 text-white shadow-xs transition-colors cursor-pointer disabled:opacity-50 shrink-0"
              title="Pošalji poruku"
            >
              <Send className="w-4 h-4" />
            </button>
          </div>

          <div className="flex items-center justify-between text-[10px] text-slate-400 px-1">
            <span className="flex items-center gap-1">
              <ShieldCheck className="w-3 h-3 text-emerald-600" />
              <span>Grounded RAG Pipeline · Max 20 upita/sat</span>
            </span>
            <span>Enter za slanje</span>
          </div>
        </div>
      </div>

      {/* USTAV Knowledge Base Modal */}
      {showKnowledgeModal && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl border border-slate-300 max-w-2xl w-full max-h-[85vh] flex flex-col shadow-2xl overflow-hidden animate-in fade-in zoom-in-95 duration-150">
            <div className="bg-slate-900 text-white p-4 border-b border-slate-800 flex items-center justify-between">
              <div className="flex items-center gap-2.5">
                <div className="w-10 h-10 rounded-xl bg-slate-950 border border-slate-700 p-1 flex items-center justify-center shrink-0 shadow-xs">
                  <img
                    src="https://idss.edu.ba/wp-content/uploads/2024/03/logo_white.png"
                    alt="IDSS Logo"
                    className="w-full h-full object-contain"
                  />
                </div>
                <div>
                  <h3 className="font-bold text-sm text-white">
                    USTAV i Baza Znanja IDSS-a (RAG Corpus)
                  </h3>
                  <p className="text-xs text-slate-400">
                    Zvanični pravni i ispitni dokumenti na kojima se temelje svi odgovori
                  </p>
                </div>
              </div>
              <button
                onClick={() => setShowKnowledgeModal(false)}
                className="p-1.5 rounded-lg hover:bg-slate-800 text-slate-400 hover:text-white transition-colors cursor-pointer"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <div className="p-3.5 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs flex items-start gap-2.5 leading-relaxed">
                <ShieldCheck className="w-4 h-4 text-emerald-600 shrink-0 mt-0.5" />
                <div>
                  <strong>Jedini izvor istine (Single Source of Truth):</strong> Svi odgovori IDSS
                  Asistenta moraju poticati isključivo iz dolje navedenih verificiranih dokumenata.
                  Ukoliko sličnost sa propisima iznosi manje od 75%, sistem odbija generisanje odgovora.
                </div>
              </div>

              <div className="space-y-3">
                <h4 className="text-xs font-bold text-slate-700 uppercase tracking-wider">
                  Aktivni propisi i ispitni katalozi ({knowledgeBaseInfo?.documents?.length || 8})
                </h4>

                {knowledgeBaseInfo?.documents?.map((doc: any) => (
                  <div
                    key={doc.id}
                    className="p-3 rounded-xl border border-slate-200 bg-slate-50/60 hover:bg-slate-50 transition-colors"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="text-xs font-bold text-slate-900">{doc.title}</span>
                      <span className="text-[10px] font-mono px-2 py-0.5 rounded bg-indigo-50 border border-indigo-200 text-indigo-700 font-semibold shrink-0">
                        {doc.code}
                      </span>
                    </div>
                    <div className="flex items-center gap-3 text-[11px] text-slate-500">
                      <span>Nadležnost: <strong>{doc.authority}</strong></span>
                      <span>·</span>
                      <span>Segmenti (Chunks): <strong>{doc.chunksCount}</strong></span>
                      <span>·</span>
                      <span className="text-emerald-700 font-semibold">Aktivan</span>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="p-3.5 bg-slate-50 border-t border-slate-200 flex justify-end">
              <button
                onClick={() => setShowKnowledgeModal(false)}
                className="px-4 py-2 rounded-xl bg-slate-800 hover:bg-slate-900 text-white text-xs font-semibold transition-colors cursor-pointer"
              >
                Zatvori pregled
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
