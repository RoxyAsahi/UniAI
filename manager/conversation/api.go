package conversation

import (
	"chat/auth"
	"chat/globals"
	"chat/utils"
	"fmt"
	"github.com/gin-gonic/gin"
	"net/http"
	"path"
	"strconv"
	"strings"
	"time"
)

type ShareForm struct {
	Id   int64 `json:"id"`
	Refs []int `json:"refs"`
}

type RenameConversationForm struct {
	Id   int64  `json:"id"`
	Name string `json:"name"`
}

type ConversationIDForm struct {
	Id int64 `json:"id" binding:"required"`
}

type PinConversationForm struct {
	Id     int64 `json:"id" binding:"required"`
	Pinned bool  `json:"pinned"`
}

type ArchiveConversationForm struct {
	Id       int64 `json:"id" binding:"required"`
	Archived bool  `json:"archived"`
}

type DeleteMaskForm struct {
	Id int `json:"id" binding:"required"`
}

type LoadMaskResponse struct {
	Status bool   `json:"status"`
	Data   []Mask `json:"data"`
	Error  string `json:"error"`
}

type CommonMaskResponse struct {
	Status bool   `json:"status"`
	Error  string `json:"error"`
}

type UploadMaskAvatarResponse struct {
	Status bool   `json:"status"`
	Url    string `json:"url,omitempty"`
	Error  string `json:"error,omitempty"`
}

func ListAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	offset, err := strconv.Atoi(c.DefaultQuery("offset", "0"))
	if err != nil || offset < 0 {
		offset = 0
	}
	limit, err := strconv.Atoi(c.DefaultQuery("limit", "100"))
	if err != nil || limit <= 0 {
		limit = 100
	}
	conversations, hasMore := LoadConversationList(db, user.GetID(db), offset, limit)
	c.JSON(http.StatusOK, gin.H{
		"status":   true,
		"message":  "",
		"data":     conversations,
		"offset":   offset,
		"limit":    limit,
		"has_more": hasMore,
	})
}

func LoadAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	id, err := strconv.ParseInt(c.Query("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "invalid id",
		})
		return
	}
	conversation := LoadConversation(db, user.GetID(db), id)
	if conversation == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "conversation not found",
		})
		return
	}
	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
		"data":    conversation,
	})
}

func DeleteAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	id, err := strconv.ParseInt(c.Query("id"), 10, 64)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "invalid id",
		})
		return
	}
	conversation := LoadConversation(db, user.GetID(db), id)
	if conversation == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "conversation not found",
		})
		return
	}
	conversation.DeleteConversation(db)
	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
	})
}

func RenameAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	var form RenameConversationForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "invalid form",
		})
		return
	}

	conversation := LoadConversation(db, user.GetID(db), form.Id)
	if conversation == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "conversation not found",
		})
		return
	}
	conversation.RenameConversation(db, form.Name)
	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
	})
}

func CloneAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	var form ConversationIDForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "invalid form",
		})
		return
	}

	userID := user.GetID(db)
	if instance := LoadConversation(db, userID, form.Id); instance == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "conversation not found",
		})
		return
	}

	newID, err := CloneConversation(db, userID, form.Id)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
		"data": gin.H{
			"id": newID,
		},
	})
}

func PinAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	var form PinConversationForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "invalid form",
		})
		return
	}

	userID := user.GetID(db)
	if instance := LoadConversation(db, userID, form.Id); instance == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "conversation not found",
		})
		return
	}

	if err := SetConversationPinned(db, userID, form.Id, form.Pinned); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
	})
}

func ArchiveAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	var form ArchiveConversationForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "invalid form",
		})
		return
	}

	userID := user.GetID(db)
	if instance := LoadConversation(db, userID, form.Id); instance == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "conversation not found",
		})
		return
	}

	if err := SetConversationArchived(db, userID, form.Id, form.Archived); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
	})
}

func CleanAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	if err := DeleteAllConversations(db, *user); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
	})
}

func ShareAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	var form ShareForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "invalid form",
		})
		return
	}

	if hash, err := ShareConversation(db, user, form.Id, form.Refs); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": err.Error(),
		})
		return
	} else {
		c.JSON(http.StatusOK, gin.H{
			"status":  true,
			"message": "",
			"data":    hash,
		})
	}
}

func ViewAPI(c *gin.Context) {
	db := utils.GetDBFromContext(c)
	hash := strings.TrimSpace(c.Query("hash"))
	if hash == "" {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "invalid hash",
		})
		return
	}

	shared, err := GetSharedConversation(db, hash)
	if err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
		"data":    shared,
	})
}

func ListSharingAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	data := ListSharedConversation(db, user)
	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
		"data":    data,
	})
}

func DeleteSharingAPI(c *gin.Context) {
	user := auth.GetUser(c)
	if user == nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "user not found",
		})
		return
	}

	db := utils.GetDBFromContext(c)
	hash := strings.TrimSpace(c.Query("hash"))
	if hash == "" {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": "invalid hash",
		})
		return
	}

	if err := DeleteSharedConversation(db, user, hash); err != nil {
		c.JSON(http.StatusOK, gin.H{
			"status":  false,
			"message": err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, gin.H{
		"status":  true,
		"message": "",
	})
}

func LoadMaskAPI(c *gin.Context) {
	db := utils.GetDBFromContext(c)
	username := utils.GetUserFromContext(c)

	if username == "" {
		c.JSON(http.StatusOK, LoadMaskResponse{
			Status: false,
			Error:  "authentication_error",
		})
		return
	}

	user := &auth.User{
		Username: username,
	}

	masks, err := LoadMask(db, user)
	if err != nil {
		c.JSON(http.StatusOK, LoadMaskResponse{
			Status: false,
			Error:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, LoadMaskResponse{
		Status: true,
		Data:   masks,
	})
}

func DeleteMaskAPI(c *gin.Context) {
	db := utils.GetDBFromContext(c)
	username := utils.GetUserFromContext(c)

	if username == "" {
		c.JSON(http.StatusOK, CommonMaskResponse{
			Status: false,
			Error:  "authentication_error",
		})
		return
	}

	user := &auth.User{
		Username: username,
	}

	var form DeleteMaskForm
	if err := c.ShouldBindJSON(&form); err != nil {
		c.JSON(http.StatusOK, CommonMaskResponse{
			Status: false,
			Error:  "invalid_request_error",
		})
		return
	}

	mask := Mask{
		Id: form.Id,
	}

	err := mask.Delete(db, user)
	if err != nil {
		c.JSON(http.StatusOK, CommonMaskResponse{
			Status: false,
			Error:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, CommonMaskResponse{
		Status: true,
	})
}

func SaveMaskAPI(c *gin.Context) {
	db := utils.GetDBFromContext(c)
	username := utils.GetUserFromContext(c)

	if username == "" {
		c.JSON(http.StatusOK, CommonMaskResponse{
			Status: false,
			Error:  "authentication_error",
		})
		return
	}

	user := &auth.User{
		Username: username,
	}

	var mask Mask
	if err := c.ShouldBindJSON(&mask); err != nil {
		c.JSON(http.StatusOK, CommonMaskResponse{
			Status: false,
			Error:  "invalid_request_error",
		})
		return
	}

	err := mask.Save(db, user)
	if err != nil {
		c.JSON(http.StatusOK, CommonMaskResponse{
			Status: false,
			Error:  err.Error(),
		})
		return
	}

	c.JSON(http.StatusOK, CommonMaskResponse{
		Status: true,
	})
}

func UploadMaskAvatarAPI(c *gin.Context) {
	username := utils.GetUserFromContext(c)
	if username == "" {
		c.JSON(http.StatusOK, UploadMaskAvatarResponse{
			Status: false,
			Error:  "authentication_error",
		})
		return
	}

	file, err := c.FormFile("file")
	if err != nil {
		c.JSON(http.StatusOK, UploadMaskAvatarResponse{
			Status: false,
			Error:  "invalid_request_error",
		})
		return
	}

	if file.Size <= 0 {
		c.JSON(http.StatusOK, UploadMaskAvatarResponse{
			Status: false,
			Error:  "file_is_empty",
		})
		return
	}

	const maxSize int64 = 2 * 1024 * 1024 // 2MB
	if file.Size > maxSize {
		c.JSON(http.StatusOK, UploadMaskAvatarResponse{
			Status: false,
			Error:  "file_too_large",
		})
		return
	}

	ext := strings.ToLower(path.Ext(file.Filename))
	allowed := map[string]bool{
		".png":  true,
		".jpg":  true,
		".jpeg": true,
		".webp": true,
		".gif":  true,
	}
	if !allowed[ext] {
		c.JSON(http.StatusOK, UploadMaskAvatarResponse{
			Status: false,
			Error:  "unsupported_image_type",
		})
		return
	}

	if !utils.CreateFolder("storage/attachments") {
		c.JSON(http.StatusOK, UploadMaskAvatarResponse{
			Status: false,
			Error:  "failed_to_create_storage",
		})
		return
	}

	hash := utils.Md5Encrypt(fmt.Sprintf("%s:%s:%d:%d", username, file.Filename, file.Size, time.Now().UnixNano()))
	filename := hash + ext
	dst := fmt.Sprintf("storage/attachments/%s", filename)

	if err := c.SaveUploadedFile(file, dst); err != nil {
		c.JSON(http.StatusOK, UploadMaskAvatarResponse{
			Status: false,
			Error:  "failed_to_save_image",
		})
		return
	}

	base := strings.TrimSuffix(globals.NotifyUrl, "/")
	url := fmt.Sprintf("/attachments/%s", filename)
	if base != "" {
		url = fmt.Sprintf("%s%s", base, url)
	}

	c.JSON(http.StatusOK, UploadMaskAvatarResponse{
		Status: true,
		Url:    url,
	})
}
