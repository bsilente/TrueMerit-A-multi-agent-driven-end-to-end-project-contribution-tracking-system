import React, { useState, useEffect, useRef } from 'react';
import { 
  Send, 
  Cpu, 
  Code2, 
  FileText, 
  Layout, 
  Activity, 
  CheckCircle2, 
  AlertTriangle,
  Terminal,
  Loader2,
  Server
} from 'lucide-react';

/**
 * 配置区域
 */
const API_URL = "http://localhost:8000/api/evaluate";
// !!! 重要: 将此值设为 false 以连接真实的 DeepSeek Python 后端 !!!
const DEMO_MODE = false; 

/**
 * 类型定义
 */
type ContributionType = 'code' | 'document' | 'design' | 'planning';

interface EvaluationResult {
  user_id: string;
  user_name: string;
  score: number;
  reasoning: string;
  impact_level: 'Low' | 'Medium' | 'High' | 'Critical';
  agent_logs: Array<{ sender: string; content: string }>;
}

export default function ContributionApp() {
  // --- State ---
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<EvaluationResult | null>(null);
  
  // Form State
  const [name, setName] = useState("Developer X");
  const [type, setType] = useState<ContributionType>('code');
  const [desc, setDesc] = useState("");
  const [content, setContent] = useState("");

  const logsEndRef = useRef<HTMLDivElement>(null);

  // 自动滚动日志
  useEffect(() => {
    if (result?.agent_logs) {
      logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [result]);

  // --- Handlers ---

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setResult(null);

    const payload = {
      user_id: `user_${Math.floor(Math.random() * 1000)}`,
      user_name: name,
      contribution_type: type,
      description: desc,
      content: content,
      context: "Project: DeepSeek Integration System"
    };

    try {
      if (DEMO_MODE) {
        // 模拟网络延迟
        await new Promise(r => setTimeout(r, 2000));
        mockResponse();
      } else {
        // 真实 API 调用
        const response = await fetch(API_URL, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload)
        });

        if (!response.ok) {
          throw new Error(`Server Error: ${response.statusText}`);
        }

        const data = await response.json();
        setResult(data);
      }
    } catch (err: any) {
      setError(err.message || "Failed to connect to backend agent.");
    } finally {
      setLoading(false);
    }
  };

  // 仅用于演示模式的 Mock 数据
  const mockResponse = () => {
    setResult({
      user_id: "u1",
      user_name: name,
      score: 88.5,
      reasoning: "DeepSeek (Mock): 代码结构清晰，使用了 FastAPI 异步特性，符合高性能要求。但缺少部分单元测试。",
      impact_level: "High",
      agent_logs: [
        { sender: "Admin_User", content: "Initiating evaluation for code submission..." },
        { sender: "Tech_Lead", content: "Analyzing code... Logic looks sound. O(n) complexity. Good variable naming." },
        { sender: "Product_Owner", content: "Checking alignment with requirements... Fits the backend module spec." },
        { sender: "Fairness_Judge", content: "Synthesizing scores. Assigning 88.5 based on high utility but minor documentation gaps." }
      ]
    });
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-6xl mx-auto grid grid-cols-1 lg:grid-cols-2 gap-8">
        
        {/* LEFT COLUMN: Input Form */}
        <div className="space-y-6">
          <div className="flex items-center gap-3 mb-6">
            <div className="bg-blue-600 p-2 rounded-lg">
              <Cpu className="w-6 h-6 text-white" />
            </div>
            <div>
              <h1 className="text-2xl font-bold">Contribution Agent</h1>
              <p className="text-slate-400 text-sm flex items-center gap-2">
                Powered by DeepSeek V3 
                {DEMO_MODE ? (
                  <span className="text-yellow-500 text-xs px-2 py-0.5 border border-yellow-500/30 rounded-full bg-yellow-500/10">DEMO MODE</span>
                ) : (
                  <span className="text-emerald-500 text-xs px-2 py-0.5 border border-emerald-500/30 rounded-full bg-emerald-500/10">CONNECTED</span>
                )}
              </p>
            </div>
          </div>

          <form onSubmit={handleSubmit} className="bg-slate-900 border border-slate-800 rounded-xl p-6 shadow-xl space-y-5">
            {/* User Info */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Contributor Name</label>
              <input 
                type="text" 
                value={name}
                onChange={e => setName(e.target.value)}
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-blue-500 outline-none"
              />
            </div>

            {/* Type Selection */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-2">Contribution Type</label>
              <div className="grid grid-cols-2 gap-3">
                {[
                  { id: 'code', label: 'Source Code', icon: Code2 },
                  { id: 'document', label: 'Documentation', icon: FileText },
                  { id: 'design', label: 'UI/UX Design', icon: Layout },
                  { id: 'planning', label: 'Planning', icon: Activity }
                ].map((item) => (
                  <button
                    key={item.id}
                    type="button"
                    onClick={() => setType(item.id as ContributionType)}
                    className={`flex items-center gap-2 px-4 py-3 rounded-lg border transition-all ${
                      type === item.id 
                        ? 'bg-blue-600/20 border-blue-500 text-blue-200' 
                        : 'bg-slate-950 border-slate-800 text-slate-400 hover:border-slate-700'
                    }`}
                  >
                    <item.icon className="w-4 h-4" />
                    <span className="text-sm">{item.label}</span>
                  </button>
                ))}
              </div>
            </div>

            {/* Content Input */}
            <div>
              <label className="block text-sm font-medium text-slate-400 mb-1">Description</label>
              <input 
                type="text" 
                value={desc}
                onChange={e => setDesc(e.target.value)}
                placeholder="Brief summary of your work..."
                className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 mb-3 focus:ring-2 focus:ring-blue-500 outline-none"
              />
              
              <label className="block text-sm font-medium text-slate-400 mb-1">Content / Code Snippet</label>
              <textarea 
                value={content}
                onChange={e => setContent(e.target.value)}
                className="w-full h-48 bg-slate-950 border border-slate-800 rounded-lg px-4 py-3 font-mono text-sm text-slate-300 focus:ring-2 focus:ring-blue-500 outline-none resize-none"
                placeholder="// Paste your code or document content here..."
              />
            </div>

            {/* Submit Button */}
            <button 
              type="submit" 
              disabled={loading}
              className={`w-full py-3 rounded-lg font-bold flex items-center justify-center gap-2 transition-all ${
                loading 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-blue-600 hover:bg-blue-500 text-white shadow-lg shadow-blue-900/20'
              }`}
            >
              {loading ? (
                <>
                  <Loader2 className="w-5 h-5 animate-spin" />
                  Agents Thinking...
                </>
              ) : (
                <>
                  <Send className="w-5 h-5" />
                  Submit for Evaluation
                </>
              )}
            </button>
          </form>

          {/* Connection Info */}
          <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-800 flex items-start gap-3">
            <Server className="w-5 h-5 text-slate-500 mt-0.5" />
            <div className="text-xs text-slate-400">
              <p className="font-semibold text-slate-300 mb-1">Backend Configuration</p>
              <p>Target: <span className="font-mono bg-slate-950 px-1 rounded">{API_URL}</span></p>
              <p className="mt-1">Ensure <code className="text-orange-400">backend_server.py</code> is running locally with <code className="text-blue-400">DEEPSEEK_API_KEY</code> set.</p>
            </div>
          </div>
        </div>

        {/* RIGHT COLUMN: Results & Logs */}
        <div className="flex flex-col h-full">
          {error && (
            <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-xl mb-4 flex items-center gap-3">
              <AlertTriangle className="w-5 h-5" />
              {error}
            </div>
          )}

          {!result && !loading && !error && (
            <div className="flex-1 flex flex-col items-center justify-center text-slate-600 border-2 border-dashed border-slate-800 rounded-xl p-12">
              <Activity className="w-16 h-16 mb-4 opacity-20" />
              <p>Ready to analyze submissions</p>
            </div>
          )}

          {result && (
            <div className="space-y-6 animate-in fade-in slide-in-from-bottom-4 duration-500">
              {/* Score Card */}
              <div className="bg-slate-900 border border-slate-800 rounded-xl p-6 relative overflow-hidden">
                <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/10 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
                
                <div className="flex justify-between items-start mb-6 relative z-10">
                  <div>
                    <h2 className="text-xl font-bold text-white mb-1">Evaluation Report</h2>
                    <p className="text-slate-400 text-sm">Target: {result.user_name}</p>
                  </div>
                  <div className={`px-3 py-1 rounded-full text-xs font-bold border ${
                    result.impact_level === 'High' || result.impact_level === 'Critical'
                      ? 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30'
                      : 'bg-yellow-500/20 text-yellow-400 border-yellow-500/30'
                  }`}>
                    Impact: {result.impact_level}
                  </div>
                </div>

                <div className="flex items-end gap-2 mb-4">
                  <span className="text-5xl font-black text-white">{result.score}</span>
                  <span className="text-lg text-slate-500 mb-2">/ 100</span>
                </div>

                <div className="bg-slate-950 rounded-lg p-4 border border-slate-800 text-slate-300 text-sm leading-relaxed">
                  <span className="text-blue-400 font-bold block mb-1">Reasoning:</span>
                  {result.reasoning}
                </div>
              </div>

              {/* Agent Logs */}
              <div className="bg-black rounded-xl border border-slate-800 overflow-hidden flex flex-col flex-1 min-h-[400px]">
                <div className="bg-slate-950 px-4 py-3 border-b border-slate-800 flex items-center gap-2">
                  <Terminal className="w-4 h-4 text-slate-400" />
                  <span className="text-xs font-mono text-slate-400 uppercase">System Logs (AutoGen Trace)</span>
                </div>
                <div className="p-4 space-y-4 font-mono text-xs overflow-y-auto max-h-[400px] custom-scrollbar">
                  {result.agent_logs.map((log, idx) => (
                    <div key={idx} className="flex gap-3">
                      <div className={`w-24 shrink-0 font-bold text-right ${
                        log.sender === 'Tech_Lead' ? 'text-cyan-400' :
                        log.sender === 'Product_Owner' ? 'text-purple-400' :
                        log.sender === 'Fairness_Judge' ? 'text-rose-400' : 'text-slate-500'
                      }`}>
                        {log.sender}
                      </div>
                      <div className="text-slate-300 whitespace-pre-wrap border-l border-slate-800 pl-3">
                        {log.content}
                      </div>
                    </div>
                  ))}
                  <div ref={logsEndRef} />
                </div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}