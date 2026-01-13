# OAuth2 Server API 使用指南

这个模块为 Overleaf 提供了 OAuth2 服务器功能，包括个人访问令牌管理和令牌验证 API。

## 功能特性

根据你的需求，我已经实现了以下核心 API：

1. **获取令牌信息** - 获取 OAuth 令牌的详细信息
2. **验证令牌** - 验证令牌是否合法有效
3. **检查令牌合法性** - 检查令牌格式和过期状态

## API 端点说明

### 1. 健康检查
```
GET /ayaka/oauth2-server
```
返回服务状态，无需认证。

**响应示例:**
```json
{
  "message": "Dev by ayaka-notes"
}
```

### 2. 检查 OAuth 令牌是否合法 (Check Token Validity)
```
GET /oauth/token/info
```
**请求头:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**功能:** 验证令牌是否有效，包括检查令牌是否存在、是否过期。

**成功响应 (200):**
```json
{
  "valid": true,
  "token": {
    "type": "personal",
    "scope": "*",
    "user_id": "507f1f77bcf86cd799439011",
    "createdAt": "2024-01-01T00:00:00.000Z",
    "expiresAt": null,
    "lastUsedAt": "2024-01-13T00:00:00.000Z"
  }
}
```

**失败响应 (401):**
```json
{
  "valid": false,
  "reason": "Token not found"
}
```
或
```json
{
  "valid": false,
  "reason": "Token expired"
}
```

### 3. 获取令牌详细信息 (Get Token Details)
```
GET /oauth/token/details
```
**请求头:**
```
Authorization: Bearer YOUR_TOKEN_HERE
```

**功能:** 获取令牌的完整信息，包括关联的 OAuth 应用等。

**成功响应 (200):**
```json
{
  "type": "personal",
  "scope": "*",
  "user_id": "507f1f77bcf86cd799439011",
  "oauthApplication_id": null,
  "createdAt": "2024-01-01T00:00:00.000Z",
  "expiresAt": null,
  "accessTokenExpiresAt": null,
  "lastUsedAt": "2024-01-13T00:00:00.000Z"
}
```

**失败响应 (404):**
```json
{
  "error": "Token not found"
}
```

### 4. 验证令牌格式和状态 (Validate Token)
```
POST /oauth/token/validate
Content-Type: application/json
```

**请求体:**
```json
{
  "token": "olpat_1234567890abcdef..."
}
```

**功能:** 验证任意令牌的格式、存在性和有效性，无需在请求头中携带令牌。

**成功响应 (200):**
```json
{
  "valid": true,
  "reason": null,
  "token": {
    "type": "personal",
    "scope": "*",
    "user_id": "507f1f77bcf86cd799439011"
  }
}
```

**失败响应 (200):**
```json
{
  "valid": false,
  "reason": "Token expired",
  "token": null
}
```

## 个人访问令牌管理 API

### 5. 获取用户的所有个人访问令牌
```
GET /oauth/personal-access-tokens
Cookie: overleaf.sid=YOUR_SESSION_COOKIE
```

**功能:** 获取当前登录用户的所有个人访问令牌列表。

**响应 (200):**
```json
{
  "tokens": [
    {
      "_id": "507f1f77bcf86cd799439011",
      "accessTokenPartial": "abcdef12",
      "createdAt": "2024-01-01T00:00:00.000Z",
      "lastUsedAt": "2024-01-13T00:00:00.000Z",
      "scope": "*"
    }
  ]
}
```

### 6. 创建新的个人访问令牌
```
POST /oauth/personal-access-tokens
Cookie: overleaf.sid=YOUR_SESSION_COOKIE
```

**功能:** 为当前登录用户创建一个新的个人访问令牌。

**响应 (200):**
```json
{
  "token": "olpat_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef",
  "message": "Personal access token created successfully. Please save this token as it will not be shown again."
}
```

**重要:** 令牌只会在创建时返回一次，请务必保存！

### 7. 删除个人访问令牌
```
DELETE /oauth/personal-access-tokens/:token_id
Cookie: overleaf.sid=YOUR_SESSION_COOKIE
```

**功能:** 删除指定的个人访问令牌。

**响应 (200):**
```json
{
  "message": "Token deleted successfully"
}
```

**失败响应 (404):**
```json
{
  "error": "Token not found or already deleted"
}
```

## 使用示例

### 示例 1: 验证一个令牌是否合法

```bash
#!/bin/bash

TOKEN="olpat_your_token_here"

# 检查令牌是否有效
curl -X GET \
  -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:3000/oauth/token/info
```

### 示例 2: 获取令牌详细信息

```bash
#!/bin/bash

TOKEN="olpat_your_token_here"

# 获取令牌详细信息
curl -X GET \
  -H "Authorization: Bearer ${TOKEN}" \
  http://localhost:3000/oauth/token/details
```

### 示例 3: 验证任意令牌

```bash
#!/bin/bash

# 验证一个令牌（无需在请求头中携带）
curl -X POST \
  -H "Content-Type: application/json" \
  -d '{"token":"olpat_your_token_here"}' \
  http://localhost:3000/oauth/token/validate
```

### 示例 4: 创建个人访问令牌

```bash
#!/bin/bash

SESSION_COOKIE="your_session_cookie"

# 创建新的个人访问令牌
curl -X POST \
  -H "Cookie: overleaf.sid=${SESSION_COOKIE}" \
  http://localhost:3000/oauth/personal-access-tokens
```

### 示例 5: 获取所有个人访问令牌

```bash
#!/bin/bash

SESSION_COOKIE="your_session_cookie"

# 获取所有令牌
curl -X GET \
  -H "Cookie: overleaf.sid=${SESSION_COOKIE}" \
  http://localhost:3000/oauth/personal-access-tokens
```

### 示例 6: 删除个人访问令牌

```bash
#!/bin/bash

SESSION_COOKIE="your_session_cookie"
TOKEN_ID="507f1f77bcf86cd799439011"

# 删除令牌
curl -X DELETE \
  -H "Cookie: overleaf.sid=${SESSION_COOKIE}" \
  http://localhost:3000/oauth/personal-access-tokens/${TOKEN_ID}
```

## Python 示例

```python
import requests

class OAuth2Client:
    def __init__(self, base_url="http://localhost:3000"):
        self.base_url = base_url
        self.session = requests.Session()
    
    def check_token_validity(self, token):
        """检查令牌是否合法"""
        response = self.session.get(
            f"{self.base_url}/oauth/token/info",
            headers={"Authorization": f"Bearer {token}"}
        )
        return response.json()
    
    def get_token_details(self, token):
        """获取令牌详细信息"""
        response = self.session.get(
            f"{self.base_url}/oauth/token/details",
            headers={"Authorization": f"Bearer {token}"}
        )
        return response.json()
    
    def validate_token(self, token):
        """验证令牌"""
        response = self.session.post(
            f"{self.base_url}/oauth/token/validate",
            json={"token": token}
        )
        return response.json()
    
    def create_personal_token(self, session_cookie):
        """创建个人访问令牌"""
        self.session.cookies.set("overleaf.sid", session_cookie)
        response = self.session.post(
            f"{self.base_url}/oauth/personal-access-tokens"
        )
        return response.json()
    
    def list_personal_tokens(self, session_cookie):
        """列出所有个人访问令牌"""
        self.session.cookies.set("overleaf.sid", session_cookie)
        response = self.session.get(
            f"{self.base_url}/oauth/personal-access-tokens"
        )
        return response.json()
    
    def delete_personal_token(self, session_cookie, token_id):
        """删除个人访问令牌"""
        self.session.cookies.set("overleaf.sid", session_cookie)
        response = self.session.delete(
            f"{self.base_url}/oauth/personal-access-tokens/{token_id}"
        )
        return response.json()

# 使用示例
if __name__ == "__main__":
    client = OAuth2Client()
    
    # 检查令牌是否合法
    result = client.check_token_validity("olpat_your_token_here")
    print(f"Token valid: {result.get('valid')}")
    
    # 验证令牌
    validation = client.validate_token("olpat_your_token_here")
    print(f"Validation result: {validation}")
```

## 令牌格式

个人访问令牌格式：`olpat_` + 64位十六进制字符串

示例：`olpat_1234567890abcdef1234567890abcdef1234567890abcdef1234567890abcdef`

## 安全说明

1. **令牌存储**: 令牌在数据库中以 SHA-512 哈希形式存储
2. **令牌显示**: 为了安全，列表中只显示令牌的最后 8 个字符
3. **令牌使用**: 每次使用令牌时，系统会更新 `lastUsedAt` 时间戳
4. **令牌权限**: 个人访问令牌默认具有全部权限 (scope: "*")

## 错误代码

- `400` - 请求格式错误
- `401` - 未认证或令牌无效
- `404` - 令牌未找到
- `500` - 服务器内部错误

## 总结

你现在拥有完整的 OAuth 令牌管理功能：

✅ **获取令牌信息** - 使用 `GET /oauth/token/details`  
✅ **验证令牌合法性** - 使用 `GET /oauth/token/info` 或 `POST /oauth/token/validate`  
✅ **检查令牌有效性** - 所有验证 API 都会检查令牌是否过期  
✅ **个人令牌管理** - 创建、列出、删除个人访问令牌

这些 API 提供了你需要的所有功能来管理和验证 OAuth 令牌！
