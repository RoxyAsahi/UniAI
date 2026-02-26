package main

import (
	"database/sql"
	"fmt"

	"uqa-standalone/db"
	"uqa-standalone/globals"
	"uqa-standalone/middleware"
	"uqa-standalone/uqa"

	"github.com/gin-gonic/gin"
	"github.com/spf13/viper"
)

func dbMiddleware(database *sql.DB) gin.HandlerFunc {
	return func(c *gin.Context) {
		c.Set("db", database)
		c.Next()
	}
}

func readConfig() {
	viper.SetConfigName("config")
	viper.SetConfigType("yaml")
	viper.AddConfigPath(".")
	viper.AutomaticEnv()

	if err := viper.ReadInConfig(); err != nil {
		globals.Warn("config file not found, using defaults/env vars")
	}

	// Defaults
	viper.SetDefault("server.port", "8080")
	viper.SetDefault("db.driver", "sqlite")
	viper.SetDefault("db.sqlite_path", "uqa.db")
}

func main() {
	readConfig()

	database := db.Init()
	defer database.Close()

	if err := uqa.InitTable(database); err != nil {
		panic(fmt.Sprintf("failed to init uqa table: %v", err))
	}

	r := gin.Default()
	r.Use(middleware.CORSMiddleware())
	r.Use(dbMiddleware(database))

	api := r.Group("/api")
	uqa.Register(api)

	port := viper.GetString("server.port")
	globals.Info("UQA standalone server starting on :" + port)
	if err := r.Run(":" + port); err != nil {
		panic(err)
	}
}
