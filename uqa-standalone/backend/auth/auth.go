package auth

import (
	"database/sql"
	"errors"
	"time"

	"uqa-standalone/globals"

	"github.com/dgrijalva/jwt-go"
	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
)

// User represents an authenticated user.
type User struct {
	ID       int64  `json:"id"`
	Username string `json:"username"`
	Password string `json:"password"`
}

// GetID returns the user's ID, querying the DB if needed.
func (u *User) GetID(db *sql.DB) int64 {
	if u.ID > 0 {
		return u.ID
	}
	_ = globals.QueryRowDb(db, "SELECT id FROM auth WHERE username = ?", u.Username).Scan(&u.ID)
	return u.ID
}

// ParseToken validates a JWT and returns the User it encodes.
func ParseToken(c *gin.Context, token string) *User {
	instance, err := jwt.Parse(token, func(t *jwt.Token) (interface{}, error) {
		return []byte(viper.GetString("secret")), nil
	})
	if err != nil {
		return nil
	}
	claims, ok := instance.Claims.(jwt.MapClaims)
	if !ok || !instance.Valid {
		return nil
	}
	if int64(claims["exp"].(float64)) < time.Now().Unix() {
		return nil
	}
	return &User{
		Username: claims["username"].(string),
		Password: claims["password"].(string),
	}
}

// GetUserFromContext retrieves the *User stored by the auth middleware.
func GetUserFromContext(c *gin.Context) (*User, error) {
	raw, exists := c.Get("user")
	if !exists {
		return nil, errors.New("user not in context")
	}
	u, ok := raw.(*User)
	if !ok {
		return nil, errors.New("user type mismatch")
	}
	return u, nil
}

// GetUserByCtx is a convenience wrapper used by controllers.
func GetUserByCtx(c *gin.Context) *User {
	u, _ := GetUserFromContext(c)
	return u
}
