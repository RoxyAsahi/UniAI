package conversation

import (
	"chat/auth"
	"chat/utils"
	"net/http"
	"strconv"
	"strings"
	"time"

	"github.com/gin-gonic/gin"
)

type CreateFolderForm struct {
	Name       string  `json:"name" binding:"required"`
	Color      *string `json:"color"`
	Avatar     *string `json:"avatar"`
	Background *string `json:"background"`
	ParentId   *int    `json:"parent_id"`
}

type UpdateFolderForm struct {
	Id         int     `json:"id" binding:"required"`
	Name       string  `json:"name" binding:"required"`
	Color      *string `json:"color"`
	Avatar     *string `json:"avatar"`
	Background *string `json:"background"`
}

type ReorderForm struct {
	Orders map[int]int `json:"orders" binding:"required"`
}

type ReorderConversationsForm struct {
	Orders map[int64]int `json:"orders" binding:"required"`
}

type MoveForm struct {
	ConversationId int64 `json:"conversation_id" binding:"required"`
	FolderId       *int  `json:"folder_id"`
}

func normalizeOptionalString(value *string) *string {
	if value == nil {
		return nil
	}
	trimmed := strings.TrimSpace(*value)
	trimmed = strings.ReplaceAll(trimmed, "\u0000", "")
	trimmed = strings.ReplaceAll(trimmed, "\r", "")
	trimmed = strings.ReplaceAll(trimmed, "\n", "")
	trimmed = utils.Extract(trimmed, 255, "")
	if trimmed == "" {
		return nil
	}
	return &trimmed
}

func ListFoldersAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	uid := int(user.GetID(db))
	folders := ListFolders(db, uid)
	c.JSON(http.StatusOK, gin.H{"status": true, "data": folders})
}

func CreateFolderAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	var form CreateFolderForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid form"})
		return
	}

	uid := int(user.GetID(db))

	// Enforce two-level limit
	if form.ParentId != nil {
		parents := ListFolders(db, uid)
		for _, p := range parents {
			if p.Id == *form.ParentId && p.ParentId != nil {
				c.JSON(http.StatusOK, gin.H{"status": false, "message": "only two levels allowed"})
				return
			}
		}
	}

	id, err := CreateFolder(
		db,
		uid,
		form.Name,
		normalizeOptionalString(form.Color),
		normalizeOptionalString(form.Avatar),
		normalizeOptionalString(form.Background),
		form.ParentId,
	)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": err.Error()})
		return
	}

	// Return the full Folder object so the frontend can add it to the store directly
	folders := ListFolders(db, uid)
	var created *Folder
	for i := range folders {
		if folders[i].Id == int(id) {
			created = &folders[i]
			break
		}
	}
	if created == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "folder not found after creation"})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": true, "data": created})
}

func UpdateFolderAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	var form UpdateFolderForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid form"})
		return
	}

	uid := int(user.GetID(db))
	if err := UpdateFolder(
		db,
		uid,
		form.Id,
		form.Name,
		normalizeOptionalString(form.Color),
		normalizeOptionalString(form.Avatar),
		normalizeOptionalString(form.Background),
	); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": true})
}

func DeleteFolderAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	id, err := strconv.Atoi(c.Query("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid id"})
		return
	}

	uid := int(user.GetID(db))
	if err := DeleteFolder(db, uid, id); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": true})
}

func ExportFolderAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	id, err := strconv.Atoi(c.Query("id"))
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid id"})
		return
	}

	uid := int(user.GetID(db))
	folder, conversations, err := ExportFolderConversations(db, uid, id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status": true,
		"data": gin.H{
			"folder":        folder,
			"conversations": conversations,
			"exported_at":   time.Now().Format(time.RFC3339),
		},
	})
}

func ReorderFoldersAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	var form ReorderForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid form"})
		return
	}

	uid := int(user.GetID(db))
	if err := ReorderFolders(db, uid, form.Orders); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": true})
}

func ReorderConversationsAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	var form ReorderConversationsForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid form"})
		return
	}

	uid := user.GetID(db)
	if err := ReorderConversations(db, uid, form.Orders); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": true})
}

func MoveConversationAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "user not found"})
		return
	}

	db := utils.GetDBFromContext(c)
	var form MoveForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": "invalid form"})
		return
	}

	userId := user.GetID(db)
	if err := MoveConversation(db, userId, form.ConversationId, form.FolderId); err != nil {
		c.JSON(http.StatusOK, gin.H{"status": false, "message": err.Error()})
		return
	}

	c.JSON(http.StatusOK, gin.H{"status": true})
}
