import React, { useState, useRef, useEffect } from 'react';
import { 
  Users, Code2, FileText, Upload, Plus, Trash2, 
  Send, Activity, Server, FileCheck, Terminal, AlertTriangle, ShieldCheck
} from 'lucide-react';

const API_URL = "http://localhost:8000/api/evaluate_group";

// ================= 类型定义 =================
type ContributionType = 'code' | 'document' | 'design' | 'planning';

interface Member {
  id: string;
  name: string;
  role: string;
  type: ContributionType;
  description: string;
  content: string;
  fileName?: string; // 新增：用于记录该成员上传的文件名
}

interface ResultData {
  id: string;
  name: string;
  percentage: number;
  reasoning: string;
  impact_level: 'Low' | 'Medium' | 'High' | 'Critical';
}

interface EvaluationResponse {
  results: ResultData[];
  agent_logs: Array<{ sender: string; content: string }>;
}

// ================= 辅助函数 =================
const generateId = () => Math.random().toString(36).substr(2, 9);

export default function ContributionApp() {
  // ================= 状态管理 =================
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // 1. 最终项目状态
  const [projectDesc, setProjectDesc] = useState("开发一个去中心化评价系统");
  const [finalFileName, setFinalFileName] = useState<string | null>(null);
  const [finalProjectContent, setFinalProjectContent] = useState("");

  // 2. 团队成员状态 (默认给2个演示)
  const [members, setMembers] = useState<Member[]>([
    { id: generateId(), name: "Alice", role: "后端开发", type: "code", description: "实现了核心的多智能体评估引擎", content: "def evaluate_group(self, request):\n  # 核心逻辑..." },
    { id: generateId(), name: "Bob", role: "前端开发", type: "code", description: "搭建了基础页面", content: "export default function App() {\n  return <div>UI</div>\n}" }
  ]);

  // 3. 结果状态
  const [result, setResult] = useState<EvaluationResponse | null>(null);
  const logsEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    logsEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [result]);

  // ================= 事件处理 =================
  
  // 处理文件上传 (读取为文本)
  const handleFileUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    
    setFinalFileName(file.name);
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        setFinalProjectContent(text);
      }
    };
    reader.onerror = () => setError("无法读取文件，请上传文本格式文件 (如 .py, .js, .txt)");
    reader.readAsText(file);
  };

  // 新增：处理单个成员的文件上传
  const handleMemberFileUpload = (id: string, e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // 记录文件名
    updateMember(id, 'fileName', file.name);

    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result;
      if (typeof text === 'string') {
        // 将文件内容填充到该成员的 content 中
        updateMember(id, 'content', text);
      }
    };
    reader.onerror = () => setError(`无法读取成员文件: ${file.name}`);
    reader.readAsText(file);
    
    // 清空 input，允许用户重复上传同名文件
    e.target.value = '';
  };

  const addMember = () => {
    setMembers([...members, { 
      id: generateId(), name: `Member ${members.length + 1}`, role: "开发者", 
      type: "code", description: "", content: "" 
    }]);
  };

  const removeMember = (id: string) => {
    if (members.length <= 1) return; // 至少保留一人
    setMembers(members.filter(m => m.id !== id));
  };

  const updateMember = (id: string, field: keyof Member, value: string) => {
    setMembers(members.map(m => m.id === id ? { ...m, [field]: value } : m));
  };

  // 提交给后端
  const handleSubmit = async () => {
    if (!finalProjectContent) {
      setError("请先上传【最终项目文件】作为评价基准！");
      return;
    }
    
    // 校验成员输入
    const invalidMember = members.find(m => !m.name || !m.description || !m.content);
    if (invalidMember) {
      setError(`请完善成员 "${invalidMember.name || '未命名'}" 的所有必填字段。`);
      return;
    }

    setLoading(true);
    setError(null);
    setResult(null);

    try {
      const response = await fetch(API_URL, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          project_description: projectDesc,
          final_project_content: finalProjectContent,
          contributors: members.map(m => ({
            id: m.id,
            name: m.name,
            role: m.role,
            contribution_type: m.type,
            description: m.description,
            content: m.content
          }))
        })
      });

      if (!response.ok) {
        const errData = await response.json();
        throw new Error(errData.detail || "服务器内部错误");
      }

      const data: EvaluationResponse = await response.json();
      
      // 按百分比排序
      data.results.sort((a, b) => b.percentage - a.percentage);
      setResult(data);
      
    } catch (err: any) {
      setError(err.message || "请求后端智能体失败");
    } finally {
      setLoading(false);
    }
  };

  // ================= 渲染 =================
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 font-sans p-4 md:p-8">
      <div className="max-w-7xl mx-auto space-y-8">
        
        {/* Header */}
        <header className="border-b border-slate-800 pb-6 flex items-center justify-between">
          <div className="flex items-center gap-4">
            <div className="bg-indigo-600 p-3 rounded-xl shadow-lg shadow-indigo-500/20">
              <ShieldCheck className="w-8 h-8 text-white" />
            </div>
            <div>
              <h1 className="text-3xl font-bold bg-gradient-to-r from-indigo-400 to-purple-400 bg-clip-text text-transparent">
                TrueMerit MAS
              </h1>
              <p className="text-slate-400 text-sm mt-1">基于最终产物比对的端到端贡献度划分系统</p>
            </div>
          </div>
          <div className="hidden md:flex items-center gap-2 text-xs text-slate-500 bg-slate-900 px-3 py-1.5 rounded-full border border-slate-800">
            <Server className="w-4 h-4 text-emerald-500" />
            Backend: {API_URL}
          </div>
        </header>

        {error && (
          <div className="bg-red-900/20 border border-red-800 text-red-300 p-4 rounded-xl flex items-center gap-3 animate-in fade-in">
            <AlertTriangle className="w-5 h-5 flex-shrink-0" />
            <p>{error}</p>
          </div>
        )}

        {/* 顶部布局：分为左右两部分 (输入区与分析区) */}
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8">
          
          {/* 左侧：输入控制台 */}
          <div className="lg:col-span-7 space-y-6">
            
            {/* Step 1: 最终项目录入 */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl relative overflow-hidden">
              <div className="absolute top-0 right-0 w-32 h-32 bg-indigo-500/5 rounded-full blur-3xl -translate-y-1/2 translate-x-1/2"></div>
              
              <h2 className="text-xl font-bold mb-4 flex items-center gap-2 text-indigo-300">
                <FileCheck className="w-5 h-5" />
                Step 1: 确立最终产物 (Single Source of Truth)
              </h2>
              
              <div className="space-y-4 relative z-10">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">项目一句话描述</label>
                  <input 
                    type="text" value={projectDesc} onChange={(e) => setProjectDesc(e.target.value)}
                    className="w-full bg-slate-950 border border-slate-800 rounded-lg px-4 py-2 focus:ring-2 focus:ring-indigo-500 outline-none"
                  />
                </div>

                <div className="border-2 border-dashed border-slate-700 rounded-xl p-6 text-center hover:border-indigo-500 transition-colors bg-slate-950/50">
                  <input 
                    type="file" 
                    id="file-upload" 
                    className="hidden"
                    accept=".txt,.js,.py,.md,.json,.html,.css,text/*"
                    onChange={handleFileUpload}
                  />
                  <label htmlFor="file-upload" className="cursor-pointer flex flex-col items-center gap-3">
                    <div className="bg-slate-800 p-3 rounded-full">
                      <Upload className="w-6 h-6 text-indigo-400" />
                    </div>
                    <div>
                      <span className="text-indigo-400 font-medium hover:underline">点击上传文件</span>
                      <span className="text-slate-500"> 或拖拽文件到此处</span>
                    </div>
                    <p className="text-xs text-slate-600">支持合并后的源码、文本形式的最终产出 (仅限纯文本)</p>
                  </label>
                </div>
                
                {finalFileName && (
                  <div className="bg-emerald-900/20 border border-emerald-800/50 p-3 rounded-lg flex items-center justify-between">
                    <div className="flex items-center gap-2 text-emerald-400 text-sm">
                      <FileText className="w-4 h-4" />
                      已加载最终产物: <span className="font-bold">{finalFileName}</span>
                    </div>
                    <span className="text-xs text-slate-500">{(finalProjectContent.length / 1024).toFixed(1)} KB</span>
                  </div>
                )}
              </div>
            </section>

            {/* Step 2: 团队成员配置 */}
            <section className="bg-slate-900 border border-slate-800 rounded-2xl p-6 shadow-xl">
              <div className="flex justify-between items-center mb-6">
                <h2 className="text-xl font-bold flex items-center gap-2 text-purple-300">
                  <Users className="w-5 h-5" />
                  Step 2: 团队成员宣称贡献 ({members.length} 人)
                </h2>
                <button 
                  onClick={addMember}
                  className="flex items-center gap-1 text-sm bg-slate-800 hover:bg-slate-700 text-slate-300 px-3 py-1.5 rounded-lg border border-slate-700 transition-colors"
                >
                  <Plus className="w-4 h-4" /> 新增成员
                </button>
              </div>

              <div className="space-y-4">
                {members.map((member, index) => (
                  <div key={member.id} className="bg-slate-950 border border-slate-800 rounded-xl p-5 relative group">
                    <button 
                      onClick={() => removeMember(member.id)}
                      className="absolute top-4 right-4 text-slate-600 hover:text-red-400 transition-colors"
                      title="移除该成员"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                    
                    <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-4 pr-6">
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">成员姓名</label>
                        <input 
                          value={member.name} onChange={e => updateMember(member.id, 'name', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-sm focus:border-purple-500 outline-none"
                        />
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">贡献类型</label>
                        <select 
                          value={member.type} onChange={e => updateMember(member.id, 'type', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-sm focus:border-purple-500 outline-none text-slate-300"
                        >
                          <option value="code">代码 (Code)</option>
                          <option value="document">文档 (Doc)</option>
                          <option value="design">设计 (Design)</option>
                          <option value="planning">规划 (Plan)</option>
                        </select>
                      </div>
                      <div>
                        <label className="block text-xs text-slate-500 mb-1">贡献简述</label>
                        <input 
                          value={member.description} onChange={e => updateMember(member.id, 'description', e.target.value)}
                          className="w-full bg-slate-900 border border-slate-800 rounded px-3 py-1.5 text-sm focus:border-purple-500 outline-none"
                          placeholder="例如: 开发了鉴权模块"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <div className="flex justify-between items-center mb-1">
                        <label className="block text-xs text-slate-500">具体内容/代码片段 (用于 AI 查证)</label>
                        <div className="flex items-center gap-2">
                          {member.fileName && (
                            <span className="text-[10px] text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20 truncate max-w-[150px]">
                              已导入: {member.fileName}
                            </span>
                          )}
                          <input 
                            type="file" 
                            id={`file-${member.id}`} 
                            className="hidden"
                            accept=".txt,.js,.py,.md,.json,.html,.css,text/*"
                            onChange={(e) => handleMemberFileUpload(member.id, e)}
                          />
                          <label 
                            htmlFor={`file-${member.id}`} 
                            className="cursor-pointer text-xs flex items-center gap-1 text-indigo-400 hover:text-indigo-300 transition-colors bg-indigo-500/10 hover:bg-indigo-500/20 px-2 py-1 rounded"
                          >
                            <Upload className="w-3 h-3" />
                            导入文件
                          </label>
                        </div>
                      </div>
                      <textarea 
                        value={member.content} onChange={e => updateMember(member.id, 'content', e.target.value)}
                        className="w-full h-24 bg-slate-900 border border-slate-800 rounded px-3 py-2 text-sm font-mono text-slate-400 focus:border-purple-500 outline-none resize-none"
                        placeholder="粘贴此人完成的具体内容，或点击右上角「导入文件」自动提取内容..."
                      />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            {/* Step 3: 触发评估 */}
            <button 
              onClick={handleSubmit} 
              disabled={loading}
              className={`w-full py-4 rounded-xl font-bold text-lg flex items-center justify-center gap-2 transition-all shadow-xl ${
                loading 
                  ? 'bg-slate-800 text-slate-500 cursor-not-allowed' 
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-indigo-500/25'
              }`}
            >
              {loading ? (
                <>
                  <Activity className="w-6 h-6 animate-spin" />
                  智能体正在进行全局交叉审查 (约需10-30秒)...
                </>
              ) : (
                <>
                  <Send className="w-6 h-6" />
                  提交全局分析 (Zero-Sum Evaluation)
                </>
              )}
            </button>
          </div>

          {/* 右侧：结果与日志控制台 */}
          <div className="lg:col-span-5 flex flex-col gap-6">
            
            {!result && !loading && (
              <div className="flex-1 bg-slate-900 border border-slate-800 rounded-2xl p-8 flex flex-col items-center justify-center text-center text-slate-500">
                <ShieldCheck className="w-20 h-20 mb-4 opacity-10" />
                <h3 className="text-lg font-medium text-slate-400 mb-2">等待执行深度审查</h3>
                <p className="text-sm max-w-xs">
                  AI 评审团将比对最终产物，剔除无效工作量，计算出加起来严格等于 100% 的真实贡献度。
                </p>
              </div>
            )}

            {result && (
              <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-2xl animate-in fade-in slide-in-from-right-4 duration-500">
                <div className="bg-gradient-to-r from-slate-900 to-slate-800 p-6 border-b border-slate-800">
                  <h2 className="text-xl font-bold text-white flex items-center gap-2">
                    <Activity className="w-5 h-5 text-emerald-400" />
                    最终贡献度裁决 (100%)
                  </h2>
                </div>
                
                <div className="p-6 space-y-6">
                  {result.results.map((res, idx) => (
                    <div key={res.id} className="space-y-2">
                      <div className="flex justify-between items-end">
                        <div className="flex items-center gap-2">
                          <span className={`w-6 h-6 rounded-full flex items-center justify-center text-xs font-bold text-slate-900 ${
                            idx === 0 ? 'bg-yellow-400' : idx === 1 ? 'bg-slate-300' : 'bg-amber-600'
                          }`}>
                            {idx + 1}
                          </span>
                          <span className="font-bold text-slate-200 text-lg">{res.name}</span>
                          <span className={`text-[10px] px-2 py-0.5 rounded-full uppercase font-bold border ${
                            res.impact_level === 'Critical' ? 'bg-red-500/20 text-red-400 border-red-500/30' :
                            res.impact_level === 'High' ? 'bg-orange-500/20 text-orange-400 border-orange-500/30' :
                            'bg-blue-500/20 text-blue-400 border-blue-500/30'
                          }`}>
                            {res.impact_level}
                          </span>
                        </div>
                        <span className="text-2xl font-black text-indigo-400">{res.percentage}%</span>
                      </div>
                      
                      {/* 进度条 */}
                      <div className="w-full bg-slate-950 rounded-full h-3 overflow-hidden border border-slate-800">
                        <div 
                          className="h-full bg-gradient-to-r from-indigo-500 to-purple-500 transition-all duration-1000 ease-out relative"
                          style={{ width: `${res.percentage}%` }}
                        >
                          <div className="absolute top-0 left-0 right-0 bottom-0 bg-white/20 animate-pulse"></div>
                        </div>
                      </div>
                      
                      {/* 理由 */}
                      <div className="bg-slate-950 p-3 rounded-lg border border-slate-800 text-sm text-slate-400 mt-2">
                        <span className="text-emerald-400 font-medium">Judge's Reasoning: </span>
                        {res.reasoning}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* AI 日志终端 */}
            <div className={`flex-1 bg-black border border-slate-800 rounded-2xl flex flex-col min-h-[300px] overflow-hidden ${loading ? 'opacity-100' : result ? 'opacity-100' : 'opacity-50'}`}>
              <div className="bg-slate-950 px-4 py-2 border-b border-slate-800 flex justify-between items-center">
                <div className="flex items-center gap-2 text-slate-400 text-xs font-mono uppercase">
                  <Terminal className="w-4 h-4" /> Agent System Trace
                </div>
                {loading && <span className="text-indigo-400 text-xs animate-pulse">Processing...</span>}
              </div>
              <div className="p-4 flex-1 overflow-y-auto font-mono text-xs space-y-3 custom-scrollbar h-[300px]">
                {(!result && !loading) && (
                  <div className="text-slate-600">Waiting for trigger...</div>
                )}
                {result?.agent_logs.map((log, idx) => (
                  <div key={idx} className="flex gap-3 animate-in fade-in slide-in-from-bottom-2">
                    <span className={`w-24 shrink-0 text-right font-bold ${
                      log.sender === 'Admin' ? 'text-slate-500' :
                      log.sender === 'Code_Expert' ? 'text-cyan-400' :
                      log.sender === 'Doc_Design_Expert' ? 'text-fuchsia-400' :
                      'text-rose-400'
                    }`}>
                      {log.sender}
                    </span>
                    <span className="text-slate-300 border-l border-slate-800 pl-3 whitespace-pre-wrap">
                      {log.content}
                    </span>
                  </div>
                ))}
                <div ref={logsEndRef} />
              </div>
            </div>

          </div>
        </div>
      </div>
    </div>
  );
}