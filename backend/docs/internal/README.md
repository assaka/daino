🚀 STEP 1: Create Supabase Project

1. Go to https://supabase.com and sign up/login
2. Click "New Project"
3. Fill in project details:
   - Organization: Select your organization
   - Name: daino-db
   - Database Password: Generate a strong password (save it!)
   - Region: Choose closest to your users
4. Wait for project creation (2-3 minutes)
5. Get your credentials:
   - Go to Settings > Database
   - Copy the Connection string
   - Go to Settings > API
   - Copy Project URL and anon public key

🚀 STEP 2: Deploy Backend to Render.com

1. Go to https://render.com and sign up/login
2. Click "New +" → "Web Service"
3. Connect GitHub and select your daino repository
4. Configure the service:
   - Name: daino-backend
   - Environment: Node
   - Region: Choose same as Supabase
   - Branch: main
   - Root Directory: backend
   - Build Command: npm install
   - Start Command: npm start
5. Add Environment Variables:
   NODE_ENV=production
   PORT=10000
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your-anon-key
   DATABASE_URL=postgresql://postgres:[PASSWORD]@db.your-project.supabase.co:5432/postgres
   JWT_SECRET=your-super-secure-jwt-secret-min-32-chars
   JWT_EXPIRES_IN=24h
   CORS_ORIGIN=*
6. Click "Create Web Service"
7. Wait for deployment (5-10 minutes)
8. Note your backend URL: https://daino-backend-xxxx.onrender.com

🚀 STEP 3: Deploy Frontend to Vercel.com

1. Go to https://vercel.com and sign up/login
2. Click "New Project"
3. Import your GitHub repository
4. Configure the project:
   - Framework Preset: Vite
   - Root Directory: ./ (leave default)
   - Build Command: npm run build
   - Output Directory: dist
5. Add Environment Variables:
   VITE_NODE_ENV=production
   VITE_API_BASE_URL=https://daino-backend-xxxx.onrender.com
   VITE_API_VERSION=v1
   VITE_APP_NAME=DainoStore
6. Click "Deploy"
7. Wait for deployment (3-5 minutes)
8. Note your frontend URL: https://daino-xxxx.vercel.app

🚀 STEP 4: Update CORS Settings

1. Go back to Render.com → Your backend service
2. Go to Environment and update:
   CORS_ORIGIN=https://daino-xxxx.vercel.app
3. Redeploy the service

✅ Test Your Deployment

Once both are deployed, test the full stack:

1. Backend Health Check:
   curl https://daino-backend-xxxx.onrender.com/health
2. Frontend Access:
   - Visit https://daino-xxxx.vercel.app
   - Try registering a new user
   - Test login functionality
3. Database Check:
   - Go to Supabase dashboard
   - Check Table Editor for created tables

🔧 If You Need Help

The deployment guides are available at:
- Backend: backend/DEPLOYMENT.md
- Frontend: DEPLOYMENT.md

Add correct user to vercel project to auto deploy
git config user.email "hamidelabassi99@gmail.com"

add      