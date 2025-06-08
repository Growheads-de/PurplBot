/**
 * PM2 Ecosystem Configuration for PurplBot
 * 
 * Development:
 *   npm run dev                 # Start with nodemon for development
 * 
 * Production Deployment:
 *   npm run pm2:start:prod      # Start with PM2 in production mode
 *   npm run pm2:logs            # View logs
 *   npm run pm2:status          # Check status
 *   npm run pm2:restart         # Restart service
 *   npm run pm2:stop            # Stop service
 *   npm run pm2:delete          # Remove from PM2
 * 
 * Direct PM2 commands:
 *   pm2 start ecosystem.config.js --env production
 *   pm2 logs PurplBot
 *   pm2 monit
 */

module.exports = {
  apps: [{
    name: 'PurplBot',
    script: 'bot.js',
    description: 'Cannabis Analysis Report Bot with Thermal Printing',
    instances: 1,
    autorestart: true,
    watch: false,
    max_memory_restart: '1G',
    env: {
      NODE_ENV: 'development'
    },
    env_production: {
      NODE_ENV: 'development'
    },
    error_file: './logs/err.log',
    out_file: './logs/out.log',
    log_file: './logs/combined.log',
    time: true,
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true,
    max_restarts: 10,
    min_uptime: '10s',
    restart_delay: 4000
  }]
}; 