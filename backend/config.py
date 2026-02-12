import os

# ==========================================
# 大模型全局配置 (LLM Configuration)
# ==========================================

# 1. 配置你的 DeepSeek API Key
# 强烈建议通过环境变量配置：export DEEPSEEK_API_KEY="your-key"
# 如果为了方便本地测试，也可以直接替换下面的 "sk-..." 字符串
DEEPSEEK_API_KEY = os.environ.get("DEEPSEEK_API_KEY", "sk-YOUR_DEEPSEEK_KEY_HERE")

# 2. 构造 AutoGen 需要的 llm_config
LLM_CONFIG = {
    "config_list": [
        {
            "model": "deepseek-chat",          # 使用 DeepSeek-V3 模型
            "api_key": DEEPSEEK_API_KEY,
            "base_url": "https://api.deepseek.com" # 兼容 OpenAI 格式的 endpoint
        }
    ],
    "temperature": 0.1,  # 保持极低温度，保证打分逻辑的严谨性和确定性
    "timeout": 600,      # 多智能体交叉评审长文本需要较长时间，设置高超时
    "cache_seed": None   # 禁用缓存，确保每次评价都是实时的
}