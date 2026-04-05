import nodemailer from 'nodemailer';

const UA = 'Pulsebeat/1.0';

export type NotificationConfig = Record<string, unknown>;

async function fetchJson(url: string, options: RequestInit = {}): Promise<unknown> {
  const res = await fetch(url, {
    ...options,
    headers: { 'User-Agent': UA, ...((options.headers as Record<string, string>) || {}) },
  });
  const text = await res.text();
  let parsed: unknown;
  try {
    parsed = text ? JSON.parse(text) : null;
  } catch {
    parsed = text;
  }
  if (!res.ok) {
    const err = new Error(`HTTP ${res.status}`) as Error & { status?: number; body?: unknown };
    err.status = res.status;
    err.body = parsed;
    throw err;
  }
  return parsed;
}

export async function sendTelegram(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const token = config.bot_token as string | undefined;
  const chatId = config.chat_id as string | number | undefined;
  if (!token || chatId == null) throw new Error('Telegram: bot_token and chat_id required');
  const text = `<b>${escapeHtml(title)}</b>\n${escapeHtml(body)}`;
  await fetchJson(`https://api.telegram.org/bot${token}/sendMessage`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      chat_id: chatId,
      text,
      parse_mode: 'HTML',
    }),
  });
}

export async function sendDiscord(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const url = config.webhook_url as string | undefined;
  if (!url) throw new Error('Discord: webhook_url required');
  await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      embeds: [{ title, description: body, color: 0x00e5ff }],
    }),
  });
}

export async function sendSlack(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const url = config.webhook_url as string | undefined;
  if (!url) throw new Error('Slack: webhook_url required');
  await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `*${title}*\n${body}` }),
  });
}

export async function sendSmtp(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const host = config.host as string | undefined;
  const port = config.port as number | string | undefined;
  const user = config.user as string | undefined;
  const pass = config.pass as string | undefined;
  const from = config.from as string | undefined;
  const to = config.to as string | undefined;
  if (!host || !to) throw new Error('SMTP: host and to required');
  const transporter = nodemailer.createTransport({
    host,
    port: Number(port) || 587,
    secure: Number(port) === 465,
    auth: user && pass ? { user, pass } : undefined,
  });
  await transporter.sendMail({
    from: from || user || 'pulsebeat@localhost',
    to,
    subject: title,
    text: body,
  });
}

export async function sendCustomWebhook(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const url = config.url as string | undefined;
  if (!url) throw new Error('Webhook: url required');
  const method = ((config.method as string) || 'POST').toUpperCase();
  let headers: Record<string, string> = { 'User-Agent': UA, 'Content-Type': 'application/json' };
  if (config.headers && typeof config.headers === 'object' && !Array.isArray(config.headers)) {
    headers = { ...headers, ...(config.headers as Record<string, string>) };
  }
  let payload: unknown = { title, body };
  if (config.body_template) {
    try {
      payload = JSON.parse(
        String(config.body_template)
          .replace(/\{\{title\}\}/g, title)
          .replace(/\{\{body\}\}/g, body)
      );
    } catch {
      payload = String(config.body_template)
        .replace(/\{\{title\}\}/g, title)
        .replace(/\{\{body\}\}/g, body);
    }
  }
  const res = await fetch(url, {
    method,
    headers,
    body: method === 'GET' || method === 'HEAD' ? undefined : JSON.stringify(payload),
  });
  if (!res.ok) throw new Error(`Webhook HTTP ${res.status}`);
}

export async function sendTeams(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const url = config.webhook_url as string | undefined;
  if (!url) throw new Error('Teams: webhook_url required');
  const card = {
    '@type': 'MessageCard',
    '@context': 'https://schema.org/extensions',
    summary: title,
    themeColor: '00E5FF',
    title,
    text: body,
  };
  await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(card),
  });
}

export async function sendPushover(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const userKey = config.user_key as string | undefined;
  const apiToken = config.api_token as string | undefined;
  if (!userKey || !apiToken) throw new Error('Pushover: user_key and api_token required');
  await fetchJson('https://api.pushover.net/1/messages.json', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      token: apiToken,
      user: userKey,
      title,
      message: body,
    }),
  });
}

export async function sendPushbullet(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const apiKey = config.api_key as string | undefined;
  if (!apiKey) throw new Error('Pushbullet: api_key required');
  await fetchJson('https://api.pushbullet.com/v2/pushes', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Access-Token': apiKey,
    },
    body: JSON.stringify({ type: 'note', title, body }),
  });
}

export async function sendPagerDuty(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const key = config.integration_key as string | undefined;
  if (!key) throw new Error('PagerDuty: integration_key required');
  await fetchJson('https://events.pagerduty.com/v2/enqueue', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      routing_key: key,
      event_action: 'trigger',
      payload: {
        summary: `${title}: ${body}`,
        severity: 'critical',
        source: 'pulsebeat',
      },
    }),
  });
}

export async function sendGotify(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const serverUrl = String(config.server_url || '').replace(/\/$/, '');
  const token = config.app_token as string | undefined;
  if (!serverUrl || !token) throw new Error('Gotify: server_url and app_token required');
  const u = new URL('/message', serverUrl + '/');
  u.searchParams.set('token', token);
  await fetchJson(u.toString(), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, message: body, priority: 5 }),
  });
}

export async function sendNtfy(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const server = String(config.server_url || 'https://ntfy.sh').replace(/\/$/, '');
  const topic = config.topic as string | undefined;
  if (!topic) throw new Error('Ntfy: topic required');
  const url = `${server}/${encodeURIComponent(topic)}`;
  const hdrs: Record<string, string> = { 'User-Agent': UA };
  if (config.auth_user && config.auth_pass) {
    hdrs.Authorization =
      'Basic ' + Buffer.from(`${config.auth_user}:${config.auth_pass}`).toString('base64');
  }
  const res = await fetch(url, {
    method: 'POST',
    headers: { ...hdrs, Title: title },
    body,
  });
  if (!res.ok) throw new Error(`Ntfy HTTP ${res.status}`);
}

export async function sendRocketChat(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const url = config.webhook_url as string | undefined;
  if (!url) throw new Error('Rocket.Chat: webhook_url required');
  await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ text: `*${title}*\n${body}` }),
  });
}

export async function sendSignal(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const base = String(config.rest_url || '').replace(/\/$/, '');
  if (!base) throw new Error('Signal: rest_url required');
  const number = config.recipient as string | undefined;
  if (!number) throw new Error('Signal: recipient required');
  await fetchJson(`${base}/v2/send/${encodeURIComponent(number)}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ message: `*${title}*\n${body}` }),
  });
}

export async function sendMatrix(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const homeserver = String(config.homeserver_url || '').replace(/\/$/, '');
  const token = config.access_token as string | undefined;
  const roomId = config.room_id as string | undefined;
  if (!homeserver || !token || !roomId) {
    throw new Error('Matrix: homeserver_url, access_token, room_id required');
  }
  const txn = Date.now();
  const path = `/_matrix/client/v3/rooms/${encodeURIComponent(roomId)}/send/m.room.message/${txn}`;
  await fetchJson(`${homeserver}${path}?access_token=${encodeURIComponent(token)}`, {
    method: 'PUT',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      msgtype: 'm.text',
      body: `${title}\n${body}`,
      format: 'org.matrix.custom.html',
      formatted_body: `<b>${escapeHtml(title)}</b><br/>${escapeHtml(body)}`,
    }),
  });
}

export function escapeHtml(s: string): string {
  return String(s)
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}

export async function sendTwilio(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const sid = config.account_sid as string | undefined;
  const authToken = config.auth_token as string | undefined;
  const from = config.from_number as string | undefined;
  const to = config.to_number as string | undefined;
  if (!sid || !authToken || !from || !to) {
    throw new Error('Twilio: account_sid, auth_token, from_number, to_number required');
  }
  const auth = Buffer.from(`${sid}:${authToken}`).toString('base64');
  const u = new URL(`https://api.twilio.com/2010-04-01/Accounts/${sid}/Messages.json`);
  await fetchJson(u.toString(), {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: new URLSearchParams({
      From: from,
      To: to,
      Body: `${title}: ${body}`,
    }),
  });
}

export async function sendApprise(
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const url = config.apprise_url as string | undefined;
  if (!url) throw new Error('Apprise: apprise_url required');
  await fetchJson(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, body }),
  });
}

const HANDLERS: Record<
  string,
  (config: NotificationConfig, title: string, body: string) => Promise<void>
> = {
  telegram: sendTelegram,
  discord: sendDiscord,
  slack: sendSlack,
  smtp: sendSmtp,
  webhook: sendCustomWebhook,
  teams: sendTeams,
  pushover: sendPushover,
  pushbullet: sendPushbullet,
  pagerduty: sendPagerDuty,
  gotify: sendGotify,
  ntfy: sendNtfy,
  signal: sendSignal,
  rocketchat: sendRocketChat,
  matrix: sendMatrix,
  twilio: sendTwilio,
  apprise: sendApprise,
};

export const NOTIFICATION_TYPES = Object.keys(HANDLERS);

export async function dispatchNotification(
  type: string,
  config: NotificationConfig,
  title: string,
  body: string
): Promise<void> {
  const fn = HANDLERS[type];
  if (!fn) throw new Error(`Unknown notification type: ${type}`);
  await fn(config, title, body);
}
