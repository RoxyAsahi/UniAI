//go:build ignore

package main

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

func main() {
	viper.SetConfigType("yaml")
	yaml := `
market:
  - id: gpt-4
    name: GPT-4
    vision_model: true
`
	viper.ReadConfig(strings.NewReader(yaml))
	var models []map[string]interface{}
	viper.UnmarshalKey("market", &models)
	fmt.Printf("%v\n", models)
}
