package conversation

import (
	"chat/auth"
	"chat/globals"
	"chat/utils"
	"database/sql"
	"fmt"
)

func (c *Conversation) SaveConversation(db *sql.DB) bool {
	if c.UserID == -1 {
		// anonymous request
		return true
	}

	data := utils.ToJson(c.GetMessage())
	query := `
		INSERT INTO conversation (user_id, conversation_id, conversation_name, data, model, task_id) VALUES (?, ?, ?, ?, ?, ?)
		ON DUPLICATE KEY UPDATE conversation_name = VALUES(conversation_name), data = VALUES(data), model = VALUES(model), task_id = VALUES(task_id), updated_at = CURRENT_TIMESTAMP
	`

	stmt, err := globals.PrepareDb(db, query)
	if err != nil {
		return false
	}
	defer func(stmt *sql.Stmt) {
		err := stmt.Close()
		if err != nil {
			globals.Warn(err)
		}
	}(stmt)

	var taskID sql.NullString
	if c.TaskID != "" {
		taskID = sql.NullString{String: c.TaskID, Valid: true}
	}

	_, err = stmt.Exec(c.UserID, c.Id, c.Name, data, c.Model, taskID)
	if err != nil {
		globals.Info(fmt.Sprintf("execute error during save conversation: %s", err.Error()))
		return false
	}
	return true
}
func GetConversationLengthByUserID(db *sql.DB, userId int64) int64 {
	var length int64
	err := globals.QueryRowDb(db, "SELECT MAX(conversation_id) FROM conversation WHERE user_id = ?", userId).Scan(&length)
	if err != nil || length < 0 {
		return 0
	}
	return length
}

func LoadConversation(db *sql.DB, userId int64, conversationId int64) *Conversation {
	conversation := Conversation{
		UserID: userId,
		Id:     conversationId,
	}

	var (
		data     string
		model    interface{}
		taskID   sql.NullString
		folder   sql.NullInt64
		pinned   sql.NullBool
		archived sql.NullBool
	)
	err := globals.QueryRowDb(db, `
		SELECT conversation_name, model, data, task_id, folder_id, pinned, archived, updated_at FROM conversation
		WHERE user_id = ? AND conversation_id = ?
		`, userId, conversationId).Scan(&conversation.Name, &model, &data, &taskID, &folder, &pinned, &archived, &conversation.UpdatedAt)
	if value, ok := model.([]byte); ok {
		conversation.Model = string(value)
	} else {
		conversation.Model = globals.GPT3Turbo
	}

	if taskID.Valid {
		conversation.TaskID = taskID.String
	}
	if folder.Valid {
		conversation.FolderId = &folder.Int64
	}
	if pinned.Valid {
		conversation.Pinned = pinned.Bool
	}
	if archived.Valid {
		conversation.Archived = archived.Bool
	}

	if err != nil {
		return nil
	}

	conversation.Message, err = utils.Unmarshal[[]globals.Message]([]byte(data))
	if err != nil {
		return nil
	}

	return &conversation
}

func LoadConversationList(db *sql.DB, userId int64, offset int, limit int) ([]Conversation, bool) {
	if offset < 0 {
		offset = 0
	}
	if limit <= 0 {
		limit = 100
	}
	if limit > 200 {
		limit = 200
	}

	conversationList := make([]Conversation, 0, limit+1)
	rows, err := globals.QueryDb(db, `
			SELECT conversation_id, conversation_name, folder_id, updated_at, pinned, archived
			FROM conversation
			WHERE user_id = ?
			ORDER BY archived ASC, pinned DESC, folder_order ASC, updated_at DESC, conversation_id DESC
			LIMIT ? OFFSET ?
	`, userId, limit+1, offset)
	if err != nil {
		return conversationList, false
	}
	defer func(rows *sql.Rows) {
		err := rows.Close()
		if err != nil {
			return
		}
	}(rows)

	for rows.Next() {
		var conversation Conversation
		var folderId sql.NullInt64
		err := rows.Scan(&conversation.Id, &conversation.Name, &folderId, &conversation.UpdatedAt, &conversation.Pinned, &conversation.Archived)
		if err != nil {
			continue
		}
		if folderId.Valid {
			conversation.FolderId = &folderId.Int64
		}
		conversationList = append(conversationList, conversation)
	}

	hasMore := len(conversationList) > limit
	if hasMore {
		conversationList = conversationList[:limit]
	}

	return conversationList, hasMore
}

func (c *Conversation) DeleteConversation(db *sql.DB) bool {
	_, err := globals.ExecDb(db, "DELETE FROM conversation WHERE user_id = ? AND conversation_id = ?", c.UserID, c.Id)
	if err != nil {
		return false
	}
	return true
}

func (c *Conversation) RenameConversation(db *sql.DB, name string) bool {
	_, err := globals.ExecDb(db, "UPDATE conversation SET conversation_name = ?, updated_at = CURRENT_TIMESTAMP WHERE user_id = ? AND conversation_id = ?", name, c.UserID, c.Id)
	if err != nil {
		return false
	}
	return true
}

func CloneConversation(db *sql.DB, userId int64, conversationId int64) (int64, error) {
	var (
		name     string
		data     string
		model    sql.NullString
		taskID   sql.NullString
		folderID sql.NullInt64
	)

	err := globals.QueryRowDb(db, `
		SELECT conversation_name, data, model, task_id, folder_id
		FROM conversation
		WHERE user_id = ? AND conversation_id = ?
	`, userId, conversationId).Scan(&name, &data, &model, &taskID, &folderID)
	if err != nil {
		return 0, err
	}

	newID := GetConversationLengthByUserID(db, userId) + 1
	cloneName := utils.Extract(fmt.Sprintf("%s (copy)", name), 50, "...")

	targetModel := globals.GPT3Turbo
	if model.Valid && model.String != "" {
		targetModel = model.String
	}

	var folder interface{}
	if folderID.Valid {
		folder = folderID.Int64
	}

	_, err = globals.ExecDb(db, `
		INSERT INTO conversation (
			user_id, conversation_id, conversation_name, data, model, task_id, folder_id, folder_order, pinned, archived, updated_at
		) VALUES (?, ?, ?, ?, ?, ?, ?, 0, FALSE, FALSE, CURRENT_TIMESTAMP)
	`, userId, newID, cloneName, data, targetModel, taskID, folder)
	if err != nil {
		return 0, err
	}

	return newID, nil
}

func SetConversationPinned(db *sql.DB, userId int64, conversationId int64, pinned bool) error {
	_, err := globals.ExecDb(db, `
		UPDATE conversation SET pinned = ?
		WHERE user_id = ? AND conversation_id = ?
	`, pinned, userId, conversationId)
	return err
}

func SetConversationArchived(db *sql.DB, userId int64, conversationId int64, archived bool) error {
	_, err := globals.ExecDb(db, `
		UPDATE conversation SET archived = ?
		WHERE user_id = ? AND conversation_id = ?
	`, archived, userId, conversationId)
	return err
}

func DeleteAllConversations(db *sql.DB, user auth.User) error {
	_, err := globals.ExecDb(db, "DELETE FROM conversation WHERE user_id = ?", user.GetID(db))
	return err
}
