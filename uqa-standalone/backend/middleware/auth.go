package middleware

import (
	"net/http"
	"strings"

	"uqa-standalone/auth"

	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
)

// AuthMiddleware reads the Authorization header, validates the JWT,
// and stores the *auth.User in the gin context.
func AuthMiddleware() gin.HandlerFunc {
	return func(c *gin.Context) {
		k := strings.TrimSpace(c.GetHeader("Authorization"))
		if strings.HasPrefix(k, "Bearer ") {
			k = strings.TrimPrefix(k, "Bearer ")
		}

		if k == "" {
			c.Set("user", nil)
			c.Next()
			return
		}

		user := auth.ParseToken(c, k)
		if user == nil {
			c.AbortWithStatusJSON(http.StatusUnauthorized, gin.H{
				"status":  false,
				"message": "invalid or expired token",
			})
			return
		}

		c.Set("user", user)

		// Respect serve_static prefix stripping (same as parent project)
		if viper.GetBool("serve_static") {
			path := c.Request.URL.Path
			if strings.HasPrefix(path, "/api") {
				c.Request.URL.Path = strings.TrimPrefix(path, "/api")
			}
		}

		c.Next()
	}
}
