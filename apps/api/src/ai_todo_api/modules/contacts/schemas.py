from typing import Literal

from ai_todo_api.schemas import CamelModel


ContactMethodType = Literal["email", "phone", "wechat", "other"]


class ContactMethodInput(CamelModel):
    type: ContactMethodType
    value: str
    label: str | None = None
    is_primary: bool = False


class CreateContactInput(CamelModel):
    display_name: str
    nickname: str | None = None
    company: str | None = None
    title: str | None = None
    notes: str | None = None
    methods: list[ContactMethodInput] = []
    aliases: list[str] = []


class ContactMethodSummary(CamelModel):
    id: str
    type: ContactMethodType
    label: str | None = None
    value: str
    is_primary: bool


class ContactSummary(CamelModel):
    id: str
    display_name: str
    nickname: str | None = None
    company: str | None = None
    title: str | None = None
    primary_email: str | None = None
    primary_phone: str | None = None


class ContactDetail(ContactSummary):
    notes: str | None = None
    methods: list[ContactMethodSummary] = []
    aliases: list[str] = []


class CreateContactResult(CamelModel):
    contact: ContactDetail


class ContactListResult(CamelModel):
    items: list[ContactSummary]


class ContactDetailResult(CamelModel):
    contact: ContactDetail


class UpdateContactInput(CamelModel):
    display_name: str | None = None
    nickname: str | None = None
    company: str | None = None
    title: str | None = None
    notes: str | None = None
    methods: list[ContactMethodInput] | None = None
    aliases: list[str] | None = None


class UpdateContactResult(CamelModel):
    contact: ContactDetail
