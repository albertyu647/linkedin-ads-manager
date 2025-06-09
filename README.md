# LinkedIn Ads Manager

A modern web application for managing LinkedIn advertising campaigns with batch update capabilities.

## Features

- **OAuth Authentication**: Secure LinkedIn OAuth 2.0 integration
- **Campaign Overview**: View all your LinkedIn ad campaigns with status and budget information
- **Real-time Status Monitoring**: See which campaigns are currently running
- **Batch Updates**: Apply targeting exclusions to multiple campaigns simultaneously
- **Targeting Management**: Exclude specific industries, job titles, companies, seniorities, and skills
- **Search and Filter**: Find targeting options with typeahead search
- **Modern UI**: Clean, responsive interface built with Tailwind CSS

## Prerequisites

- Node.js 18+ and npm
- LinkedIn Developer Account
- LinkedIn Marketing API access

## Setup Instructions

### 1. LinkedIn Developer Setup

1. Go to [LinkedIn Developer Portal](https://developer.linkedin.com/)
2. Create a new app or use an existing one
3. Add the following redirect URLs to your app:
   - `http://localhost:3000/api/auth/linkedin/callback` (for development)
   - `https://yourdomain.com/api/auth/linkedin/callback` (for production)
4. Request access to the LinkedIn Marketing API
5. Note down your Client ID and Client Secret

### 2. Environment Variables

Create a `.env.local` file in the root directory with the following variables:

```env
LINKEDIN_CLIENT_ID=your_linkedin_client_id_here
LINKEDIN_CLIENT_SECRET=your_linkedin_client_secret_here
```

**Important**: Never commit these credentials to version control. The `.env.local` file is already included in `.gitignore`.

### 3. Installation

```bash
# Install dependencies
npm install

# Run the development server
npm run dev
```

The application will be available at `http://localhost:3000`.

## Usage

### Authentication
1. Navigate to the application
2. Click "Sign in with LinkedIn"
3. Authorize the application to access your LinkedIn advertising data

### Viewing Campaigns
1. Select an ad account from the dropdown
2. View all campaigns with their status, type, and budget information
3. Use the statistics cards to see totals and active campaigns

### Batch Updates
1. Select campaigns using the checkboxes
2. Click "Batch Update" button
3. Search and select targeting criteria to exclude:
   - Industries (e.g., "Computer Software")
   - Job Functions (e.g., "Marketing")
   - Job Titles (e.g., "Software Engineer")
   - Companies (e.g., "Microsoft")
   - Seniorities (e.g., "Entry level")
   - Skills (e.g., "JavaScript")
4. Click "Update Campaigns" to apply exclusions

### Features in Detail

#### Campaign List
- **Status Indicators**: Color-coded status badges (Active, Paused, etc.)
- **Selection**: Individual and bulk selection capabilities
- **Campaign Information**: Name, ID, type, cost model, budget, and creation date

#### Batch Update Modal
- **Search Functionality**: Type-ahead search for targeting options
- **Multiple Categories**: Support for various targeting facets
- **Real-time Feedback**: Live count of selected exclusions
- **Error Handling**: Clear error messages and validation

## API Integration

The application integrates with the LinkedIn Marketing API using the following endpoints:

- **Campaigns**: `/rest/campaigns` - Fetch campaign data
- **Ad Accounts**: `/rest/adAccounts` - Fetch advertiser accounts
- **Targeting Facets**: `/rest/adTargetingFacets` - Get available targeting options
- **Targeting Entities**: `/rest/adTargetingEntities` - Search targeting values

## Technical Architecture

### Frontend
- **Next.js 14**: React framework with App Router
- **TypeScript**: Type-safe development
- **Tailwind CSS**: Utility-first CSS framework
- **Client-side State**: React hooks for state management

### Backend
- **Next.js API Routes**: Server-side API endpoints
- **Cookie-based Auth**: Secure token storage
- **LinkedIn API Client**: Custom API wrapper class

### Security
- **OAuth 2.0**: Standard LinkedIn authentication flow
- **CSRF Protection**: State parameter validation
- **HTTP-only Cookies**: Secure token storage
- **Environment Variables**: Secure credential management

## Development

### Project Structure
```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   ├── dashboard/         # Dashboard page
│   └── page.tsx          # Home/login page
├── components/            # React components
│   ├── BatchUpdateModal.tsx
│   └── CampaignList.tsx
├── lib/                   # Utility libraries
│   └── linkedin-api.ts   # LinkedIn API client
└── types/                 # TypeScript definitions
    └── linkedin.ts       # LinkedIn API types
```

### Adding New Features

1. **New Targeting Facets**: Add to `TARGETING_FACETS` in `BatchUpdateModal.tsx`
2. **Campaign Filters**: Extend the `CampaignList` component
3. **Additional APIs**: Add new routes in `src/app/api/`

## Troubleshooting

### Common Issues

1. **Authentication Errors**
   - Verify LinkedIn app credentials
   - Check redirect URL configuration
   - Ensure Marketing API access is approved

2. **API Rate Limits**
   - LinkedIn has rate limits on API calls
   - The app includes error handling for rate limit responses

3. **Campaign Updates Failing**
   - Verify you have write permissions for the ad account
   - Check that campaigns are not archived or completed
   - Some targeting changes may not be allowed for active campaigns

### Debug Mode
Set `NODE_ENV=development` to see detailed error messages and API responses in the browser console.

## Deployment

### Production Environment Variables
```env
LINKEDIN_CLIENT_ID=your_production_client_id
LINKEDIN_CLIENT_SECRET=your_production_client_secret
```

### Deployment Platforms
- **Vercel**: Automatic deployment from Git
- **Netlify**: Static site with serverless functions
- **AWS/Google Cloud**: Container or serverless deployment

Make sure to:
1. Update redirect URLs in LinkedIn app settings
2. Set production environment variables
3. Configure HTTPS for production use

## Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Add tests if applicable
5. Submit a pull request

## License

This project is licensed under the MIT License.

## Support

For issues related to:
- **LinkedIn API**: Check [LinkedIn Developer Documentation](https://docs.microsoft.com/en-us/linkedin/marketing/)
- **Application Bugs**: Create an issue in this repository
- **Feature Requests**: Submit a pull request or create an issue

---

**Note**: This application requires LinkedIn Marketing API access, which must be approved by LinkedIn. Make sure you have the necessary permissions before using this tool.
