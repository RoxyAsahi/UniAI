package conversation

import (
	"chat/globals"
	"database/sql"
)

type Folder struct {
	Id        int     `json:"id"`
	UserId    int     `json:"user_id"`
	Name      string  `json:"name"`
	Color     *string `json:"color"`
	Avatar    *string `json:"avatar"`
	ParentId  *int    `json:"parent_id"`
	SortOrder int     `json:"sort_order"`
	CreatedAt string  `json:"created_at"`
	UpdatedAt string  `json:"updated_at"`
}

func CreateFolder(db *sql.DB, userId int, name string, color *string, avatar *string, parentId *int) (int64, error) {
	result, err := globals.ExecDb(db, `
		INSERT INTO folders (user_id, name, color, avatar, parent_id) VALUES (?, ?, ?, ?, ?)
	`, userId, name, color, avatar, parentId)
	if err != nil {
		return 0, err
	}
	return result.LastInsertId()
}

func ListFolders(db *sql.DB, userId int) []Folder {
	folders := make([]Folder, 0)
	rows, err := globals.QueryDb(db, `
		SELECT id, user_id, name, color, avatar, parent_id, sort_order, created_at, updated_at
		FROM folders WHERE user_id = ? ORDER BY sort_order ASC, id ASC
	`, userId)
	if err != nil {
		return folders
	}
	defer rows.Close()

	for rows.Next() {
		var f Folder
		if err := rows.Scan(&f.Id, &f.UserId, &f.Name, &f.Color, &f.Avatar, &f.ParentId, &f.SortOrder, &f.CreatedAt, &f.UpdatedAt); err != nil {
			continue
		}
		folders = append(folders, f)
	}
	return folders
}

func UpdateFolder(db *sql.DB, userId int, folderId int, name string, color *string) error {
	_, err := globals.ExecDb(db, `
		UPDATE folders SET name = ?, color = ? WHERE id = ? AND user_id = ?
	`, name, color, folderId, userId)
	return err
}

func DeleteFolder(db *sql.DB, userId int, folderId int) error {
	// Move conversations out of this folder
	_, _ = globals.ExecDb(db, `
		UPDATE conversation SET folder_id = NULL WHERE folder_id = ? AND user_id = ?
	`, folderId, userId)

	// Set children's parent to NULL
	_, _ = globals.ExecDb(db, `
		UPDATE folders SET parent_id = NULL WHERE parent_id = ? AND user_id = ?
	`, folderId, userId)

	// Delete the folder
	_, err := globals.ExecDb(db, `
		DELETE FROM folders WHERE id = ? AND user_id = ?
	`, folderId, userId)
	return err
}

func ReorderFolders(db *sql.DB, userId int, orders map[int]int) error {
	for folderId, order := range orders {
		_, err := globals.ExecDb(db, `
			UPDATE folders SET sort_order = ? WHERE id = ? AND user_id = ?
		`, order, folderId, userId)
		if err != nil {
			return err
		}
	}
	return nil
}

func MoveConversation(db *sql.DB, userId int64, conversationId int64, folderId *int) error {
	_, err := globals.ExecDb(db, `
		UPDATE conversation SET folder_id = ? WHERE user_id = ? AND conversation_id = ?
	`, folderId, userId, conversationId)
	return err
}

func ReorderConversations(db *sql.DB, userId int64, orders map[int64]int) error {
	for conversationId, order := range orders {
		_, err := globals.ExecDb(db, `
			UPDATE conversation SET folder_order = ? WHERE user_id = ? AND conversation_id = ?
		`, order, userId, conversationId)
		if err != nil {
			return err
		}
	}
	return nil
}
