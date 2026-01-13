# OAuth2 Server Module

This module provides OAuth2 server functionality for Overleaf, including personal access token management and token verification APIs.

## Features

- **Personal Access Token Management**: Create, list, and delete personal access tokens
- **Token Verification**: Verify token validity and get token information
- **Token Validation**: Check if tokens are properly formatted and not expired

## API Endpoints

### Health Check
- `GET /ayaka/oauth2-server` - Health check endpoint

### Token Information & Verification
- `GET /oauth/token/info` - Check if an OAuth token is valid (requires Bearer token in Authorization header)
- `GET /oauth/token/details` - Get detailed information about a token (requires Bearer token in Authorization header)
- `POST /oauth/token/validate` - Validate a token (send token in request body)

### Personal Access Token Management
- `GET /oauth/personal-access-tokens` - Get all personal access tokens for the logged-in user (requires login)
- `POST /oauth/personal-access-tokens` - Create a new personal access token (requires login)
- `DELETE /oauth/personal-access-tokens/:token_id` - Delete a personal access token (requires login)

## Usage Examples

### Verify a Token
```bash
curl -H "Authorization: Bearer YOUR_TOKEN" http://localhost:3000/oauth/token/info
```

### Create a Personal Access Token
```bash
curl -X POST -H "Cookie: overleaf.sid=YOUR_SESSION" http://localhost:3000/oauth/personal-access-tokens
```

### List Personal Access Tokens
```bash
curl -H "Cookie: overleaf.sid=YOUR_SESSION" http://localhost:3000/oauth/personal-access-tokens
```

### Delete a Personal Access Token
```bash
curl -X DELETE -H "Cookie: overleaf.sid=YOUR_SESSION" http://localhost:3000/oauth/personal-access-tokens/TOKEN_ID
```

## Components

- **SecretsHelper**: Provides hashing and comparison functions for secrets
- **Oauth2Server**: Core OAuth2 server functionality
- **OAuthPersonalAccessTokenManager**: Manages personal access tokens
- **TokenController**: Handles token verification and information endpoints
- **OAuthPersonalAccessTokenController**: Handles personal access token CRUD operations
- **Oauth2ServerRouter**: Defines all routes for the module

## Database Schema

The module uses the `oauthAccessTokens` collection with the following fields:
- `accessToken`: Hashed token (SHA-512)
- `accessTokenPartial`: Last 8 characters of the token (for display)
- `type`: Token type ('personal' for personal access tokens)
- `user_id`: User ID who owns the token
- `oauthApplication_id`: OAuth application ID (null for personal tokens)
- `scope`: Token scope
- `createdAt`: Creation timestamp
- `expiresAt`: Expiration timestamp (null for non-expiring tokens)
- `lastUsedAt`: Last usage timestamp
