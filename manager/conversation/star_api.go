package conversation

import (
	"chat/auth"
	"chat/utils"
	"net/http"
	"strconv"

	"github.com/gin-gonic/gin"
)

type StarForm struct {
	ConversationId int64 `json:"conversation_id" binding:"required"`
	MessageIndex   int   `json:"message_index"`
}

func StarAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	var form StarForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid form"})
		return
	}

	if err := StarMessage(db, user.GetID(db), form.ConversationId, form.MessageIndex); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": true, "message": ""})
}

func UnstarAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	var form StarForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid form"})
		return
	}

	if err := UnstarMessage(db, user.GetID(db), form.ConversationId, form.MessageIndex); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": true, "message": ""})
}

func GetStarredAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	id, err := strconv.ParseInt(c.Query("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid id"})
		return
	}

	starred := GetStarredMessages(db, user.GetID(db), id)
	c.JSON(http.StatusOK, gin.H{"status": true, "message": "", "data": starred})
}
