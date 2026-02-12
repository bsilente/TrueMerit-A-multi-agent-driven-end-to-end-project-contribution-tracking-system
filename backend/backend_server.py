import os
import json
import re
from typing import List, Dict, Literal
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import autogen
from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager

# ==========================================
# 1. 核心配置 (Configuration)
# ==========================================

DEEPSEEK_API_KEY = "sk-46cb59143bb942228d760df56f841577"

llm_config = {
    "config_list": [
        {
            "model": "deepseek-chat",
            "api_key": DEEPSEEK_API_KEY,
            "base_url": "https://api.deepseek.com"
        }
    ],
    "temperature": 0.1,  # 极低温度，保证评分的严谨性和确定性
    "timeout": 600,      # 多人评估阅读量极大，增加超时时间
    "cache_seed": None
}

# ==========================================
# 2. 数据模型 (Data Models)
# ==========================================

class ContributorInput(BaseModel):
    """单个成员的贡献声明"""
    id: str
    name: str
    role: str
    contribution_type: Literal['code', 'document', 'design', 'planning']
    description: str
    content: str  # 成员自己提交的工作内容/代码片段

class EvaluationRequest(BaseModel):
    """前端传来的整体评估请求"""
    project_description: str
    final_project_content: str  # 最终产品的内容（从文件读取）
    contributors: List[ContributorInput]

class ContributorResult(BaseModel):
    """单个成员的评估结果"""
    id: str
    name: str
    percentage: float  # 最终百分比 (0-100)
    reasoning: str
    impact_level: str

class EvaluationResponse(BaseModel):
    """返回给前端的最终响应"""
    results: List[ContributorResult]
    agent_logs: List[Dict[str, str]]

# ==========================================
# 3. 智能体工厂 (Agent Factory - 强化 Prompt)
# ==========================================

class AgentFactory:
    @staticmethod
    def create_admin() -> UserProxyAgent:
        return UserProxyAgent(
            name="Admin",
            system_message="负责发布最终产品源码和所有成员的贡献声明，并协调专家进行审查。",
            code_execution_config=False,
            human_input_mode="NEVER",
        )

    @staticmethod
    def create_code_expert() -> AssistantAgent:
        return AssistantAgent(
            name="Code_Expert",
            llm_config=llm_config,
            system_message="""
            你是一位严苛且经验丰富的首席软件架构师。
            你的唯一职责：审查团队成员提交的【代码类(code)】贡献。
            
            审查标准：
            1. 真实性验证：仔细比对成员提交的个人代码片段与【最终项目产出】。成员的代码是否真实存在于最终项目中？还是被废弃或重写了？
            2. 核心度评估：成员的代码是核心业务逻辑（高价值），还是边缘的样板代码、配置或简单的UI修饰（低价值）？
            3. 代码质量：架构是否合理？是否有明显漏洞？
            
            输出要求：
            请逐一分析提交了'code'的成员。严厉指出夸大其词的地方。
            不要给出最终百分比！只给出详尽的技术分析和相对重要性评估。
            """
        )

    @staticmethod
    def create_doc_expert() -> AssistantAgent:
        return AssistantAgent(
            name="Doc_Design_Expert",
            llm_config=llm_config,
            system_message="""
            你是一位资深产品总监兼UI/UX专家。
            你的唯一职责：审查团队成员提交的【文档(document)、设计(design)、规划(planning)】类贡献。
            
            审查标准：
            1. 落地率：成员提交的设计图或架构规划，是否在【最终项目产出】中得到了真正的体现和落实？如果设计了但没开发出来，价值为极低。
            2. 指导意义：该文档/设计是否解决了项目的核心痛点，为开发提供了不可或缺的蓝图？
            3. 完整性：文档的专业度和系统性如何？
            
            输出要求：
            请逐一分析提交了非代码内容的成员。不要给出最终百分比！只给出业务价值和落地情况的深度分析。
            """
        )

    @staticmethod
    def create_judge() -> AssistantAgent:
        return AssistantAgent(
            name="Fairness_Judge",
            llm_config=llm_config,
            system_message="""
            你是绝对中立、铁面无私的“贡献度仲裁法官”。
            你将阅读【最终项目产出】、所有成员的【宣称贡献】，以及【Code_Expert】和【Doc_Design_Expert】的深入分析报告。
            
            你的终极任务：计算并分配整个项目 100% 的贡献度。
            
            分配原则：
            1. 零和博弈：所有人的 percentage 相加必须【绝对等于 100.0】。
            2. 结果导向：不管个人加了多少班、写了多少代码，只要没有体现在【最终项目产出】中，或者在最终项目中无足轻重，其贡献度就必须被大幅削减。
            3. 核心溢价：解决最难的Bug、写出最核心算法、提供决定性设计的人，应该拿大头。
            
            【严格的输出格式要求】：
            你必须在最后一步，输出一段严谨的 JSON 数组数据。不要输出任何 Markdown 标记（如 ```json），直接输出 JSON 结构。
            
            JSON 必须符合以下格式（严格遵循属性名）：
            {
                "results": [
                    {
                        "id": "成员ID",
                        "name": "成员名字",
                        "percentage": 45.5,
                        "reasoning": "简明扼要的裁决理由：此人的核心代码在最终产物中占比极高...",
                        "impact_level": "Critical" // (Low/Medium/High/Critical)
                    },
                    ...
                ]
            }
            输出完上述 JSON 后，输出单词 'TERMINATE' 结束对话。
            """
        )

# ==========================================
# 4. 业务逻辑 (Service Layer)
# ==========================================

class EvaluationService:
    def evaluate_group(self, request: EvaluationRequest) -> EvaluationResponse:
        admin = AgentFactory.create_admin()
        code_expert = AgentFactory.create_code_expert()
        doc_expert = AgentFactory.create_doc_expert()
        judge = AgentFactory.create_judge()

        # 强制指定发言顺序的提示
        prompt = f"""
        【全局项目评估请求】
        
        项目描述：{request.project_description}
        
        ==================================
        【唯一真理来源：最终项目产出 (截断前 15000 字符以适应内存)】
        {request.final_project_content[:15000]}
        ==================================
        
        【团队成员宣称的贡献列表】：
        """
        
        for c in request.contributors:
            prompt += f"""
            ---
            成员ID: {c.id}
            姓名: {c.name}
            角色: {c.role}
            贡献类型: {c.contribution_type}
            自我描述: {c.description}
            具体宣称内容/代码: 
            {c.content[:3000]} # 限制单人长度
            """

        prompt += """
        \n==================================
        【流程指示】：
        1. Code_Expert 请先发言，对比代码贡献与最终产出。
        2. Doc_Design_Expert 请接着发言，对比非代码贡献与最终产出。
        3. Fairness_Judge 请最后发言，综合两位专家的意见，给出严格相加等于 100% 的 JSON 最终裁决。
        """

        # 配置 GroupChat
        groupchat = GroupChat(
            agents=[admin, code_expert, doc_expert, judge],
            messages=[],
            max_round=6,  # 管理员1 + 代码专家1 + 文档专家1 + 法官1 + 容错2
            speaker_selection_method="auto"
        )
        manager = GroupChatManager(groupchat=groupchat, llm_config=llm_config)

        # 启动多智能体分析
        chat_result = admin.initiate_chat(manager, message=prompt)
        
        return self._parse_result(chat_result.chat_history, request)

    def _parse_result(self, history: List[Dict], request: EvaluationRequest) -> EvaluationResponse:
        logs = [{"sender": m["name"], "content": m["content"]} for m in history]
        
        for msg in reversed(history):
            content = msg.get("content", "")
            if "{" in content and "results" in content:
                try:
                    # 使用正则提取 JSON，防止大模型附加废话
                    json_str = re.search(r'\{.*"results".*\]\s*\}', content, re.DOTALL).group(0)
                    parsed = json.loads(json_str)
                    
                    results = []
                    for item in parsed.get("results", []):
                        results.append(ContributorResult(
                            id=item.get("id", ""),
                            name=item.get("name", ""),
                            percentage=float(item.get("percentage", 0)),
                            reasoning=item.get("reasoning", ""),
                            impact_level=item.get("impact_level", "Unknown")
                        ))
                    
                    return EvaluationResponse(results=results, agent_logs=logs)
                except Exception as e:
                    print(f"JSON Parse Error: {e}")
                    continue
        
        raise ValueError("Agents failed to produce valid JSON format.")

# ==========================================
# 5. FastAPI 路由
# ==========================================

app = FastAPI(title="End-to-End DeepSeek MAS Contribution API")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = EvaluationService()

@app.post("/api/evaluate_group", response_model=EvaluationResponse)
async def evaluate_group_contribution(request: EvaluationRequest):
    try:
        return service.evaluate_group(request)
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

if __name__ == "__main__":
    import uvicorn
    print("Starting Advanced Group Agent Server on [http://0.0.0.0:8000](http://0.0.0.0:8000)")
    uvicorn.run(app, host="0.0.0.0", port=8000)