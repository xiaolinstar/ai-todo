import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass

from ai_todo_api.config import settings
from ai_todo_api.errors import ErrorCode, wire_code


class WechatSubscribeMessageError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class WechatSendResult:
    message_id: str | None = None


def send_subscribe_message(
    *,
    openid: str,
    template_id: str,
    page: str,
    data: dict[str, dict[str, str]],
) -> WechatSendResult:
    if not settings.wechat_app_id or not settings.wechat_app_secret:
        raise WechatSubscribeMessageError(
            wire_code(ErrorCode.SYS_WECHAT_NOT_CONFIGURED),
            "WeChat app id or secret is not configured.",
        )

    access_token = _get_access_token()
    url = (
        "https://api.weixin.qq.com/cgi-bin/message/subscribe/send?"
        f"{urllib.parse.urlencode({'access_token': access_token})}"
    )
    body = json.dumps(
        {
            "touser": openid,
            "template_id": template_id,
            "page": page,
            "data": data,
            "miniprogram_state": "formal",
        }
    ).encode("utf-8")

    try:
        request = urllib.request.Request(
            url,
            data=body,
            headers={"content-type": "application/json"},
            method="POST",
        )
        with urllib.request.urlopen(request, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise WechatSubscribeMessageError(
            "WECHAT_UNAVAILABLE",
            "WeChat subscribe message service is unavailable.",
        ) from exc

    errcode = int(payload.get("errcode") or 0)
    if errcode != 0:
        raise WechatSubscribeMessageError(
            f"WECHAT_{errcode}",
            payload.get("errmsg") or "WeChat subscribe message failed.",
        )

    return WechatSendResult(message_id=payload.get("msgid"))


def _get_access_token() -> str:
    query = urllib.parse.urlencode(
        {
            "grant_type": "client_credential",
            "appid": settings.wechat_app_id,
            "secret": settings.wechat_app_secret,
        }
    )
    url = f"https://api.weixin.qq.com/cgi-bin/token?{query}"

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise WechatSubscribeMessageError(
            "WECHAT_UNAVAILABLE",
            "WeChat access token service is unavailable.",
        ) from exc

    errcode = payload.get("errcode")
    if errcode:
        raise WechatSubscribeMessageError(
            f"WECHAT_TOKEN_{errcode}",
            payload.get("errmsg") or "Failed to fetch WeChat access token.",
        )

    access_token = payload.get("access_token")
    if not access_token:
        raise WechatSubscribeMessageError(
            "WECHAT_TOKEN_MISSING",
            "WeChat access token response is missing access_token.",
        )
    return str(access_token)
