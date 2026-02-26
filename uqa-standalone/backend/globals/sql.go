package globals

import (
	"database/sql"
	"regexp"
	"strings"
)

var SqliteEngine = false

type batch struct {
	Old   string
	New   string
	Regex bool
}

func batchReplace(query string, items []batch) string {
	for _, item := range items {
		if item.Regex {
			query = regexp.MustCompile(item.Old).ReplaceAllString(query, item.New)
			continue
		}
		query = strings.ReplaceAll(query, item.Old, item.New)
	}
	return query
}

// PreflightSql adapts MySQL SQL to SQLite when SqliteEngine is true.
func PreflightSql(query string) string {
	if SqliteEngine {
		query = batchReplace(query, []batch{
			{`INT `, `INTEGER `, false},
			{` AUTO_INCREMENT`, ` AUTOINCREMENT`, false},
			{`DATETIME`, `TEXT`, false},
			{`DECIMAL`, `REAL`, false},
			{`MEDIUMTEXT`, `TEXT`, false},
			{`VARCHAR`, `TEXT`, false},
			{`TEXT\(\d+\)`, `TEXT`, true},
			{`REAL\(\d+,\d+\)`, `REAL`, true},
			{`UNIQUE KEY`, `UNIQUE`, false},
			// Remove MySQL-specific INDEX(...) inside CREATE TABLE
			{`,\s*INDEX\([^)]+\)`, ``, true},
		})
	}
	return query
}

func ExecDb(db *sql.DB, query string, args ...interface{}) (sql.Result, error) {
	return db.Exec(PreflightSql(query), args...)
}

func QueryDb(db *sql.DB, query string, args ...interface{}) (*sql.Rows, error) {
	return db.Query(PreflightSql(query), args...)
}

func QueryRowDb(db *sql.DB, query string, args ...interface{}) *sql.Row {
	return db.QueryRow(PreflightSql(query), args...)
}
