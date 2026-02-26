package uqa

import (
	"database/sql"
	"fmt"
	"strconv"

	"uqa-standalone/auth"
	"uqa-standalone/globals"

	"github.com/gin-gonic/gin"
)

func getDB(c *gin.Context) *sql.DB {
	v, _ := c.Get("db")
	if db, ok := v.(*sql.DB); ok {
		return db
	}
	return nil
}

func CreateAssessmentAPI(c *gin.Context) {
	var data CreateAssessmentRequest
	if err := c.ShouldBindJSON(&data); err != nil {
		c.JSON(400, gin.H{"status": false, "message": "invalid request"})
		return
	}

	user := auth.GetUserByCtx(c)
	if user == nil {
		c.JSON(401, gin.H{"status": false, "message": "unauthorized"})
		return
	}

	db := getDB(c)
	assessment, err := CreateAssessment(db, user.GetID(db), data)
	if err != nil {
		globals.Warn(fmt.Sprintf("create assessment error: %s", err.Error()))
		c.JSON(500, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": true, "data": assessment})
}

func GetAssessmentListAPI(c *gin.Context) {
	user := auth.GetUserByCtx(c)
	if user == nil {
		c.JSON(401, gin.H{"status": false, "message": "unauthorized"})
		return
	}

	db := getDB(c)
	list, err := GetAssessmentList(db, user.GetID(db))
	if err != nil {
		c.JSON(500, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": true, "data": list})
}

func GetAssessmentDetailAPI(c *gin.Context) {
	id, err := strconv.ParseInt(c.Param("id"), 10, 64)
	if err != nil {
		c.JSON(400, gin.H{"status": false, "message": "invalid id"})
		return
	}

	user := auth.GetUserByCtx(c)
	if user == nil {
		c.JSON(401, gin.H{"status": false, "message": "unauthorized"})
		return
	}

	db := getDB(c)
	assessment, err := GetAssessmentDetail(db, user.GetID(db), id)
	if err != nil {
		if err == sql.ErrNoRows {
			c.JSON(404, gin.H{"status": false, "message": "not found"})
			return
		}
		c.JSON(500, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(200, gin.H{"status": true, "data": assessment})
}
