const express = require('express');
const path = require('path');
const cors = require('cors');
const morgan = require('morgan');
const cookieParser = require('cookie-parser');
const config = require('./config');
const errorHandler = require('./middleware/error-handler');
const authRoutes = require('./routes/auth-routes');
const userRoutes = require('./routes/user-routes');
const modelRoutes = require('./routes/model-routes');
const generationRoutes = require('./routes/generation-routes');

const app = express();
app.set('etag', false);

app.use(
  cors({
    origin: true,
    credentials: true,
  }),
);
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
app.use('/api/models', modelRoutes);
app.use('/api/generation', generationRoutes);

app.use('/generated', express.static(config.storageRoot));
app.use(express.static(path.join(__dirname, '..', 'public')));

app.get('*', (req, res, next) => {
  if (req.path.startsWith('/api/')) return next();
  return res.sendFile(path.join(__dirname, '..', 'public', 'index.html'));
});

app.use(errorHandler);

module.exports = app;
