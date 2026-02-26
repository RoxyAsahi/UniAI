package uqa

import (
	"chat/auth"
	"chat/utils"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

// SubmitHandler handles POST /api/uqa/assessments
func SubmitHandler(c *gin.Context) {
	var req SubmitRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid request body"})
		return
	}
	if len(req.Report.ScoresByCategory) == 0 {
		c.JSON(http.StatusBadRequest, gin.H{"error": "report.scoresByCategory is required"})
		return
	}

	db := utils.GetDBFromContext(c)
	username := utils.GetUserFromContext(c)
	user := auth.GetUserByName(db, username)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID := user.GetID(db)

	id, err := SaveAssessment(db, userID, req)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusCreated, gin.H{"id": id})
}

// ListHandler handles GET /api/uqa/assessments
func ListHandler(c *gin.Context) {
	db := utils.GetDBFromContext(c)
	username := utils.GetUserFromContext(c)
	user := auth.GetUserByName(db, username)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID := user.GetID(db)

	items, err := ListAssessments(db, userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	c.JSON(http.StatusOK, items)
}

// GetByIDHandler handles GET /api/uqa/assessments/:id
func GetByIDHandler(c *gin.Context) {
	idStr := c.Param("id")
	id, err := strconv.ParseInt(idStr, 10, 64)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "invalid id"})
		return
	}

	db := utils.GetDBFromContext(c)
	username := utils.GetUserFromContext(c)
	user := auth.GetUserByName(db, username)
	if user == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "unauthorized"})
		return
	}
	userID := user.GetID(db)

	a, err := GetAssessment(db, userID, id)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}
	if a == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "not found"})
		return
	}

	c.JSON(http.StatusOK, a)
}
