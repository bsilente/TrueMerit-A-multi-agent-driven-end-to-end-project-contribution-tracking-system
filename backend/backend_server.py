import os
import json
import re
from typing import List, Dict, Optional, Literal
from contextlib import asynccontextmanager

from fastapi import FastAPI, HTTPException, BackgroundTasks
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

import autogen
from autogen import AssistantAgent, UserProxyAgent, GroupChat, GroupChatManager

# ==========================================
# 1. 核心配置 (Configuration)
# ==========================================

# 深度求索 (DeepSeek) API 配置

llm_config = {
    "config_list": [
        {
            "model": "deepseek-chat",  # DeepSeek V3/R1
            "api_key": "sk-46cb59143bb942228d760df56f841577",
            "base_url": "https://api.deepseek.com" # DeepSeek 是 OpenAI 兼容的
        }
    ],
    "temperature": 0.0,  # 降低温度以获得更稳定的评估结果
    "timeout": 300,      # 多智能体思考需要时间
    "cache_seed": None   # 禁用缓存以确保每次都是实时思考
}

# ==========================================
# 2. 数据模型 (Data Models)
# ==========================================

class ContributionInput(BaseModel):
    user_id: str
    user_name: str
    contribution_type: Literal['code', 'document', 'design', 'planning']
    content: str
    description: str
    context: Optional[str] = "Project: Decentralized Contribution System"

class EvaluationResult(BaseModel):
    user_id: str
    user_name: str
    score: float
    reasoning: str
    impact_level: str
    agent_logs: List[Dict[str, str]] = [] # 返回对话日志给前端展示

# ==========================================
# 3. 智能体工厂 (Agent Factory)
# ==========================================

class AgentFactory:
    @staticmethod
    def create_admin() -> UserProxyAgent:
        return UserProxyAgent(
            name="Admin_User",
            system_message="Admin who initiates the evaluation request.",
            code_execution_config=False,
            human_input_mode="NEVER",
        )

    @staticmethod
    def create_tech_lead() -> AssistantAgent:
        return AssistantAgent(
            name="Tech_Lead",
            llm_config=llm_config,
            system_message="""
            Role: Senior Technical Architect.
            Task: Evaluate 'code' submissions.
            Criteria:
            1. Complexity & Algorithm Efficiency.
            2. Code Style & Best Practices.
            3. Impact on System Stability.
            Output: Provide a concise technical review focusing on facts.
            """
        )

    @staticmethod
    def create_product_owner() -> AssistantAgent:
        return AssistantAgent(
            name="Product_Owner",
            llm_config=llm_config,
            system_message="""
            Role: Senior Product Manager.
            Task: Evaluate 'document', 'design', or 'planning' submissions.
            Criteria:
            1. Clarity & Completeness.
            2. Alignment with Business Goals.
            3. Usability & User Experience.
            Output: Provide a concise business value review.
            """
        )

    @staticmethod
    def create_judge() -> AssistantAgent:
        return AssistantAgent(
            name="Fairness_Judge",
            llm_config=llm_config,
            system_message="""
            Role: Final Arbitrator.
            Task: Synthesize reviews and output the final JSON score.
            
            Based on the analysis from Tech_Lead or Product_Owner:
            1. Assign a Fairness Score (0-100).
            2. Assign Impact Level (Low/Medium/High/Critical).
            3. Summarize reasoning.
            
            CRITICAL: You MUST output ONLY valid JSON at the end of your response.
            Format:
            {
                "score": 85.5,
                "reasoning": "...",
                "impact_level": "High"
            }
            Do not add markdown blocks like ```json. Just raw JSON.
            End with 'TERMINATE'.
            """
        )

# ==========================================
# 4. 业务逻辑 (Service Layer)
# ==========================================

class EvaluationService:
    def evaluate(self, data: ContributionInput) -> EvaluationResult:
        # 1. 实例化智能体
        admin = AgentFactory.create_admin()
        tech = AgentFactory.create_tech_lead()
        pm = AgentFactory.create_product_owner()
        judge = AgentFactory.create_judge()

        # 2. 定义群组
        groupchat = GroupChat(
            agents=[admin, tech, pm, judge],
            messages=[],
            max_round=10,
            speaker_selection_method="auto"
        )
        manager = GroupChatManager(groupchat=groupchat, llm_config=llm_config)

        # 3. 构造提示词
        prompt = f"""
        EVALUATION REQUEST:
        User: {data.user_name}
        Type: {data.contribution_type}
        Context: {data.context}
        Description: {data.description}
        Content Snippet: {data.content[:2000]}... (truncated if too long)
        
        INSTRUCTIONS:
        - If type is 'code', Tech_Lead MUST analyze first.
        - If type is other, Product_Owner MUST analyze first.
        - Fairness_Judge MUST speak last and output JSON.
        """

        # 4. 运行对话
        chat_result = admin.initiate_chat(manager, message=prompt)
        
        # 5. 提取结果
        return self._parse_result(chat_result.chat_history, data)

    def _parse_result(self, history: List[Dict], data: ContributionInput) -> EvaluationResult:
        logs = [{"sender": m["name"], "content": m["content"]} for m in history]
        
        # 倒序寻找 JSON
        for msg in reversed(history):
            content = msg.get("content", "")
            if "{" in content and "}" in content:
                try:
                    # 简单的正则清洗，处理 DeepSeek 可能输出的 Markdown 标记
                    json_str = re.search(r'\{[\s\S]*\}', content).group(0)
                    parsed = json.loads(json_str)
                    
                    return EvaluationResult(
                        user_id=data.user_id,
                        user_name=data.user_name,
                        score=parsed.get("score", 0),
                        reasoning=parsed.get("reasoning", "Parse error"),
                        impact_level=parsed.get("impact_level", "Unknown"),
                        agent_logs=logs
                    )
                except Exception as e:
                    print(f"JSON Parse Error: {e}")
                    continue
        
        # 失败回退
        return EvaluationResult(
            user_id=data.user_id,
            user_name=data.user_name,
            score=0,
            reasoning="AI Response validation failed. Please retry.",
            impact_level="Error",
            agent_logs=logs
        )

# ==========================================
# 5. 服务器入口 (Server Entry)
# ==========================================

app = FastAPI(title="DeepSeek Contribution Agent API")

# 配置 CORS，允许前端跨域访问
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], # 生产环境请修改为具体的前端域名
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

service = EvaluationService()

@app.post("/api/evaluate", response_model=EvaluationResult)
async def evaluate_contribution(input_data: ContributionInput):
    """
    接收前端提交，调用 DeepSeek Agents 进行评估
    """
    try:
        # 注意：AutoGen 是同步库，建议在生产环境放入后台任务或线程池
        # 这里为了演示清晰直接调用
        result = service.evaluate(input_data)
        return result
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@app.get("/health")
def health_check():
    return {"status": "running", "llm": "deepseek-chat"}

if __name__ == "__main__":
    import uvicorn
    # 启动命令: python backend_server.py
    print("Starting DeepSeek Agent Server on [http://0.0.0.0:8000](http://0.0.0.0:8000)")
    uvicorn.run(app, host="0.0.0.0", port=8000)