import json
import urllib.error
import urllib.parse
import urllib.request
from dataclasses import dataclass


class WechatAuthError(Exception):
    def __init__(self, code: str, message: str) -> None:
        self.code = code
        self.message = message
        super().__init__(message)


@dataclass(frozen=True)
class WechatSession:
    openid: str
    union_id: str | None


def exchange_wechat_code(*, code: str, app_id: str, app_secret: str) -> WechatSession:
    query = urllib.parse.urlencode(
        {
            "appid": app_id,
            "secret": app_secret,
            "js_code": code,
            "grant_type": "authorization_code",
        }
    )
    url = f"https://api.weixin.qq.com/sns/jscode2session?{query}"

    try:
        with urllib.request.urlopen(url, timeout=10) as response:
            payload = json.loads(response.read().decode("utf-8"))
    except urllib.error.URLError as exc:
        raise WechatAuthError("WECHAT_UNAVAILABLE", "WeChat login service is unavailable.") from exc

    errcode = payload.get("errcode")
    if errcode:
        message = payload.get("errmsg") or "WeChat login failed."
        if errcode in {40029, 40163}:
            raise WechatAuthError("INVALID_WECHAT_CODE", message)
        raise WechatAuthError("WECHAT_LOGIN_FAILED", message)

    openid = payload.get("openid")
    if not openid:
        raise WechatAuthError("WECHAT_LOGIN_FAILED", "WeChat response missing openid.")

    union_id = payload.get("unionid")
    return WechatSession(openid=openid, union_id=union_id if union_id else None)
