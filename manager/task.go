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
	"time"
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

const defaultFollowUpPrompt = `请你站在用户视角，基于以下对话内容，生成 {{COUNT}} 个“用户接下来最可能继续追问的问题”。
要求：
1. 只输出 JSON 对象，格式必须是：{"follow_ups":["问题1？","问题2？","问题3？"]}
2. 不要输出 markdown 代码块、解释文字、前后缀
3. 问题要简短、具体、自然，避免重复
4. 问题必须从用户口吻出发
5. 当前日期：{{CURRENT_DATE}}

对话内容：
{{MESSAGES}}`

const defaultFollowUpPromptEn = `Generate {{COUNT}} likely follow-up questions from the user's perspective based on the conversation below.
Requirements:
1. Output JSON only in this exact format: {"follow_ups":["Q1?","Q2?","Q3?"]}
2. Do not output markdown, explanations, or any extra text
3. Keep questions short, specific, natural, and non-repetitive
4. Questions must be written from the user's point of view
5. Current date: {{CURRENT_DATE}}

Conversation:
{{MESSAGES}}`

type TitleResult struct {
	Title string `json:"title"`
}

type FollowUpResult struct {
	FollowUps []string `json:"follow_ups"`
}

var followUpNoisePattern = regexp.MustCompile(`(?s)<details\b[^>]*>.*?<\/details>|!\[.*?\]\(.*?\)`)
var orderedListPrefixPattern = regexp.MustCompile(`^\d+[\.\)]\s*`)

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

func cleanFollowUpContent(content string) string {
	cleaned := strings.TrimSpace(content)
	if len(cleaned) == 0 {
		return ""
	}

	cleaned = followUpNoisePattern.ReplaceAllString(cleaned, "")
	cleaned = strings.TrimSpace(cleaned)

	return cleaned
}

func buildFollowUpPrompt(messages []globals.Message, context int, count int, template string) string {
	if len(messages) == 0 {
		return ""
	}
	if count <= 0 {
		count = 3
	}
	if context <= 0 {
		context = 6
	}

	prompt := template
	if strings.TrimSpace(prompt) == "" {
		hasChinese := false
		for _, msg := range messages {
			if containsChinese(msg.Content) {
				hasChinese = true
				break
			}
		}

		if hasChinese {
			prompt = defaultFollowUpPrompt
		} else {
			prompt = defaultFollowUpPromptEn
		}
	}

	start := 0
	if len(messages) > context {
		start = len(messages) - context
	}

	var text strings.Builder
	for _, msg := range messages[start:] {
		content := cleanFollowUpContent(msg.Content)
		if len(content) == 0 {
			continue
		}

		role := msg.Role
		if role == globals.System {
			role = "System"
		} else if role == globals.User {
			role = "User"
		} else if role == globals.Assistant {
			role = "Assistant"
		}

		text.WriteString(fmt.Sprintf("%s: %s\n", role, content))
	}

	prompt = strings.ReplaceAll(prompt, "{{MESSAGES}}", text.String())
	prompt = strings.ReplaceAll(prompt, "{{COUNT}}", fmt.Sprintf("%d", count))
	prompt = strings.ReplaceAll(prompt, "{{CURRENT_DATE}}", time.Now().Format("2006-01-02"))
	prompt = strings.ReplaceAll(prompt, "{{USER_NAME}}", "")

	return prompt
}

func cleanFollowUpResult(raw string) string {
	cleaned := strings.TrimSpace(raw)
	cleaned = strings.TrimPrefix(cleaned, "```json")
	cleaned = strings.TrimPrefix(cleaned, "```")
	cleaned = strings.TrimSuffix(cleaned, "```")
	cleaned = strings.TrimSpace(cleaned)

	start := strings.Index(cleaned, "{")
	end := strings.LastIndex(cleaned, "}")
	if start >= 0 && end >= 0 && end > start {
		cleaned = cleaned[start : end+1]
	}

	return strings.TrimSpace(cleaned)
}

func normalizeFollowUps(followUps []string, count int) []string {
	if count <= 0 {
		count = 3
	}

	result := make([]string, 0, count)
	seen := map[string]bool{}

	for _, item := range followUps {
		text := strings.TrimSpace(item)
		if text == "" {
			continue
		}

		text = strings.Trim(text, "\"'`")
		text = strings.TrimSpace(text)
		text = strings.TrimLeft(text, "-* ")

		// Remove common ordered-list prefixes like "1. ", "2) ".
		if m := orderedListPrefixPattern.FindString(text); m != "" {
			text = strings.TrimSpace(strings.TrimPrefix(text, m))
		}

		if len(text) < 2 {
			continue
		}

		key := strings.ToLower(text)
		if seen[key] {
			continue
		}
		seen[key] = true
		result = append(result, text)

		if len(result) >= count {
			break
		}
	}

	return result
}

func extractFollowUpsFromResponse(raw string, count int) []string {
	cleaned := cleanFollowUpResult(raw)

	parseJSON := func(input string) []string {
		var result FollowUpResult
		if err := json.Unmarshal([]byte(input), &result); err == nil {
			return normalizeFollowUps(result.FollowUps, count)
		}
		return nil
	}

	if parsed := parseJSON(cleaned); len(parsed) > 0 {
		return parsed
	}

	// Some models still emit single quotes or smart quotes in JSON.
	repaired := strings.NewReplacer(
		"‘", "\"",
		"’", "\"",
		"“", "\"",
		"”", "\"",
		"'", "\"",
	).Replace(cleaned)
	if parsed := parseJSON(repaired); len(parsed) > 0 {
		return parsed
	}

	// Fallback: try extracting a JSON array.
	arrStart := strings.Index(repaired, "[")
	arrEnd := strings.LastIndex(repaired, "]")
	if arrStart >= 0 && arrEnd > arrStart {
		var arr []string
		if err := json.Unmarshal([]byte(repaired[arrStart:arrEnd+1]), &arr); err == nil {
			return normalizeFollowUps(arr, count)
		}
	}

	// Last fallback: split lines and keep likely question lines.
	lines := strings.Split(raw, "\n")
	candidates := make([]string, 0, len(lines))
	for _, line := range lines {
		line = strings.TrimSpace(line)
		if line == "" {
			continue
		}
		if strings.HasPrefix(line, "{") || strings.HasPrefix(line, "}") {
			continue
		}
		candidates = append(candidates, line)
	}

	return normalizeFollowUps(candidates, count)
}

func GenerateFollowUps(
	db *sql.DB,
	conn *Connection,
	userID int64,
	conversationID int64,
	model string,
	messageIndex int,
	snapshot []globals.Message,
) {
	defer func() {
		if r := recover(); r != nil {
			globals.Warn(fmt.Sprintf("[follow-up] caught panic during follow-up generation: %s\n%s", r, debug.Stack()))
		}
	}()

	systemConfig := channel.SystemInstance
	if !systemConfig.GetFollowUpEnabled() {
		return
	}
	if len(snapshot) == 0 {
		return
	}
	autoFollowUpEnabled := systemConfig.GetFollowUpEnabled()
	group := globals.AnonymousType
	chatModel := model

	if userID > 0 {
		user := auth.GetUserById(db, userID)
		if user == nil {
			return
		}

		userSettings := user.GetSettings(db)
		autoFollowUpEnabled = userSettings.AutoFollowUp

		var isDefaultSettings bool
		globals.QueryRowDb(db, "SELECT auto_title IS NULL FROM auth WHERE id = ?", user.ID).Scan(&isDefaultSettings)
		if isDefaultSettings {
			autoFollowUpEnabled = systemConfig.GetFollowUpEnabled()
		}
		if !autoFollowUpEnabled {
			return
		}

		group = user.GetGroup(db)
		if strings.TrimSpace(userSettings.FollowUpModel) != "" {
			chatModel = strings.TrimSpace(userSettings.FollowUpModel)
		} else if strings.TrimSpace(systemConfig.GetFollowUpModel()) != "" {
			chatModel = strings.TrimSpace(systemConfig.GetFollowUpModel())
		}
	} else {
		if !autoFollowUpEnabled {
			return
		}
		if strings.TrimSpace(systemConfig.GetFollowUpModel()) != "" {
			chatModel = strings.TrimSpace(systemConfig.GetFollowUpModel())
		}
	}

	count := systemConfig.GetFollowUpCount()
	contextLen := systemConfig.GetFollowUpContext()
	prompt := buildFollowUpPrompt(snapshot, contextLen, count, systemConfig.GetFollowUpPrompt())
	if strings.TrimSpace(prompt) == "" {
		return
	}

	if group == "" || group == globals.AnonymousType {
		group = globals.NormalType
	}

	if _, ok := channel.ChargeInstance.Models[chatModel]; !ok {
		globals.Warn(fmt.Sprintf("[follow-up] model %s not found in charge rules, fallback to %s", chatModel, model))
		chatModel = model
	}

	requestMessages := []globals.Message{
		{
			Role:    globals.User,
			Content: prompt,
		},
	}

	requestWithModel := func(targetModel string) (string, error) {
		var output string
		props := adaptercommon.CreateChatProps(&adaptercommon.ChatProps{
			Model:         targetModel,
			OriginalModel: targetModel,
			Message:       requestMessages,
			MaxTokens:     utils.ToPtr(1024),
		}, utils.NewBuffer(targetModel, requestMessages, channel.ChargeInstance.GetCharge(targetModel)))

		err := channel.NewChatRequest(group, props, func(chunk *globals.Chunk) error {
			if chunk != nil && chunk.Content != "" {
				output += chunk.Content
			}
			return nil
		})

		return output, err
	}

	raw, err := requestWithModel(chatModel)
	if (err != nil || strings.TrimSpace(raw) == "") && chatModel != model {
		globals.Warn(fmt.Sprintf("[follow-up] primary model %s failed for conversation %d, fallback to %s: %v", chatModel, conversationID, model, err))
		raw, err = requestWithModel(model)
	}
	if err != nil || strings.TrimSpace(raw) == "" {
		globals.Warn(fmt.Sprintf("[follow-up] failed to generate follow-ups for conversation %d: %v", conversationID, err))
		return
	}

	followUps := extractFollowUpsFromResponse(raw, count)
	if len(followUps) == 0 {
		globals.Warn(fmt.Sprintf("[follow-up] failed to parse follow-ups for conversation %d (raw: %s)", conversationID, raw))
		return
	}

	if userID > 0 {
		conv := conversation.LoadConversation(db, userID, conversationID)
		if conv == nil {
			return
		}
		if messageIndex < 0 || messageIndex >= len(conv.Message) {
			return
		}
		if conv.Message[messageIndex].Role != globals.Assistant {
			return
		}

		conv.Message[messageIndex].FollowUps = &followUps
		conv.SaveConversation(db)
	}

	if conn != nil {
		idx := messageIndex
		conn.Send(globals.ChatSegmentResponse{
			Conversation: conversationID,
			Event:        "follow_ups",
			MessageIndex: &idx,
			FollowUps:    followUps,
		})
	}

	globals.Debug(fmt.Sprintf("[follow-up] generated %d follow-ups for conversation %d", len(followUps), conversationID))
}

func TriggerFollowUps(db *sql.DB, conn *Connection, conv *conversation.Conversation) {
	if conv == nil {
		return
	}
	if !channel.SystemInstance.GetFollowUpEnabled() {
		return
	}

	msgLen := conv.GetMessageLength()
	if msgLen == 0 {
		return
	}

	messageIndex := msgLen - 1
	last := conv.GetMessageById(messageIndex)
	if last.Role != globals.Assistant || strings.TrimSpace(last.Content) == "" {
		return
	}

	snapshot := conversation.CopyMessage(conv.GetMessage())
	go GenerateFollowUps(
		db,
		conn,
		conv.GetUserID(),
		conv.GetId(),
		conv.GetModel(),
		messageIndex,
		snapshot,
	)
}
