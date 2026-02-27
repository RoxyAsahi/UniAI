//go:build ignore

package main

import (
	"fmt"
	"strings"

	"github.com/spf13/viper"
)

type MarketModel struct {
	Id          string `mapstructure:"id"`
	Name        string `mapstructure:"name"`
	Description string `mapstructure:"description"`
}
type MarketModelList []MarketModel

func main() {
	viper.SetConfigType("yaml")
	yaml := `
market:
  - id: gpt-4
    name: GPT-4
    vision_model: true
`
	viper.ReadConfig(strings.NewReader(yaml))
	var models MarketModelList
	viper.UnmarshalKey("market", &models)
	fmt.Printf("%+v\n", models)
}
