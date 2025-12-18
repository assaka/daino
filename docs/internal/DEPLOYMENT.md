# Frontend Deployment Guide

## Deploy to Vercel.com

### Prerequisites
1. Create a [Vercel](https://vercel.com) account
2. Backend deployed to Render.com (see backend/DEPLOYMENT.md)
3. Push your code to GitHub

### Step 1: Prepare Frontend for Deployment

1. **Update Environment Variables**:
   Create `.env.production` file:
   ```env
   VITE_NODE_ENV=production
   VITE_API_BASE_URL=https://your-backend-name.onrender.com
   VITE_API_VERSION=v1
   
   # Optional: If using Supabase directly in frontend
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   
   # Optional: Stripe public key
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
   
   # App Configuration
   VITE_APP_NAME=DainoStore
   VITE_APP_DESCRIPTION=Modern E-commerce Platform
   ```

2. **Test Build Locally**:
   ```bash
   npm run build
   npm run preview
   ```

### Step 2: Deploy to Vercel

#### Option A: Deploy via Vercel Dashboard

1. **Connect Repository**:
   - Go to [Vercel Dashboard](https://vercel.com/dashboard)
   - Click **"New Project"**
   - Import your GitHub repository
   - Select the repository with your frontend code

2. **Configure Project**:
   - **Framework Preset**: Vite
   - **Root Directory**: `.` (or `/` if frontend is in root)
   - **Build Command**: `npm run build`
   - **Output Directory**: `dist`
   - **Install Command**: `npm install`

3. **Environment Variables**:
   Add the following environment variables:
   ```
   VITE_NODE_ENV=production
   VITE_API_BASE_URL=https://your-backend-name.onrender.com
   VITE_API_VERSION=v1
   VITE_SUPABASE_URL=https://your-project.supabase.co
   VITE_SUPABASE_ANON_KEY=your-anon-key
   VITE_STRIPE_PUBLISHABLE_KEY=pk_live_your_stripe_publishable_key
   VITE_APP_NAME=DainoStore
   VITE_APP_DESCRIPTION=Modern E-commerce Platform
   ```

4. **Deploy**:
   - Click **"Deploy"**
   - Wait for deployment to complete
   - Your app will be available at: `https://your-project-name.vercel.app`

#### Option B: Deploy via CLI

1. **Install Vercel CLI**:
   ```bash
   npm i -g vercel
   ```

2. **Login to Vercel**:
   ```bash
   vercel login
   ```

3. **Deploy**:
   ```bash
   # First time deployment
   vercel
   
   # Follow the prompts:
   # - Set up and deploy? Yes
   # - Which scope? Your username/team
   # - Link to existing project? No
   # - Project name: daino-frontend
   # - Directory: ./
   # - Override settings? No
   ```

4. **Set Environment Variables**:
   ```bash
   vercel env add VITE_API_BASE_URL
   # Enter: https://your-backend-name.onrender.com
   
   vercel env add VITE_NODE_ENV
   # Enter: production
   
   # Add other environment variables as needed
   ```

5. **Redeploy with Environment Variables**:
   ```bash
   vercel --prod
   ```

### Step 3: Configure Custom Domain (Optional)

1. **Add Domain in Vercel**:
   - Go to Project Settings → Domains
   - Add your custom domain
   - Follow DNS configuration instructions

2. **Update Backend CORS**:
   - Add your custom domain to backend's allowed origins
   - Update environment variable in Render.com:
     ```
     CORS_ORIGIN=https://your-custom-domain.com
     ```

### Step 4: Update Backend CORS Settings

After deployment, update your backend's CORS settings to include your Vercel domain:

1. **Update Backend Environment Variables** in Render.com:
   ```env
   CORS_ORIGIN=https://your-project-name.vercel.app
   ```

2. **Or update the allowed origins in your backend code** if using multiple domains:
   ```javascript
   const allowedOrigins = [
     'http://localhost:5173',
     'http://localhost:3000',
     'https://your-project-name.vercel.app',
     'https://your-custom-domain.com'
   ];
   ```

### Step 5: Test Deployment

1. **Test Frontend**:
   - Visit your URL
   - Test user registration/login
   - Test API connectivity
   - Check browser console for errors

2. **Test API Integration**:
   ```bash
   # Test from your deployed frontend
   curl -X POST https://your-project-name.vercel.app/api/test
   ```

### Step 6: Configure Automatic Deployments

1. **Branch Protection**:
   - Main branch deploys to production
   - Feature branches deploy to preview URLs

2. **Deploy Hooks** (optional):
   - Set up webhooks for automatic deployment
   - Configure staging environments

### Performance Optimization

1. **Enable Vercel Analytics**:
   ```bash
   npm install @vercel/analytics
   ```
   
   Add to your main.jsx:
   ```javascript
   import { Analytics } from '@vercel/analytics/react';
   
   ReactDOM.createRoot(document.getElementById('root')).render(
     <React.StrictMode>
       <App />
       <Analytics />
     </React.StrictMode>
   );
   ```

2. **Add PWA Support** (optional):
   ```bash
   npm install vite-plugin-pwa
   ```

### Monitoring and Debugging

1. **Vercel Function Logs**:
   - Available in Vercel dashboard
   - Real-time logs for debugging

2. **Performance Monitoring**:
   - Vercel Analytics
   - Core Web Vitals
   - Real User Monitoring

3. **Error Tracking**:
   - Consider integrating Sentry
   - Browser error monitoring

### Environment Management

1. **Development Environment**:
   ```env
   VITE_API_BASE_URL=http://localhost:5000
   ```

2. **Preview Environment**:
   ```env
   VITE_API_BASE_URL=https://your-backend-staging.onrender.com
   ```

3. **Production Environment**:
   ```env
   VITE_API_BASE_URL=https://your-backend.onrender.com
   ```

### Troubleshooting

1. **Build Failures**:
   - Check build logs in Vercel dashboard
   - Verify all dependencies are in package.json
   - Test build locally first

2. **API Connection Issues**:
   - Verify CORS settings in backend
   - Check environment variables
   - Test API endpoints directly

3. **Environment Variables Not Working**:
   - Ensure variables start with `VITE_`
   - Redeploy after adding variables
   - Check case sensitivity

### Security Best Practices

1. **Environment Variables**:
   - Never commit `.env` files
   - Use different keys for production
   - Rotate API keys regularly

2. **Content Security Policy**:
   - Configure CSP headers
   - Restrict external resources

3. **HTTPS Only**:
   - Force HTTPS redirects
   - Secure cookie settings

Your frontend is now deployed and ready to use! 🚀

### URLs Summary
- **Frontend**: https://your-project-name.vercel.app
- **Backend**: https://your-backend-name.onrender.com
- **Database**: Supabase Dashboard