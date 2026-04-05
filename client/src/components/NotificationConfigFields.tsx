import { Stack, TextField, MenuItem } from '@mui/material';
import type { ChangeEvent } from 'react';

export default function NotificationConfigFields({
  type,
  config,
  onChange,
}: {
  type: string;
  config: Record<string, unknown>;
  onChange: (config: Record<string, unknown>) => void;
}) {
  const c = config || {};
  const set =
    (key: string) =>
    (e: ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) =>
      onChange({ ...c, [key]: e.target.value });

  switch (type) {
    case 'telegram':
      return (
        <Stack spacing={2}>
          <TextField label="Bot token" value={String(c.bot_token ?? '')} onChange={set('bot_token')} fullWidth />
          <TextField label="Chat ID" value={String(c.chat_id ?? '')} onChange={set('chat_id')} fullWidth />
        </Stack>
      );
    case 'discord':
    case 'slack':
    case 'teams':
    case 'rocketchat':
      return (
        <TextField
          label="Webhook URL"
          value={String(c.webhook_url ?? '')}
          onChange={set('webhook_url')}
          fullWidth
        />
      );
    case 'smtp':
      return (
        <Stack spacing={2}>
          <TextField label="Host" value={String(c.host ?? '')} onChange={set('host')} fullWidth />
          <TextField
            label="Port"
            type="number"
            value={String(c.port ?? 587)}
            onChange={set('port')}
            fullWidth
          />
          <TextField label="User" value={String(c.user ?? '')} onChange={set('user')} fullWidth autoComplete="off" />
          <TextField
            label="Password"
            type="password"
            value={String(c.pass ?? '')}
            onChange={set('pass')}
            fullWidth
            autoComplete="new-password"
          />
          <TextField label="From" value={String(c.from ?? '')} onChange={set('from')} fullWidth />
          <TextField label="To" value={String(c.to ?? '')} onChange={set('to')} fullWidth />
        </Stack>
      );
    case 'webhook':
      return (
        <Stack spacing={2}>
          <TextField label="URL" value={String(c.url ?? '')} onChange={set('url')} fullWidth />
          <TextField select label="Method" value={String(c.method ?? 'POST')} onChange={set('method')} fullWidth>
            {['GET', 'POST', 'PUT', 'PATCH'].map((m) => (
              <MenuItem key={m} value={m}>
                {m}
              </MenuItem>
            ))}
          </TextField>
          <TextField
            label="Headers (JSON)"
            value={
              typeof c.headers === 'string'
                ? c.headers
                : JSON.stringify(c.headers ?? {}, null, 2)
            }
            onChange={(e) => {
              try {
                onChange({ ...c, headers: JSON.parse(e.target.value) as Record<string, unknown> });
              } catch {
                onChange({ ...c, headers: e.target.value });
              }
            }}
            fullWidth
            multiline
            minRows={2}
            placeholder='{"Authorization":"Bearer …"}'
          />
          <TextField
            label="Body template (JSON or text, {{title}} {{body}})"
            value={String(c.body_template ?? '')}
            onChange={set('body_template')}
            fullWidth
            multiline
            minRows={2}
          />
        </Stack>
      );
    case 'pushover':
      return (
        <Stack spacing={2}>
          <TextField label="User key" value={String(c.user_key ?? '')} onChange={set('user_key')} fullWidth />
          <TextField label="API token" value={String(c.api_token ?? '')} onChange={set('api_token')} fullWidth />
        </Stack>
      );
    case 'pushbullet':
      return <TextField label="API key" value={String(c.api_key ?? '')} onChange={set('api_key')} fullWidth />;
    case 'pagerduty':
      return (
        <TextField
          label="Integration key"
          value={String(c.integration_key ?? '')}
          onChange={set('integration_key')}
          fullWidth
        />
      );
    case 'gotify':
      return (
        <Stack spacing={2}>
          <TextField label="Server URL" value={String(c.server_url ?? '')} onChange={set('server_url')} fullWidth />
          <TextField label="App token" value={String(c.app_token ?? '')} onChange={set('app_token')} fullWidth />
        </Stack>
      );
    case 'ntfy':
      return (
        <Stack spacing={2}>
          <TextField
            label="Server URL"
            value={String(c.server_url ?? '')}
            onChange={set('server_url')}
            fullWidth
            placeholder="https://ntfy.sh"
          />
          <TextField label="Topic" value={String(c.topic ?? '')} onChange={set('topic')} fullWidth />
          <TextField
            label="Auth user (optional)"
            value={String(c.auth_user ?? '')}
            onChange={set('auth_user')}
            fullWidth
          />
          <TextField
            label="Auth password (optional)"
            type="password"
            value={String(c.auth_pass ?? '')}
            onChange={set('auth_pass')}
            fullWidth
          />
        </Stack>
      );
    case 'signal':
      return (
        <Stack spacing={2}>
          <TextField
            label="signal-cli REST URL"
            value={String(c.rest_url ?? '')}
            onChange={set('rest_url')}
            fullWidth
            placeholder="http://127.0.0.1:8080"
          />
          <TextField
            label="Recipient number"
            value={String(c.recipient ?? '')}
            onChange={set('recipient')}
            fullWidth
          />
        </Stack>
      );
    case 'matrix':
      return (
        <Stack spacing={2}>
          <TextField
            label="Homeserver URL"
            value={String(c.homeserver_url ?? '')}
            onChange={set('homeserver_url')}
            fullWidth
          />
          <TextField
            label="Access token"
            value={String(c.access_token ?? '')}
            onChange={set('access_token')}
            fullWidth
          />
          <TextField label="Room ID" value={String(c.room_id ?? '')} onChange={set('room_id')} fullWidth />
        </Stack>
      );
    case 'twilio':
      return (
        <Stack spacing={2}>
          <TextField
            label="Account SID"
            value={String(c.account_sid ?? '')}
            onChange={set('account_sid')}
            fullWidth
          />
          <TextField
            label="Auth token"
            type="password"
            value={String(c.auth_token ?? '')}
            onChange={set('auth_token')}
            fullWidth
          />
          <TextField
            label="From number"
            value={String(c.from_number ?? '')}
            onChange={set('from_number')}
            fullWidth
          />
          <TextField
            label="To number"
            value={String(c.to_number ?? '')}
            onChange={set('to_number')}
            fullWidth
          />
        </Stack>
      );
    case 'apprise':
      return (
        <TextField
          label="Apprise URL"
          value={String(c.apprise_url ?? '')}
          onChange={set('apprise_url')}
          fullWidth
          placeholder="http://apprise:8000/notify"
        />
      );
    default:
      return (
        <TextField
          label="Config (JSON)"
          value={JSON.stringify(c, null, 2)}
          onChange={(e) => {
            try {
              onChange(JSON.parse(e.target.value) as Record<string, unknown>);
            } catch {
              /* ignore */
            }
          }}
          fullWidth
          multiline
          minRows={4}
        />
      );
  }
}
