package uqa

import (
	"uqa-standalone/middleware"

	"github.com/gin-gonic/gin"
)

func Register(router *gin.RouterGroup) {
	group := router.Group("/uqa")
	group.Use(middleware.AuthMiddleware())
	{
		group.POST("/assessments", CreateAssessmentAPI)
		group.GET("/assessments", GetAssessmentListAPI)
		group.GET("/assessments/:id", GetAssessmentDetailAPI)
	}
}
