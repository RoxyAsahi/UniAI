package manager

import (
	adaptercommon "chat/adapter/common"
	"chat/auth"
	"chat/channel"
	"chat/globals"
	"chat/manager/conversation"
	"chat/utils"
	"database/sql"
	"encoding/json"
	"fmt"
	"regexp"
	"runtime/debug"
	"strings"
)

const defaultAutoTitlePrompt = `请为以下对话生成一个简短的中文标题（3-10个字），准确反映对话主题。
要求：
1. 使用中文
2. 不要使用引号
3. 不要有任何前缀或解释
4. 只输出 JSON 格式：{"title": "你的标题"}

对话内容：
{{MESSAGES}}`

const defaultAutoTitlePromptEn = `Generate a short English title (3-10 words) for the following conversation that accurately reflects the topic.
Requirements:
1. Use English
2. No quotes
3. No prefix or explanation
4. Only output JSON format: {"title": "Your Title"}

Conversation:
{{MESSAGES}}`

type TitleResult struct {
	Title string `json:"title"`
}

func containsChinese(text string) bool {
	if len(text) == 0 {
		return false
	}
	for _, r := range text {
		if r >= 0x4E00 && r <= 0x9FFF {
			return true
		}
		if r >= 0x3400 && r <= 0x4DBF {
			return true
		}
		if r >= 0xF900 && r <= 0xFAFF {
			return true
		}
		if r >= 0x3000 && r <= 0x303F {
			return true
		}
		if r >= 0xFF00 && r <= 0xFFEF {
			return true
		}
		if r >= 0x3040 && r <= 0x309F {
			return true
		}
		if r >= 0x30A0 && r <= 0x30FF {
			return true
		}
	}
	return false
}

func buildAutoTitlePrompt(conv *conversation.Conversation) string {
	systemConfig := channel.SystemInstance

	prompt := systemConfig.GetAutoTitlePrompt()
	if len(prompt) == 0 {
		messages := conv.GetMessage()
		hasChinese := false
		for _, msg := range messages {
			if containsChinese(msg.Content) {
				hasChinese = true
				break
			}
		}
		if hasChinese {
			prompt = defaultAutoTitlePrompt
		} else {
			prompt = defaultAutoTitlePromptEn
		}
	}

	messages := conv.GetMessageSegment(2)

	var messagesText strings.Builder
	for _, msg := range messages {
		role := msg.Role
		if role == globals.System {
			role = "System"
		} else if role == globals.User {
			role = "User"
		} else if role == globals.Assistant {
			role = "Assistant"
		}
		messagesText.WriteString(fmt.Sprintf("%s: %s\n", role, msg.Content))
	}

	prompt = strings.ReplaceAll(prompt, "{{MESSAGES}}", messagesText.String())

	return prompt
}

func cleanTitleResult(raw string) string {
	raw = strings.TrimSpace(raw)

	re := regexp.MustCompile(`(?s)\{.*\}`)
	matches := re.FindString(raw)
	if matches != "" {
		raw = matches
	}

	raw = strings.TrimPrefix(raw, "```json")
	raw = strings.TrimPrefix(raw, "```")
	raw = strings.TrimSuffix(raw, "```")

	raw = strings.TrimSpace(raw)

	return raw
}

func extractTitleFromResponse(response string, conv *conversation.Conversation) string {
	cleaned := cleanTitleResult(response)

	var result TitleResult
	if err := json.Unmarshal([]byte(cleaned), &result); err == nil {
		if len(result.Title) > 0 {
			maxLen := channel.SystemInstance.GetAutoTitleMaxLen()
			if len(result.Title) > maxLen {
				result.Title = utils.Extract(result.Title, maxLen, "...")
			}
			return result.Title
		}
	}

	fallbackTitle := extractFallbackTitle(cleaned)
	if len(fallbackTitle) > 0 {
		return fallbackTitle
	}

	messages := conv.GetMessage()
	if len(messages) > 0 {
		return utils.Extract(messages[0].Content, 50, "...")
	}

	return "新对话"
}

func extractFallbackTitle(cleaned string) string {
	patterns := []string{
		`"title"\s*:\s*"([^"]+)"`,
		`title[:\s]+([^\n]+)`,
	}

	for _, pattern := range patterns {
		re := regexp.MustCompile(pattern)
		matches := re.FindStringSubmatch(cleaned)
		if len(matches) > 1 {
			title := strings.TrimSpace(matches[1])
			if len(title) > 0 {
				maxLen := channel.SystemInstance.GetAutoTitleMaxLen()
				if len(title) > maxLen {
					title = utils.Extract(title, maxLen, "...")
				}
				return title
			}
		}
	}
	return ""
}

func GenerateTitle(db *sql.DB, conn *Connection, conv *conversation.Conversation, model string) {
	defer func() {
		if r := recover(); r != nil {
			globals.Warn(fmt.Sprintf("[auto-title] caught panic during title generation: %s\n%s", r, debug.Stack()))
		}

		if conn != nil {
			conn.Send(globals.ChatSegmentResponse{
				Conversation: conv.GetId(),
				Titling:      false,
			})
		}
	}()

	systemConfig := channel.SystemInstance
	if !systemConfig.GetAutoTitleEnabled() {
		return
	}

	user := auth.GetUserById(db, conv.GetUserID())
	if user == nil {
		globals.Warn(fmt.Sprintf("[auto-title] cannot find user %d for conversation %d", conv.GetUserID(), conv.GetId()))
		return
	}

	// Priority: User Preference > System Default
	userSettings := user.GetSettings(db)
	autoTitleEnabled := userSettings.AutoTitle

	// If user hasn't explicitly set (it's the default object), we might want to check system default
	// but currently GetSettings defaults it to true. Let's make it consistent:
	// If the user settings were never in DB, use system default.
	var isDefaultSettings bool
	globals.QueryRowDb(db, "SELECT auto_title IS NULL FROM auth WHERE id = ?", user.ID).Scan(&isDefaultSettings)

	if isDefaultSettings {
		autoTitleEnabled = systemConfig.GetAutoTitleEnabled()
	}

	if !autoTitleEnabled {
		globals.Debug(fmt.Sprintf("[auto-title] auto title disabled for user %d (settings: %v, default: %v)", user.ID, userSettings.AutoTitle, isDefaultSettings))
		return
	}

	convName := conv.GetName()
	defaultName := "new chat"
	isInitialSnippetTitle := false
	for _, msg := range conv.GetMessage() {
		if msg.Role != globals.User {
			continue
		}

		initial := strings.TrimSpace(utils.Extract(msg.Content, 50, "..."))
		if len(initial) == 0 {
			break
		}
		isInitialSnippetTitle = strings.TrimSpace(convName) == initial
		break
	}

	if !systemConfig.GetAutoTitleOverwrite() {
		if strings.ToLower(strings.TrimSpace(convName)) != defaultName && len(strings.TrimSpace(convName)) > 0 && !isInitialSnippetTitle {
			globals.Debug(fmt.Sprintf("[auto-title] skip generation for conversation %d (name: %s)", conv.GetId(), convName))
			return
		}
	}

	if conn != nil {
		conn.Send(globals.ChatSegmentResponse{
			Conversation: conv.GetId(),
			Titling:      true,
		})
	}

	globals.Debug(fmt.Sprintf("[auto-title] starting generation for conversation %d (model: %s)", conv.GetId(), model))

	// Ensure group is valid, fallback to normal if needed
	group := user.GetGroup(db)
	if group == "" || group == globals.AnonymousType {
		group = globals.NormalType
		globals.Debug(fmt.Sprintf("[auto-title] group fallback to %s for user %d", group, user.ID))
	}

	prompt := buildAutoTitlePrompt(conv)

	chatModel := model
	if len(userSettings.AutoModel) > 0 {
		chatModel = userSettings.AutoModel
		globals.Debug(fmt.Sprintf("[auto-title] user model: %s", chatModel))
	} else if len(systemConfig.GetAutoTitleModel()) > 0 {
		chatModel = systemConfig.GetAutoTitleModel()
		globals.Debug(fmt.Sprintf("[auto-title] system model: %s", chatModel))
	}

	// Double check model charge to avoid "cannot find channel"
	if _, ok := channel.ChargeInstance.Models[chatModel]; !ok {
		globals.Warn(fmt.Sprintf("[auto-title] model %s not found in charge rules, fallback to %s", chatModel, model))
		chatModel = model
	}

	messages := []globals.Message{
		{
			// Use user-role prompt for better compatibility with OpenAI-compatible
			// gateways that proxy to Gemini and require non-empty user contents.
			Role:    globals.User,
			Content: prompt,
		},
	}

	// Double check model charge to avoid "cannot find channel"
	if _, ok := channel.ChargeInstance.Models[chatModel]; !ok {
		globals.Warn(fmt.Sprintf("[auto-title] model %s not found in charge rules, attempting fallback", chatModel))
		// If custom model fails, fallback to current conversation model
		chatModel = model
	}

	requestWithModel := func(targetModel string) (string, error) {
		var output string
		props := adaptercommon.CreateChatProps(&adaptercommon.ChatProps{
			Model:         targetModel,
			OriginalModel: targetModel,
			Message:       messages,
			MaxTokens:     utils.ToPtr(1024),
		}, utils.NewBuffer(targetModel, messages, channel.ChargeInstance.GetCharge(targetModel)))

		err := channel.NewChatRequest(group, props, func(chunk *globals.Chunk) error {
			if chunk != nil && chunk.Content != "" {
				output += chunk.Content
			}
			return nil
		})

		return output, err
	}

	generatedTitle, err := requestWithModel(chatModel)

	// Fallback to current conversation model when custom/system model has no available channel.
	if (err != nil || len(generatedTitle) == 0) && chatModel != model {
		globals.Warn(fmt.Sprintf("[auto-title] primary model %s failed for conversation %d, fallback to conversation model %s: %v", chatModel, conv.GetId(), model, err))
		chatModel = model
		generatedTitle, err = requestWithModel(chatModel)
	}

	if err != nil || len(generatedTitle) == 0 {
		globals.Warn(fmt.Sprintf("[auto-title] failed to generate title for conversation %d (group: %s, model: %s): %v", conv.GetId(), group, chatModel, err))
		return
	}

	globals.Debug(fmt.Sprintf("[auto-title] raw response for %d: %s", conv.GetId(), generatedTitle))
	title := extractTitleFromResponse(generatedTitle, conv)
	if len(title) == 0 {
		globals.Warn(fmt.Sprintf("[auto-title] failed to extract title from response for conversation %d (raw: %s)", conv.GetId(), generatedTitle))
		return
	}

	conv.SetName(db, title)
	if conn != nil {
		conn.Send(globals.ChatSegmentResponse{
			Conversation: conv.GetId(),
			Title:        title,
			Titling:      false,
			End:          true,
		})
	}
	globals.Info(fmt.Sprintf("[auto-title] successfully generated title '%s' for conversation %d", title, conv.GetId()))
}

func TriggerAutoTitle(db *sql.DB, conn *Connection, conv *conversation.Conversation) {
	if conv == nil {
		return
	}

	systemConfig := channel.SystemInstance
	if !systemConfig.GetAutoTitleEnabled() {
		return
	}

	msgLen := conv.GetMessageLength()
	minMsgs := systemConfig.GetAutoTitleMinMsgs()

	globals.Debug(fmt.Sprintf("[auto-title] trigger check for conversation %d: messages=%d, min_msgs=%d", conv.GetId(), msgLen, minMsgs))

	if msgLen < minMsgs {
		return
	}

	model := conv.GetModel()

	go GenerateTitle(db, conn, conv, model)
}
