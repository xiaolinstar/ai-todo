# 多阶段构建：第一阶段 - 构建依赖
FROM python:3.11-slim AS builder

WORKDIR /app

# 国内服务器构建可传：--build-arg PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
ARG PIP_INDEX_URL=https://pypi.org/simple
ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=${PIP_INDEX_URL}

# 安装编译依赖
RUN apt-get update \
  && apt-get install -y --no-install-recommends gcc libpq-dev \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./

# 安装依赖并生成 wheel（用于缓存）
RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
  && pip wheel --no-cache-dir --wheel-dir /wheels .

# 第二阶段 - 运行环境
FROM python:3.11-slim

WORKDIR /app

ENV PIP_DEFAULT_TIMEOUT=120
ARG PIP_INDEX_URL=https://pypi.org/simple
ENV PIP_INDEX_URL=${PIP_INDEX_URL}

# 安装运行时依赖（仅保留必要的系统库）
RUN apt-get update \
  && apt-get install -y --no-install-recommends libpq5 \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -u 1000 appuser

# 从构建阶段复制预编译的 wheel 包
COPY --from=builder /wheels /wheels

# 安装应用依赖
RUN pip install --no-cache-dir /wheels/*.whl \
  && rm -rf /wheels

# 复制应用代码
COPY src ./src
COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts ./scripts
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

# 使用非 root 用户运行（提高安全性）
USER appuser

ENV AI_TODO_HOST=0.0.0.0
ENV AI_TODO_PORT=3100

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:3100/v1/health')" || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["python", "-m", "ai_todo_api"]