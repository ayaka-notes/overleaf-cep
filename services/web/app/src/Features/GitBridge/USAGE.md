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

### 4. Push Snapshot

**Endpoint:** `POST /api/v0/docs/:project_id/snapshots`

**Status:** ✅ Fully Implemented

**Description:** Pushes file changes from git repository to Overleaf project.

**Request:**
```bash
curl -X POST "http://localhost:3000/api/v0/docs/507f1f77bcf86cd799439011/snapshots" \
  -H "Authorization: Bearer YOUR_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "latestVerId": 243,
    "files": [
      {
        "name": "main.tex",
        "url": "http://git-bridge/files/abc123"
      },
      {
        "name": "chapters/chapter1.tex"
      }
    ],
    "postbackUrl": "http://git-bridge/postback/xyz"
  }'
```

**Immediate Response (202 Accepted):**
```json
{
  "status": 202,
  "code": "accepted",
  "message": "Accepted"
}
```

**Immediate Response (409 Conflict - Version Out of Date):**
```json
{
  "status": 409,
  "code": "outOfDate",
  "message": "Out of Date"
}
```

**Postback Response (Success - sent to postbackUrl):**
```json
{
  "code": "upToDate",
  "latestVerId": 244
}
```

**Postback Response (Invalid Files):**
```json
{
  "code": "invalidFiles",
  "errors": [
    {
      "file": "invalid/../file.tex",
      "state": "error"
    }
  ]
}
```

**Postback Response (Error):**
```json
{
  "code": "error",
  "message": "Unexpected Error"
}
```

**How it works:**
1. Request is validated immediately
2. If latestVerId matches current version, returns 202 Accepted
3. Files are processed asynchronously:
   - Downloads files from URLs if provided
   - Creates/updates files in the project
   - Deletes files not present in the new snapshot
4. Results are posted back to postbackUrl

## Error Responses

### 202 Accepted (POST endpoint)
```json
{
  "status": 202,
  "code": "accepted",
  "message": "Accepted"
}
```

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

### 409 Conflict (POST endpoint - version mismatch)
```json
{
  "status": 409,
  "code": "outOfDate",
  "message": "Out of Date"
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

3. **Make Changes and Push:**
   ```bash
   cd project_id
   echo "new content" >> main.tex
   git add main.tex
   git commit -m "Update main.tex"
   git push
   ```

4. **Verify API Calls:**
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

### "Out of Date" error (409 Conflict)
- This occurs when the latestVerId in the push request doesn't match the current project version
- Solution: Pull latest changes from Overleaf before pushing
- Git-bridge handles this automatically by retrying the push

### Empty response for saved versions
- This is normal if the project has no saved versions/labels
- Users need to manually create labels through the Overleaf UI

### Push not completing
- Check the postback logs in git-bridge
- Verify the postbackUrl is accessible from the web service
- Check web service logs for errors during file processing

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

- Add comprehensive unit tests
- Add integration tests with actual git-bridge
- Implement rate limiting for git-bridge endpoints
- Add metrics and monitoring
