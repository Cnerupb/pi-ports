# install.ps1 — установка портированных dotnet-скиллов в pi
# Создаёт junction'ы на каждый скилл выбранных плагинов в каталоге скиллов pi.
# Global: ~/.agents/skills (доступно во всех проектах)
# Local:  <cwd>/.agents/skills (только текущий проект, коммитится в его репозиторий)
# Junction (не symlink) — не требует прав администратора на Windows.

[CmdletBinding()]
param(
    # Плагины для установки. По умолчанию — костяк (CorePlugins).
    [string[]]$Plugins,
    # Все плагины, включая meta (мета-скиллы авторства).
    [switch]$All,
    [ValidateSet('Global', 'Local')]
    [string]$Scope = 'Global',
    # Куда ставить при Scope=Local. По умолчанию: ./.agents/skills от текущего каталога.
    [string]$LocalDir
)

$ErrorActionPreference = 'Stop'

$CorePlugins = @(
    'dotnet',                  # C# language server + базовые C#-скиллы
    'dotnet-msbuild',          # MSBuild: диагностика, производительность, review
    'dotnet-test',             # Запуск, анализ, покрытие тестов
    'dotnet-nuget',            # NuGet: зависимости, модернизация
    'dotnet-upgrade',          # Миграции между версиями .NET
    'dotnet-test-migration',   # Миграции тестовых фреймворков/платформ
    'dotnet-aspnetcore',       # ASP.NET Core: middleware, endpoints, API
    'dotnet-data',             # EF Core и data access
    'dotnet-template-engine',  # dotnet new: шаблоны, scaffolding
    'dotnet-ai'                # AI/ML для .NET: LLM, RAG, MCP, ML.NET
)

$portRoot = $PSScriptRoot
$skillsRoot = Join-Path $portRoot 'skills'

if ($All) {
    $Plugins = Get-ChildItem $skillsRoot -Directory | ForEach-Object { $_.Name }
}
if (-not $Plugins) {
    $Plugins = $CorePlugins
}

$targetRoot = if ($Scope -eq 'Global') {
    Join-Path $HOME '.agents\skills'
} else {
    if (-not $LocalDir) { $LocalDir = Join-Path (Get-Location) '.agents\skills' }
    $LocalDir
}

New-Item -ItemType Directory -Force $targetRoot | Out-Null

$installed = @()
foreach ($p in $Plugins) {
    $pluginDir = Join-Path $skillsRoot $p
    if (-not (Test-Path $pluginDir)) {
        Write-Warning "Плагин не найден: $p (ожидался каталог $pluginDir)"
        continue
    }
    foreach ($skill in (Get-ChildItem $pluginDir -Directory)) {
        $target = Join-Path $targetRoot $skill.Name
        if (Test-Path $target) {
            $item = Get-Item $target -Force
            if ($item.LinkType -eq 'Junction' -or $item.LinkType -eq 'SymbolicLink') {
                Remove-Item $target -Force
            } else {
                Write-Warning "'$target' существует и не является junction — пропуск ($($skill.Name))"
                continue
            }
        }
        New-Item -ItemType Junction -Path $target -Target $skill.FullName | Out-Null
        $installed += $skill.Name
    }
}

Write-Host "OK ($Scope): $($installed.Count) скиллов -> $targetRoot"
Write-Host "Проверка: npx skills list$(if ($Scope -eq 'Global') { ' -g' })"
