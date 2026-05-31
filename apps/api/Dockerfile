# 多阶段构建：第一阶段 - 构建依赖
FROM python:3.11-slim AS builder

WORKDIR /app

# 国内服务器构建可传：--build-arg PIP_INDEX_URL=https://mirrors.cloud.tencent.com/pypi/simple
# 国内 apt：--build-arg APT_MIRROR=mirrors.tencent.com（docker-compose.prod 默认）
ARG PIP_INDEX_URL=https://pypi.org/simple
ARG APT_MIRROR=
ENV PIP_DEFAULT_TIMEOUT=120 \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_INDEX_URL=${PIP_INDEX_URL}

RUN if [ -n "$APT_MIRROR" ]; then \
      for f in /etc/apt/sources.list /etc/apt/sources.list.d/debian.sources; do \
        [ -f "$f" ] && sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" "$f" || true; \
      done; \
    fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends gcc libpq-dev \
  && rm -rf /var/lib/apt/lists/*

COPY pyproject.toml ./
COPY src ./src

RUN pip install --no-cache-dir --upgrade pip setuptools wheel \
  && pip wheel --no-cache-dir --wheel-dir /wheels .

# 第二阶段 - 运行环境
FROM python:3.11-slim

WORKDIR /app

ENV PIP_DEFAULT_TIMEOUT=120
ARG PIP_INDEX_URL=https://pypi.org/simple
ARG APT_MIRROR=
ENV PIP_INDEX_URL=${PIP_INDEX_URL}

RUN if [ -n "$APT_MIRROR" ]; then \
      for f in /etc/apt/sources.list /etc/apt/sources.list.d/debian.sources; do \
        [ -f "$f" ] && sed -i "s|deb.debian.org|${APT_MIRROR}|g; s|security.debian.org|${APT_MIRROR}|g" "$f" || true; \
      done; \
    fi \
  && apt-get update \
  && apt-get install -y --no-install-recommends libpq5 \
  && rm -rf /var/lib/apt/lists/* \
  && useradd -m -u 1000 appuser

COPY --from=builder /wheels /wheels

RUN pip install --no-cache-dir /wheels/*.whl \
  && rm -rf /wheels

COPY alembic.ini ./
COPY alembic ./alembic
COPY scripts ./scripts
COPY docker-entrypoint.sh /docker-entrypoint.sh

RUN chmod +x /docker-entrypoint.sh

USER appuser

ENV AI_TODO_HOST=0.0.0.0
ENV AI_TODO_PORT=3100

EXPOSE 3100

HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD python -c "import urllib.request; urllib.request.urlopen('http://127.0.0.1:3100/v1/health')" || exit 1

ENTRYPOINT ["/docker-entrypoint.sh"]
CMD ["python", "-m", "ai_todo_api"]
