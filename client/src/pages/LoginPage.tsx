import { useState, type FormEvent } from 'react';
import { useNavigate } from 'react-router-dom';
import {
  Alert,
  Box,
  Button,
  Container,
  IconButton,
  InputAdornment,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import { useTheme } from '@mui/material/styles';
import LoginIcon from '@mui/icons-material/Login';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import PersonOutlineIcon from '@mui/icons-material/PersonOutline';
import VisibilityIcon from '@mui/icons-material/Visibility';
import VisibilityOffIcon from '@mui/icons-material/VisibilityOff';
import MonitorHeartIcon from '@mui/icons-material/Favorite';
import { useAuth } from '../contexts/AuthContext';
import { brand, loginPaperSx } from '../theme';

export default function LoginPage() {
  const theme = useTheme();
  const { login } = useAuth();
  const navigate = useNavigate();
  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  async function submit(e: FormEvent) {
    e.preventDefault();
    setError('');
    setLoading(true);
    try {
      await login(username, password);
      navigate('/', { replace: true });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Login failed');
    } finally {
      setLoading(false);
    }
  }

  return (
    <Box className="flex min-h-screen items-center justify-center px-4 py-8">
      <Container maxWidth="xs">
        <Paper
          elevation={0}
          className="px-6 py-6 sm:px-8 sm:py-8"
          sx={{
            ...loginPaperSx(theme),
          }}
          component="form"
          onSubmit={(e) => void submit(e)}
        >
          <Box className="mb-6 flex items-center justify-center gap-2">
            <MonitorHeartIcon className="h-8 w-8 text-pb-primary" aria-hidden />
            <Typography variant="h5" component="h1" fontWeight={700}>
              {brand.displayName}
            </Typography>
          </Box>
          <Typography variant="body2" color="text.secondary" textAlign="center" sx={{ mb: 3 }}>
            {brand.tagline}
          </Typography>

          {error ? (
            <Alert severity="error" sx={{ mb: 2 }}>
              {error}
            </Alert>
          ) : null}

          <TextField
            fullWidth
            autoComplete="username"
            name="username"
            label="Username"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            margin="normal"
            required
            autoFocus
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <PersonOutlineIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
            }}
          />
          <TextField
            fullWidth
            autoComplete="current-password"
            name="password"
            label="Password"
            type={showPassword ? 'text' : 'password'}
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            margin="normal"
            required
            InputProps={{
              startAdornment: (
                <InputAdornment position="start">
                  <LockOutlinedIcon color="action" fontSize="small" />
                </InputAdornment>
              ),
              endAdornment: (
                <InputAdornment position="end">
                  <IconButton
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                    onClick={() => setShowPassword((v) => !v)}
                    edge="end"
                    size="small"
                  >
                    {showPassword ? <VisibilityOffIcon /> : <VisibilityIcon />}
                  </IconButton>
                </InputAdornment>
              ),
            }}
          />

          <Button
            type="submit"
            fullWidth
            variant="contained"
            size="large"
            disabled={loading}
            sx={{ mt: 3, py: 1.25 }}
            startIcon={<LoginIcon />}
          >
            {loading ? 'Signing in…' : 'Sign in'}
          </Button>
        </Paper>
      </Container>
    </Box>
  );
}
