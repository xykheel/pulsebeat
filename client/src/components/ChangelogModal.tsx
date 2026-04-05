import { useCallback, useEffect, useState } from 'react';
import {
  Box,
  Button,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Typography,
} from '@mui/material';
import ReactMarkdown from 'react-markdown';
import { brand } from '../theme';

const STORAGE_KEY = 'pulsebeat_changelog_seen_version';

export default function ChangelogModal() {
  const [open, setOpen] = useState(false);
  const [version, setVersion] = useState('');
  const [changelog, setChangelog] = useState('');
  const [loadError, setLoadError] = useState(false);

  const checkAndShow = useCallback(async () => {
    try {
      const res = await fetch('/api/app-info', { credentials: 'include' });
      if (!res.ok) throw new Error('bad response');
      const data = (await res.json()) as { version?: string; changelog?: string };
      const v = data.version || '';
      const md = typeof data.changelog === 'string' ? data.changelog : '';
      setVersion(v);
      setChangelog(md);
      setLoadError(false);
      const seen = localStorage.getItem(STORAGE_KEY);
      if (v && seen !== v) {
        setOpen(true);
      }
    } catch {
      setLoadError(true);
    }
  }, []);

  useEffect(() => {
    void checkAndShow();
  }, [checkAndShow]);

  const dismiss = () => {
    if (version) {
      localStorage.setItem(STORAGE_KEY, version);
    }
    setOpen(false);
  };

  return (
    <Dialog
      open={open}
      onClose={dismiss}
      maxWidth="lg"
      fullWidth
      scroll="paper"
      aria-labelledby="changelog-dialog-title"
      PaperProps={{
        sx: {
          maxHeight: '90vh',
          width: { xs: 'calc(100% - 24px)', sm: undefined },
        },
      }}
    >
      <DialogTitle id="changelog-dialog-title">
        What’s new
        {version ? (
          <Typography
            component="span"
            variant="captionMono"
            sx={{ display: 'block', mt: 0.5, color: 'text.secondary' }}
          >
            {brand.displayName} v{version}
          </Typography>
        ) : null}
      </DialogTitle>
      <DialogContent dividers sx={{ pt: 2 }}>
        {loadError ? (
          <Typography color="text.secondary" variant="body2">
            Could not load release notes. You can still use the dashboard as usual.
          </Typography>
        ) : (
          <Box
            sx={{
              '& h1': { typography: 'h5', mt: 0, mb: 1.5 },
              '& h2': { typography: 'h6', mt: 2.5, mb: 1, color: 'primary.light' },
              '& h3': { typography: 'subtitle1', mt: 2, mb: 0.75, fontWeight: 600 },
              '& p': { typography: 'body2', mb: 1.25, color: 'text.secondary' },
              '& ul': { pl: 2.5, mb: 1.5 },
              '& li': { typography: 'body2', color: 'text.secondary', mb: 0.5 },
              '& a': { color: 'primary.main' },
            }}
          >
            <ReactMarkdown>{changelog}</ReactMarkdown>
          </Box>
        )}
      </DialogContent>
      <DialogActions sx={{ px: 3, py: 2 }}>
        <Button variant="contained" onClick={dismiss} autoFocus>
          Continue
        </Button>
      </DialogActions>
    </Dialog>
  );
}
