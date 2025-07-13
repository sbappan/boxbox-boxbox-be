# Security Documentation

This document outlines the security measures implemented in BoxBox to protect against common web vulnerabilities.

## CSRF Protection

BoxBox has comprehensive CSRF (Cross-Site Request Forgery) protection through multiple layers:

### Better Auth Built-in Protection

- **Origin Header Validation**: Better Auth automatically validates the Origin header on all requests
- **Automatic CSRF Token Management**: Better Auth handles CSRF tokens internally without requiring manual implementation
- **Session-based Authentication**: All authentication tokens are stored server-side in the database

### Cookie Security

- **SameSite Protection**: Cookies are configured with `sameSite: "lax"` to prevent cross-site requests
- **HttpOnly Cookies**: Authentication cookies are not accessible via client-side JavaScript
- **Secure Cookies**: Automatically enabled in production (HTTPS environments)
- **Encrypted Cookies**: All authentication cookies are encrypted by Better Auth

### Origin Validation

```typescript
// Environment-aware trusted origins
trustedOrigins: getTrustedOrigins()
```

- **Development**: `http://localhost:5173` (frontend) and `http://localhost:3000` (backend)
- **Production**: Configurable via `FRONTEND_URL` and `TRUSTED_ORIGINS` environment variables

### Additional CSRF Protections

1. **PKCE for OAuth**: Proof Key for Code Exchange prevents authorization code interception
2. **State Parameter**: OAuth flows include state parameter stored in database to prevent CSRF
3. **Session Validation**: Every protected endpoint validates session via `auth.api.getSession()`

## Security Headers

### Production Security Headers

- **Content Security Policy (CSP)**: Prevents XSS attacks by controlling resource loading
- **HSTS**: Enforces HTTPS connections with `max-age=31536000; includeSubDomains`
- **X-Frame-Options**: Set to `DENY` to prevent clickjacking
- **X-Content-Type-Options**: Prevents MIME type sniffing
- **X-XSS-Protection**: Enables browser XSS filtering
- **Referrer Policy**: Set to `strict-origin-when-cross-origin`

### HTTPS Enforcement

Production deployments automatically redirect HTTP requests to HTTPS:

```typescript
if (proto !== "https") {
  return c.redirect(httpsUrl, 301);
}
```

## Authentication Security

### Session Management

- **Database Storage**: Sessions stored in PostgreSQL, not client-side
- **Session Expiration**: Configurable session timeouts
- **Secure Session Cookies**: HttpOnly, Secure, and SameSite protected

### OAuth Security

- **Multiple Providers**: Google, Twitter/X, GitHub
- **Secure Redirect URIs**: Validated against configured domains
- **Environment-aware URLs**: Dynamic configuration based on deployment environment

## Environment Configuration

### Required Security Environment Variables

```bash
# Core authentication
BETTER_AUTH_SECRET=your-secret-key
BETTER_AUTH_URL=https://your-domain.com
FRONTEND_URL=https://your-frontend.com

# Additional trusted origins (comma-separated)
TRUSTED_ORIGINS=https://api.your-domain.com,https://admin.your-domain.com

# OAuth providers (optional)
GOOGLE_CLIENT_ID=your-google-client-id
GOOGLE_CLIENT_SECRET=your-google-client-secret
```

### Security Best Practices

1. **Environment Separation**: Different configurations for development/production
2. **Secret Management**: Use environment variables for all sensitive data
3. **HTTPS in Production**: Automatic HTTPS enforcement and security headers
4. **Origin Validation**: Strict origin checking for all requests
5. **Database Security**: Encrypted connection strings and proper access controls

## Compliance

This security implementation aligns with:

- **OWASP Top 10**: Protection against common web vulnerabilities
- **Modern Web Standards**: Latest security practices for web applications
- **OAuth 2.0 Security**: Proper implementation of OAuth flows with PKCE

## Security Monitoring

### Audit Logging

Account deletion events are logged for audit purposes:

```typescript
console.log(`Account deleted: userId=${userId}, deletedAt=${new Date().toISOString()}`);
```

### Error Handling

- Sensitive information is not exposed in error messages
- Authentication errors are properly logged for monitoring
- Failed requests are tracked for security analysis

## Conclusion

BoxBox implements enterprise-grade security measures that exceed the protection offered by manual CSRF tokens. The combination of Better Auth's built-in protections, modern security headers, and environment-aware configuration provides robust defense against common web vulnerabilities.

**No additional CSRF tokens are needed** - the current implementation provides comprehensive protection through modern security standards.