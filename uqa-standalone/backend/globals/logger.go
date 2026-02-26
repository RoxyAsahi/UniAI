package globals

import (
	"fmt"
	"strings"

	"github.com/natefinch/lumberjack"
	"github.com/sirupsen/logrus"
	"github.com/spf13/viper"
)

var Logger *logrus.Logger

type appFormatter struct{}

func (f *appFormatter) Format(entry *logrus.Entry) ([]byte, error) {
	data := fmt.Sprintf("[%s] - [%s] - %s\n",
		strings.ToUpper(entry.Level.String()),
		entry.Time.Format("2006-01-02 15:04:05"),
		entry.Message,
	)
	if !viper.GetBool("log.ignore_console") {
		fmt.Print(data)
	}
	return []byte(data), nil
}

func init() {
	Logger = logrus.New()
	Logger.SetFormatter(&appFormatter{})
	Logger.SetOutput(&lumberjack.Logger{
		Filename:   "logs/uqa.log",
		MaxSize:    1,
		MaxBackups: 50,
		MaxAge:     21,
	})
	Logger.SetLevel(logrus.DebugLevel)
}

func Warn(args ...interface{})  { Logger.Warnln(args...) }
func Info(args ...interface{})  { Logger.Infoln(args...) }
func Error(args ...interface{}) { Logger.Errorln(args...) }
func Debug(args ...interface{}) { Logger.Debugln(args...) }
