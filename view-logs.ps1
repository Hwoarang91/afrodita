# ==========================================
# DEVELOPMENT ONLY - НЕ ИСПОЛЬЗУЕТСЯ В ПРОДАКШЕНЕ
# ==========================================
# Скрипт для просмотра логов Docker Compose с правильной кодировкой UTF-8
# Использование: .\view-logs.ps1 -Pattern "CRON" -Tail 200
# 
# ВАЖНО: Этот скрипт предназначен ТОЛЬКО для локальной разработки и тестирования.
# В продакшене используйте стандартные команды docker-compose logs
# ==========================================

# Настройка кодировки для правильного отображения русского языка
$OutputEncoding = [System.Text.Encoding]::UTF8
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
chcp 65001 | Out-Null

param(
    [string]$Pattern = ".*",
    [int]$Tail = 100,
    [string]$Service = "backend"
)

Write-Host "Просмотр логов сервиса: $Service" -ForegroundColor Green
Write-Host "Паттерн поиска: $Pattern" -ForegroundColor Cyan
Write-Host "Количество строк: $Tail" -ForegroundColor Cyan
Write-Host ""

docker compose -f docker-compose.dev.yml logs $Service --tail=$Tail | Select-String -Pattern $Pattern
