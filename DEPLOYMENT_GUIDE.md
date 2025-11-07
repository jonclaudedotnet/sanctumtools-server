# SanctumTools Server Deployment Guide

## Quick Deploy to Render.com

### Step 1: Create Render Account
1. Go to https://render.com
2. Sign up with GitHub account
3. Authorize Render to access your GitHub repositories

### Step 2: Deploy the Application
1. Click "New +" button in dashboard
2. Select "Web Service"
3. Connect your GitHub account if not already connected
4. Find and select `sanctumtools-server` repository
5. Configure the service:
   - **Name**: sanctumtools-server
   - **Region**: US East (Virginia) - closest to DynamoDB us-east-1
   - **Branch**: master
   - **Runtime**: Node
   - **Build Command**: `npm install`
   - **Start Command**: `npm start`
   - **Instance Type**: Free (for testing) or Starter ($7/month for production)

### Step 3: Set Environment Variables
Add these environment variables in Render dashboard:
- `NODE_ENV`: production
- `SESSION_SECRET`: sanctum-secure-session-key-2024-production
- `AWS_REGION`: us-east-1
- `AWS_ACCESS_KEY_ID`: (Get from your AWS IAM console)
- `AWS_SECRET_ACCESS_KEY`: (Get from your AWS IAM console)
- `PORT`: 3000

### Step 4: Deploy
Click "Create Web Service" and wait for deployment to complete.

Your app will be available at: `https://sanctumtools-server.onrender.com`

## Domain Configuration

### Setting up Custom Domains
1. In Render dashboard, go to your service
2. Click "Settings" > "Custom Domains"
3. Add these domains:
   - sanctumtools.com
   - www.sanctumtools.com
   - mr.sanctumtools.com

### DNS Configuration
Update your DNS records to point to Render:
1. For each domain, add a CNAME record pointing to your Render URL
2. Or use Render's provided DNS settings

## Testing the Deployment

### 1. Test Sign Up Flow
- Navigate to your deployed URL
- Click "Sign Up"
- Enter an email address
- Scan the QR code with an authenticator app
- Verify with TOTP code
- Complete onboarding

### 2. Test Login Flow
- Log out if logged in
- Click "Log In"
- Enter email and TOTP code
- Verify you're redirected to dashboard

### 3. Test Session Persistence
- After logging in, refresh the page
- Verify you remain logged in
- Check that session cookies are httpOnly

### 4. Test Chat Feature
- Navigate to Chat from dashboard
- Send test messages
- Verify AI companion responds

## Monitoring and Logs

### View Logs in Render
1. Go to your service dashboard
2. Click "Logs" tab
3. Monitor for any errors

### Common Issues and Solutions

#### Issue: Cannot connect to DynamoDB
**Solution**: Verify AWS credentials are correctly set in environment variables

#### Issue: Sessions not persisting
**Solution**:
- Check SESSION_SECRET is set
- Verify cookies are enabled in browser
- Ensure NODE_ENV is set to "production"

#### Issue: TOTP codes not working
**Solution**:
- Check time sync on server
- Verify authenticator app time is correct
- Try with a 2-minute window

## Production Considerations

1. **Scaling**: Upgrade to paid tier for better performance
2. **SSL**: Render provides free SSL certificates
3. **Monitoring**: Set up health checks in Render
4. **Backup**: Regular DynamoDB backups recommended
5. **Security**: Rotate AWS keys periodically

## Alternative Deployment Options

### Railway.app
1. Visit https://railway.app
2. Deploy from GitHub
3. Set environment variables
4. Deploy automatically

### Heroku
```bash
heroku create sanctumtools-server
heroku config:set [ENV_VARS]
git push heroku master
```

### AWS Elastic Beanstalk
- Use EB CLI
- Configure .ebextensions
- Deploy with `eb deploy`

## Support

For issues, check:
- Application logs in deployment platform
- AWS CloudWatch for DynamoDB logs
- Browser console for client-side errors

## Security Notes

- Never commit .env file to repository
- Use strong SESSION_SECRET in production
- Enable HTTPS/SSL for all domains
- Regularly update dependencies
- Monitor for suspicious activity