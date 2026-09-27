import { useEffect, useRef, useState } from "react";
import type { UserNotification } from "@netflix/shared-types";
import { getNotifications, markAllNotificationsRead, markNotificationRead } from "./api";
import { BellIcon } from "./icons";
import { useI18n } from "./I18nContext";

export function NotificationCenter({ accessToken }: { accessToken: string }) {
  const { locale } = useI18n();
  const text = copy[locale];
  const [items, setItems] = useState<UserNotification[]>([]);
  const [open, setOpen] = useState(false);
  const root = useRef<HTMLDivElement>(null);
  const load = () => getNotifications(accessToken).then(result => setItems(result.items)).catch(() => undefined);
  useEffect(() => { void load(); const timer = window.setInterval(load, 60_000); return () => window.clearInterval(timer); }, [accessToken]);
  useEffect(() => { const close = (event: MouseEvent) => { if (!root.current?.contains(event.target as Node)) setOpen(false); }; document.addEventListener("mousedown", close); return () => document.removeEventListener("mousedown", close); }, []);
  const unread = items.filter(item => !item.read).length;
  async function openItem(item: UserNotification) { if (!item.read) { await markNotificationRead(accessToken, item.id); setItems(current => current.map(value => value.id === item.id ? { ...value, read: true } : value)); } if (item.actionUrl) window.location.href = item.actionUrl; }
  async function readAll() { await markAllNotificationsRead(accessToken); setItems(current => current.map(item => ({ ...item, read: true }))); }
  return <div className="notification-center" ref={root}><button className={`icon-button notifications${open ? " active" : ""}`} aria-label={text.title} aria-expanded={open} onClick={() => setOpen(value => !value)}><BellIcon/>{unread > 0 && <b>{unread > 9 ? "9+" : unread}</b>}</button>{open && <aside className="notification-panel"><header><div><span>{text.eyebrow}</span><h2>{text.title}</h2></div>{unread > 0 && <button onClick={() => void readAll()}>{text.readAll}</button>}</header><div className="notification-list">{items.length === 0 ? <p className="notification-empty">{text.empty}</p> : items.map(item => <button key={item.id} className={item.read ? "read" : ""} onClick={() => void openItem(item)}><i>{icons[item.type]}</i><span><strong>{item.title}</strong><small>{item.message}</small><time>{relative(item.createdAt, locale)}</time></span>{!item.read && <em/>}</button>)}</div></aside>}</div>;
}
const icons = { WELCOME:"★", GIFT:"◆", SOCIAL:"♥", CONTENT:"▶", PLAN:"♛" } as const;
const copy = { pt:{title:"Notificações",eyebrow:"CABINE DE AVISOS",readAll:"Marcar todas como lidas",empty:"Nenhuma notificação por enquanto."}, es:{title:"Notificaciones",eyebrow:"CABINA DE AVISOS",readAll:"Marcar todas como leídas",empty:"No hay notificaciones por ahora."}, en:{title:"Notifications",eyebrow:"NOTICE BOOTH",readAll:"Mark all as read",empty:"No notifications yet."} } as const;
function relative(value: string, locale: "pt"|"es"|"en") { const seconds = Math.max(1, Math.round((Date.now() - new Date(value).getTime()) / 1000)); const formatter = new Intl.RelativeTimeFormat(locale === "pt" ? "pt-BR" : locale, { numeric:"auto" }); if (seconds < 60) return formatter.format(-seconds,"second"); if (seconds < 3600) return formatter.format(-Math.round(seconds/60),"minute"); if (seconds < 86400) return formatter.format(-Math.round(seconds/3600),"hour"); return formatter.format(-Math.round(seconds/86400),"day"); }
