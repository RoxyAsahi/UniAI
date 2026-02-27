package conversation

import (
	"chat/globals"
	"database/sql"
)

type StarredMessage struct {
	ConversationId int64  `json:"conversation_id"`
	MessageIndex   int    `json:"message_index"`
	CreatedAt      string `json:"created_at"`
}

func StarMessage(db *sql.DB, userId int64, conversationId int64, messageIndex int) error {
	_, err := globals.ExecDb(db, `
		INSERT IGNORE INTO starred_messages (user_id, conversation_id, message_index)
		VALUES (?, ?, ?)
	`, userId, conversationId, messageIndex)
	return err
}

func UnstarMessage(db *sql.DB, userId int64, conversationId int64, messageIndex int) error {
	_, err := globals.ExecDb(db, `
		DELETE FROM starred_messages
		WHERE user_id = ? AND conversation_id = ? AND message_index = ?
	`, userId, conversationId, messageIndex)
	return err
}

func GetStarredMessages(db *sql.DB, userId int64, conversationId int64) []StarredMessage {
	var result []StarredMessage
	rows, err := globals.QueryDb(db, `
		SELECT conversation_id, message_index, created_at
		FROM starred_messages
		WHERE user_id = ? AND conversation_id = ?
		ORDER BY message_index ASC
	`, userId, conversationId)
	if err != nil {
		return result
	}
	defer rows.Close()

	for rows.Next() {
		var item StarredMessage
		if err := rows.Scan(&item.ConversationId, &item.MessageIndex, &item.CreatedAt); err != nil {
			continue
		}
		result = append(result, item)
	}
	return result
}
