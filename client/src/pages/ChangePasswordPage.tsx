import { useState, type FormEvent } from 'react';
import {
  Alert,
  Box,
  Button,
  Stack,
  TextField,
  Typography,
} from '@mui/material';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import { apiSend } from '../api';
import GlassCard from '../components/GlassCard';

export default function ChangePasswordPage() {
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState(false);
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setSuccess(false);
    if (newPassword !== confirmPassword) {
      setError('New password and confirmation do not match');
      return;
    }
    setLoading(true);
    try {
      await apiSend('/api/auth/password', 'PUT', {
        current_password: currentPassword,
        new_password: newPassword,
      });
      setSuccess(true);
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update password');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box>
      <Box className="mb-4 flex items-center gap-2">
        <LockOutlinedIcon className="text-pb-primary text-[2rem]" aria-hidden />
        <Typography variant="h4" component="h1" className="tracking-tight">
          Change password
        </Typography>
      </Box>
      <Typography color="text.secondary" variant="body2" sx={{ mb: 3, maxWidth: 480 }}>
        Choose a strong password you have not used elsewhere. You will stay signed in after updating.
      </Typography>

      <GlassCard
        component="form"
        onSubmit={(e) => void submit(e)}
        sx={{ p: { xs: 2.5, sm: 3 }, maxWidth: 480 }}
      >
        <Stack spacing={2.5}>
          {success ? (
            <Alert severity="success">Your password was updated.</Alert>
          ) : null}
          {error ? <Alert severity="error">{error}</Alert> : null}

          <TextField
            label="Current password"
            type="password"
            name="current_password"
            autoComplete="current-password"
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            fullWidth
            required
          />
          <TextField
            label="New password"
            type="password"
            name="new_password"
            autoComplete="new-password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            fullWidth
            required
            helperText="At least 10 characters"
          />
          <TextField
            label="Confirm new password"
            type="password"
            name="confirm_new_password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            fullWidth
            required
          />

          <Button
            type="submit"
            variant="contained"
            disabled={loading}
            startIcon={<LockOutlinedIcon />}
          >
            {loading ? 'Saving…' : 'Update password'}
          </Button>
        </Stack>
      </GlassCard>
    </Box>
  );
}
