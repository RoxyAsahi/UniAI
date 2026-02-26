package uqa

import "github.com/gin-gonic/gin"

func Register(app *gin.RouterGroup) {
	uqa := app.Group("/uqa")
	{
		uqa.POST("/assessments", SubmitHandler)
		uqa.GET("/assessments", ListHandler)
		uqa.GET("/assessments/:id", GetByIDHandler)
	}
}
