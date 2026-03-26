const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config');
const { AppError } = require('./utils/errors');
const errorHandler = require('./middleware/error-handler');
const { createRateLimit } = require('./middleware/rate-limit');
const authRoutes = require('./routes/auth-routes');
const userRoutes = require('./routes/user-routes');
const adminRoutes = require('./routes/admin-routes');
const modelRoutes = require('./routes/model-routes');
const generationRoutes = require('./routes/generation-routes');
const mediaRoutes = require('./routes/media-routes');

const app = express();
app.set('etag', false);
app.set('trust proxy', 1);

const appOrigin = (() => {
  try {
    return new URL(config.appBaseUrl).origin;
  } catch {
    return null;
  }
})();

const allowedOrigins = new Set([appOrigin, ...config.allowedOrigins].filter(Boolean));

app.use((req, res, next) => {
  cors({
    origin(origin, callback) {
      if (!origin) return callback(null, true);

      let sameHost = false;
      try {
        const originUrl = new URL(origin);
        sameHost = originUrl.host === req.get('host');
      } catch {
        sameHost = false;
      }

      if (sameHost || allowedOrigins.has(origin)) return callback(null, true);
      return callback(new AppError('CORS origin denied', 403, 'CORS_DENIED'));
    },
    credentials: true,
  })(req, res, next);
});
app.use((_req, res, next) => {
  res.set('X-Frame-Options', 'DENY');
  res.set('X-Content-Type-Options', 'nosniff');
  res.set('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
  res.set('Cross-Origin-Opener-Policy', 'same-origin');
  res.set('Cross-Origin-Resource-Policy', 'same-origin');
  if (config.nodeEnv === 'production') {
    res.set('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  res.set(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self'; style-src 'self'; img-src 'self' data: blob:; media-src 'self' blob:; connect-src 'self'; object-src 'none'; base-uri 'self'; frame-ancestors 'none'",
  );
  next();
});
app.use('/api', (_req, res, next) => {
  res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
  res.set('Pragma', 'no-cache');
  res.set('Expires', '0');
  next();
});
app.use(morgan('dev'));
app.use(cookieParser());
app.use(express.json({ limit: '20mb' }));
app.use(express.urlencoded({ extended: true }));

app.get('/api/health', (_req, res) => {
  res.json({
    success: true,
    data: {
      service: 'ATF',
      status: 'ok',
      provider: config.aiProvider,
      now: new Date().toISOString(),
    },
  });
});

app.use('/api/auth', authRoutes);
app.use('/api/user', userRoutes);
app.use('/api/admin', adminRoutes);
app.use('/api/models', modelRoutes);
app.use('/api/generation', generationRoutes);

app.use('/generated', mediaRoutes);
app.use(
  express.static(path.join(__dirname, '..', 'public'), {
    setHeaders(res, filePath) {
      if (/\.(js|css|html)$/i.test(filePath)) {
        res.set('Cache-Control', 'no-store, no-cache, must-revalidate, private');
        res.set('Pragma', 'no-cache');
        res.set('Expires', '0');
      }
    },
  }),
);

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use(errorHandler);

module.exports = app;
