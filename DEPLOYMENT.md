# Deploying to Vercel

This app is now ready for Vercel deployment with zero database dependencies! All data is stored client-side in the user's browser using localStorage.

## Prerequisites

1. A Vercel account (sign up at https://vercel.com)
2. LinkedIn Developer App credentials
3. Git repository with your code

## Step 1: Update LinkedIn App Settings

1. Go to your LinkedIn Developer Portal: https://www.linkedin.com/developers/
2. Select your app
3. In the "Auth" tab, add your Vercel deployment URL to the **Authorized redirect URLs**:
   - Format: `https://your-app-name.vercel.app/api/auth/linkedin/callback`
   - Example: `https://linkedin-ads-manager.vercel.app/api/auth/linkedin/callback`

## Step 2: Configure Environment Variables in Vercel

1. Go to your Vercel project settings
2. Navigate to **Settings** → **Environment Variables**
3. Add the following variables:

```
LINKEDIN_CLIENT_ID=your_client_id_here
LINKEDIN_CLIENT_SECRET=your_client_secret_here
LINKEDIN_REDIRECT_URI=https://your-app-name.vercel.app/api/auth/linkedin/callback
```

**Important:** Replace `your-app-name` with your actual Vercel app subdomain.

## Step 3: Deploy to Vercel

### Option A: Deploy from Git (Recommended)

1. Push your code to GitHub/GitLab/Bitbucket
2. In Vercel dashboard, click **"Add New Project"**
3. Import your repository
4. Vercel will auto-detect Next.js and configure build settings
5. Add environment variables (from Step 2)
6. Click **"Deploy"**

### Option B: Deploy with Vercel CLI

```bash
# Install Vercel CLI
npm i -g vercel

# Login to Vercel
vercel login

# Deploy
vercel

# Follow prompts and set environment variables when asked
```

## Step 4: Verify Deployment

1. Visit your deployed app: `https://your-app-name.vercel.app`
2. Click "Sign in with LinkedIn"
3. Authorize the app
4. You should be redirected to the dashboard

## Features Now Using Client-Side Storage

✅ **Bid Adjustment History** - Stored in browser localStorage  
✅ **Entity Cache** - LinkedIn targeting entities cached in browser  
✅ **Date Range Preferences** - Saved per user in browser  

### Data Persistence

- Data persists across browser sessions
- Data is isolated per user (each user has their own data)
- Data is lost if user clears browser data
- Users can export/import their bid history if needed

## Troubleshooting

### Issue: OAuth redirect fails
**Solution:** Verify the redirect URI in LinkedIn Developer Portal matches exactly:
- Include `https://` protocol
- Match your Vercel domain exactly
- Include the full path: `/api/auth/linkedin/callback`

### Issue: Environment variables not working
**Solution:** 
- Redeploy after adding/updating environment variables
- Check for typos in variable names
- Ensure no trailing spaces in values

### Issue: Build fails
**Solution:**
- Run `npm install` locally to ensure dependencies are correct
- Check build logs in Vercel dashboard
- Verify Node.js version compatibility (should use Node 18+)

## Scaling Considerations

This app is now **fully stateless** and scales automatically with Vercel:

- ✅ Zero database costs
- ✅ No database connection limits
- ✅ Serverless functions handle all API calls
- ✅ Each user's data isolated in their browser
- ✅ Privacy-first: no shared data storage

## Multi-Environment Setup

For staging/production environments:

1. Create separate LinkedIn apps for each environment
2. Configure separate Vercel projects or branches
3. Set environment-specific variables in each Vercel project

## Next Steps

After deploying:

1. Test OAuth flow thoroughly
2. Verify all campaign management features work
3. Test bid adjustment tracking
4. Share the app URL with your team!

## Support

For issues specific to:
- **LinkedIn API**: Check LinkedIn Developer Documentation
- **Vercel Deployment**: Check Vercel Documentation
- **App Features**: Check the README.md file
