@echo off
title Claude 启动
echo 正在为您启动 Claude 并跳过权限校验，请稍候，主人...
powershell -Command "claude --dangerously-skip-permissions"
pause