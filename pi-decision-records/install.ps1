# install.ps1 — установка портированного скилла decision-records в pi
# Создаёт junction ~/.agents/skills/decision-records -> <repo>/pi-decision-records/skills/decision-records
# Junction (не symlink) — не требует прав администратора на Windows.
# После установки скилл виден pi и `npx skills list`.

[CmdletBinding()]
param(
    [string]$SkillsDir = (Join-Path $HOME '.agents\skills')
)

$ErrorActionPreference = 'Stop'

$skillSource = Join-Path $PSScriptRoot 'skills\decision-records'
$skillName = 'decision-records'
$skillTarget = Join-Path $SkillsDir $skillName

if (-not (Test-Path (Join-Path $skillSource 'SKILL.md'))) {
    throw "SKILL.md не найден в '$skillSource' — запускайте скрипт из корня порта pi-decision-records."
}

# Существующая установка
if (Test-Path $skillTarget) {
    $item = Get-Item $skillTarget -Force
    if ($item.LinkType -eq 'Junction' -or $item.LinkType -eq 'SymbolicLink') {
        Remove-Item $skillTarget -Force
        Write-Host "Удалён прежний junction: $skillTarget"
    } else {
        throw "Цель '$skillTarget' существует и не является junction/symlink. Удалите вручную и повторите."
    }
}

New-Item -ItemType Directory -Force $SkillsDir | Out-Null
New-Item -ItemType Junction -Path $skillTarget -Target $skillSource | Out-Null

Write-Host "OK: $skillTarget -> $skillSource"
Write-Host "Проверка: запустите pi и выполните /skill:$skillName, либо: npx skills list"
