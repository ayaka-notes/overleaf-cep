# Git Bridge API v0 - Usage Guide

## Overview

This guide explains how to use the newly implemented API v0 endpoints for Git Bridge integration.

## Prerequisites

1. Overleaf web service running
2. Git Bridge service configured to point to the web service
3. Valid project ID and user authentication

## API Endpoints

### Authentication

All API v0 endpoints use the same authentication mechanism as other Overleaf API endpoints:
- OAuth2 authentication (if configured)
- Session-based authentication via cookies
- HTTP Basic Auth (if configured)

### 1. Get Project Latest Version

**Endpoint:** `GET /api/v0/docs/:project_id`

**Description:** Retrieves the latest version information for a project.

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v0/docs/507f1f77bcf86cd799439011" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "latestVerId": 243,
  "latestVerAt": "2014-11-30T18:40:58.123Z",
  "latestVerBy": {
    "email": "user@example.com",
    "name": "John Doe"
  }
}
```

### 2. Get Saved Versions (Labels)

**Endpoint:** `GET /api/v0/docs/:project_id/saved_vers`

**Description:** Retrieves all saved versions (labels) for a project.

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v0/docs/507f1f77bcf86cd799439011/saved_vers" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
[
  {
    "versionId": 243,
    "comment": "Final version before submission",
    "user": {
      "email": "user@example.com",
      "name": "John Doe"
    },
    "createdAt": "2014-11-30T18:47:01.456Z"
  },
  {
    "versionId": 185,
    "comment": "Draft version",
    "user": {
      "email": "user@example.com",
      "name": "John Doe"
    },
    "createdAt": "2014-11-11T17:18:40.789Z"
  }
]
```

### 3. Get Snapshot for Version

**Endpoint:** `GET /api/v0/docs/:project_id/snapshots/:version`

**Description:** Retrieves the complete file content for a specific version.

**Example:**
```bash
curl -X GET "http://localhost:3000/api/v0/docs/507f1f77bcf86cd799439011/snapshots/243" \
  -H "Authorization: Bearer YOUR_TOKEN"
```

**Response:**
```json
{
  "srcs": [
    [
      "\\documentclass{article}\n\\begin{document}\nHello World\n\\end{document}",
      "main.tex"
    ],
    [
      "This is chapter 1",
      "chapters/chapter1.tex"
    ]
  ],
  "atts": [
    [
      "http://localhost:3000/project/507f1f77bcf86cd799439011/blob/abc123def456",
      "images/figure1.png"
    ]
  ]
}
```

**Note:** 
- `srcs` contains text files as `[content, path]` arrays
- `atts` contains binary files as `[url, path]` arrays where the URL can be used to download the file

### 4. Push Snapshot (Not Yet Implemented)

**Endpoint:** `POST /api/v0/docs/:project_id/snapshots`

**Status:** Returns 501 Not Implemented

**Expected Request:**
```json
{
  "latestVerId": 243,
  "files": [
    {
      "name": "main.tex",
      "url": "http://git-bridge/files/abc123"
    }
  ],
  "postbackUrl": "http://git-bridge/postback/xyz"
}
```

## Error Responses

### 404 Not Found
```json
{
  "message": "Project not found"
}
```
or
```json
{
  "message": "Version not found"
}
```

### 403 Forbidden
```json
{
  "message": "Forbidden"
}
```

### 501 Not Implemented (POST endpoint)
```json
{
  "status": 501,
  "code": "notImplemented",
  "message": "Snapshot push not yet implemented"
}
```

## Testing with Git Bridge

1. **Configure Git Bridge:**
   Update your git-bridge configuration to point to the web service:
   ```json
   {
     "apiBaseUrl": "http://localhost:3000/api/v0/"
   }
   ```

2. **Clone a Project:**
   ```bash
   git clone http://git-bridge-host:8000/project_id
   ```

3. **Verify API Calls:**
   Monitor the web service logs to verify API calls are being made correctly:
   ```bash
   tail -f logs/web.log | grep "api/v0"
   ```

## Troubleshooting

### "Project not found" error
- Verify the project ID is correct
- Ensure the user has read access to the project
- Check that the project exists in the database

### "Forbidden" error
- Verify authentication credentials
- Ensure the user has appropriate permissions for the project
- Check OAuth2 configuration if using token-based auth

### Empty response for saved versions
- This is normal if the project has no saved versions/labels
- Users need to manually create labels through the Overleaf UI

### Binary file URLs not working
- Ensure the blob endpoint is accessible: `GET /project/:id/blob/:hash`
- Verify the history service is running
- Check file storage backend is accessible

## Development

### Adding Debug Logging

To enable detailed logging for API v0 endpoints:

```javascript
// In GitBridgeApiController.mjs
logger.debug({ projectId, version }, 'Getting snapshot')
```

### Testing Locally

1. Start the web service in development mode
2. Create a test project with some history
3. Use curl or Postman to test endpoints manually
4. Check response formats match expected structure

## Next Steps

- Complete the POST endpoint implementation
- Add comprehensive unit tests
- Add integration tests with actual git-bridge
- Implement rate limiting for git-bridge endpoints
- Add metrics and monitoring
