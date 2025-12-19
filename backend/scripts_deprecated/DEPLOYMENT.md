# Backend Deployment Guide

## Deploy to Render.com

### Prerequisites
1. Create a [Render.com](https://render.com) account
2. Create a [Supabase](https://supabase.com) project
3. Push your code to GitHub

### Step 1: Setup Supabase

1. Go to [Supabase](https://supabase.com) and create a new project
2. Wait for the project to be ready
3. Go to **Settings > Database** and copy:
   - **Connection string** (for DATABASE_URL)
   - **Host**, **Database name**, **Port**, **User**, **Password**
4. Go to **Settings > API** and copy:
   - **Project URL** (for SUPABASE_URL)
   - **anon public** key (for SUPABASE_ANON_KEY)
   - **service_role** key (for SUPABASE_SERVICE_ROLE_KEY)

### Step 2: Deploy to Render.com

1. **Connect Repository**:
   - Go to [Render Dashboard](https://dashboard.render.com)
   - Click **"New +"** → **"Web Service"**
   - Connect your GitHub repository
   - Select the repository with your backend code

2. **Configure Service**:
   - **Name**: `daino-backend`
   - **Environment**: `Node`
   - **Region**: Choose closest to your users
   - **Branch**: `main` (or your default branch)
   - **Root Directory**: `backend` (if backend is in subdirectory)
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`

3. **Set Environment Variables**:
   ```env
   NODE_ENV=production
   PORT=10000
   
   # Supabase Configuration
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   SUPABASE_SERVICE_ROLE_KEY=your-service-role-key
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres
   
   # JWT Configuration
   JWT_SECRET=your-super-secure-jwt-secret-here
   JWT_EXPIRES_IN=24h
   
   # Email Configuration (optional)
   SMTP_HOST=smtp.gmail.com
   SMTP_PORT=587
   SMTP_USER=your-email@gmail.com
   SMTP_PASS=your-app-password
   
   # Stripe Configuration (optional)
   STRIPE_SECRET_KEY=sk_live_your_stripe_secret_key
   STRIPE_WEBHOOK_SECRET=whsec_your_webhook_secret
   
   # File Upload Configuration
   MAX_FILE_SIZE=10485760
   UPLOAD_DIR=uploads
   
   # Rate Limiting
   RATE_LIMIT_WINDOW=15
   RATE_LIMIT_MAX_REQUESTS=100
   
   # CORS Configuration
   CORS_ORIGIN=https://your-frontend-domain.vercel.app
   ```

4. **Advanced Settings**:
   - **Auto-Deploy**: Yes (recommended)
   - **Health Check Path**: `/health`

5. **Deploy**:
   - Click **"Create Web Service"**
   - Wait for deployment to complete
   - Your API will be available at: `https://your-service-name.onrender.com`

### Step 3: Initialize Database

Once deployed, the database tables will be automatically created on first run due to Sequelize sync.

### Step 4: Test Deployment

Test your deployed API:

```bash
# Health check
curl https://your-service-name.onrender.com/health

# Register a user
curl -X POST https://your-service-name.onrender.com/api/auth/register \
  -H "Content-Type: application/json" \
  -d '{
    "email": "test@example.com",
    "password": "password123",
    "first_name": "Test",
    "last_name": "User"
  }'
```

### Troubleshooting

1. **Database Connection Issues**:
   - Verify Supabase connection string is correct
   - Check that Supabase project is not paused
   - Ensure DATABASE_URL includes correct password

2. **CORS Issues**:
   - Add your frontend domain to CORS_ORIGIN
   - Update allowedOrigins in server.js if needed

3. **Environment Variables**:
   - Double-check all environment variables are set
   - Ensure JWT_SECRET is long and secure

4. **Build Failures**:
   - Check build logs in Render dashboard
   - Verify package.json dependencies are correct

### Monitoring

- **Logs**: Available in Render dashboard
- **Metrics**: CPU, memory usage in dashboard
- **Health Check**: `/health` endpoint
- **Database**: Monitor in Supabase dashboard

### Custom Domain (Optional)

1. Go to your service settings in Render
2. Add custom domain under "Custom Domains"
3. Update DNS records as instructed
4. Update CORS origins to include new domain

Your backend is now deployed and ready to use!