# Git Bridge API v0 Implementation

## Overview

This implementation provides the API v0 endpoints required by the Git Bridge service to synchronize Overleaf projects with Git repositories.

## Implemented Endpoints

### 1. GET /api/v0/docs/:project_id

Returns the latest version information for a project.

**Response Format:**
```json
{
  "latestVerId": 243,
  "latestVerAt": "2014-11-30T18:40:58.123Z",
  "latestVerBy": {
    "email": "user@example.com",
    "name": "User Name"
  }
}
```

**Implementation Details:**
- Retrieves project information from ProjectGetter
- Gets latest history update from HistoryManager
- Enriches with user information from UserGetter
- Returns null for `latestVerBy` if no user information available

### 2. GET /api/v0/docs/:project_id/saved_vers

Returns the list of saved versions (labels) for a project.

**Response Format:**
```json
[
  {
    "versionId": 243,
    "comment": "added more info on doc GET",
    "user": {
      "email": "user@example.com",
      "name": "User Name"
    },
    "createdAt": "2014-11-30T18:47:01.456Z"
  }
]
```

**Implementation Details:**
- Fetches labels from project-history service
- Enriches labels with user information
- Handles 404 errors by returning empty array
- Transforms to git-bridge expected format

### 3. GET /api/v0/docs/:project_id/snapshots/:version

Returns the snapshot (file contents) for a specific version.

**Response Format:**
```json
{
  "srcs": [
    ["file content here", "path/to/file.tex"],
    ["another file", "main.tex"]
  ],
  "atts": [
    ["https://example.com/blob/hash", "image.png"]
  ]
}
```

**Implementation Details:**
- Gets snapshot content from HistoryManager
- Uses overleaf-editor-core Snapshot class to parse
- Separates editable files (srcs) from binary files (atts)
- Provides blob URLs for binary files
- **Note:** Arrays of arrays format is required by git-bridge

### 4. POST /api/v0/docs/:project_id/snapshots

Receives push requests from git-bridge with file changes.

**Status:** ✅ Fully implemented

**Request Format:**
```json
{
  "latestVerId": 123,
  "files": [
    {
      "name": "path/to/file.tex",
      "url": "http://example.com/download/file"
    },
    {
      "name": "unchanged.tex"
    }
  ],
  "postbackUrl": "http://git-bridge/postback"
}
```

**Response (Immediate):**
- 202 Accepted: Push accepted and being processed
- 409 Conflict: Version is out of date (latestVerId doesn't match current version)
- 404 Not Found: Project not found

**Postback Data (Async):**
On success:
```json
{
  "code": "upToDate",
  "latestVerId": 124
}
```

On version conflict:
```json
{
  "code": "outOfDate",
  "message": "Out of Date"
}
```

On invalid files:
```json
{
  "code": "invalidFiles",
  "errors": [
    {
      "file": "invalid/../../file.tex",
      "state": "error"
    }
  ]
}
```

On unexpected error:
```json
{
  "code": "error",
  "message": "Unexpected Error"
}
```

**Implementation Details:**
- Validates latestVerId against current project version
- Downloads files from provided URLs
- Determines file type (doc vs binary) automatically
- Updates/creates files using EditorController
- Deletes files not present in new snapshot
- Sends postback notification with results
- Processes asynchronously after accepting request

## Security

All endpoints are protected with authorization middleware:
- Read endpoints: `AuthorizationMiddleware.ensureUserCanReadProject`
- Write endpoints: `AuthorizationMiddleware.ensureUserCanWriteProjectContent`

## Error Handling

- 202: Push accepted (POST endpoint)
- 404: Project not found or version not found
- 403: User does not have permission
- 409: Version conflict (POST endpoint)
- 500: Internal server error (logged with context)

## Testing

Testing can be done by:
1. Starting the web service
2. Using git-bridge to:
   - Clone a project (tests GET endpoints)
   - Make changes and push (tests POST endpoint)
3. Verifying the API endpoints return correct data
4. Checking logs for postback notifications

## Future Improvements

1. **Add unit tests**: Create comprehensive unit tests for all endpoints
2. **Add integration tests**: Test with actual git-bridge service
3. **Performance optimization**: Consider caching for frequently accessed snapshots
4. **Rate limiting**: Add specific rate limiters for git-bridge endpoints
5. **Metrics**: Add prometheus metrics for API usage
6. **Enhanced validation**: Add more sophisticated file name validation

## References

- Git Bridge source: `/services/git-bridge/`
- Test data: `/services/git-bridge/src/test/resources/.../state.json`
- Git Bridge API documentation in test files
