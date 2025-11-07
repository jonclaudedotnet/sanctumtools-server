#!/bin/bash

# SanctumTools Server Deployment Script
# This script helps deploy the application to various platforms

echo "SanctumTools Server Deployment"
echo "==============================="
echo ""
echo "Choose deployment platform:"
echo "1) Railway.app (Recommended)"
echo "2) Render.com"
echo "3) Heroku"
echo "4) Manual deployment instructions"
echo ""
read -p "Enter your choice (1-4): " choice

case $choice in
  1)
    echo ""
    echo "Deploying to Railway.app..."
    echo "------------------------"
    echo "1. Go to https://railway.app"
    echo "2. Sign up or login with GitHub"
    echo "3. Click 'New Project'"
    echo "4. Select 'Deploy from GitHub repo'"
    echo "5. Connect this repository"
    echo ""
    echo "Environment Variables to set in Railway:"
    echo "  AWS_ACCESS_KEY_ID: [Your AWS Access Key]"
    echo "  AWS_SECRET_ACCESS_KEY: [Check .env file]"
    echo "  AWS_REGION: us-east-1"
    echo "  SESSION_SECRET: sanctum-secure-session-key-2024-production"
    echo "  NODE_ENV: production"
    echo ""
    echo "Railway will automatically detect Node.js and deploy."
    ;;
  2)
    echo ""
    echo "Deploying to Render.com..."
    echo "------------------------"
    echo "1. Go to https://render.com"
    echo "2. Sign up or login with GitHub"
    echo "3. Click 'New' > 'Web Service'"
    echo "4. Connect your GitHub account"
    echo "5. Select this repository"
    echo ""
    echo "Configuration:"
    echo "  Name: sanctumtools-server"
    echo "  Environment: Node"
    echo "  Build Command: npm install"
    echo "  Start Command: npm start"
    echo ""
    echo "Environment Variables to set:"
    echo "  AWS_ACCESS_KEY_ID: [Your AWS Access Key]"
    echo "  AWS_SECRET_ACCESS_KEY: [Check .env file]"
    echo "  AWS_REGION: us-east-1"
    echo "  SESSION_SECRET: sanctum-secure-session-key-2024-production"
    echo "  NODE_ENV: production"
    echo "  PORT: 3000"
    ;;
  3)
    echo ""
    echo "Deploying to Heroku..."
    echo "------------------------"
    echo "1. Install Heroku CLI: https://devcenter.heroku.com/articles/heroku-cli"
    echo "2. Run: heroku create sanctumtools-server"
    echo "3. Set environment variables:"
    echo "   heroku config:set AWS_ACCESS_KEY_ID=[Your AWS Access Key]"
    echo "   heroku config:set AWS_SECRET_ACCESS_KEY=[Check .env file]"
    echo "   heroku config:set AWS_REGION=us-east-1"
    echo "   heroku config:set SESSION_SECRET=sanctum-secure-session-key-2024-production"
    echo "   heroku config:set NODE_ENV=production"
    echo "4. Deploy: git push heroku master"
    ;;
  4)
    echo ""
    echo "Manual Deployment Instructions"
    echo "-------------------------------"
    echo ""
    echo "Requirements:"
    echo "- Node.js v18+"
    echo "- npm"
    echo "- AWS credentials with DynamoDB access"
    echo ""
    echo "Steps:"
    echo "1. Clone the repository to your server"
    echo "2. Run: npm install"
    echo "3. Set environment variables (see .env.example)"
    echo "4. Run: npm start"
    echo ""
    echo "For production, use a process manager like PM2:"
    echo "  npm install -g pm2"
    echo "  pm2 start server.js --name sanctumtools"
    echo "  pm2 save"
    echo "  pm2 startup"
    ;;
  *)
    echo "Invalid choice. Exiting."
    exit 1
    ;;
esac

echo ""
echo "After deployment, configure your domain:"
echo "1. Point sanctumtools.com to your app URL"
echo "2. Point mr.sanctumtools.com to your app URL"
echo "3. Enable SSL/HTTPS in your hosting platform"