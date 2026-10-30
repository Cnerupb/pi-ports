# uninstall.ps1 — удаление портированных dotnet-скиллов из pi
# Удаляет junction'ы, созданные install.ps1, из каталога скиллов.
# Безопасность: удаляются ТОЛЬКО junction'и, указывающие внутрь этого репозитория
# (skills/ порта). Реальные каталоги и чужие скиллы не трогаются.

[CmdletBinding()]
param(
    # Плагины для удаления. По умолчанию — костяк (тот же, что в install.ps1).
    [string[]]$Plugins,
    # Все плагины, включая meta.
    [switch]$All,
    [ValidateSet('Global', 'Local')]
    [string]$Scope = 'Global',
    # Каталог установки при Scope=Local. По умолчанию: ./.agents/skills от текущего каталога.
    [string]$LocalDir
)

$ErrorActionPreference = 'Stop'

$CorePlugins = @(
    'dotnet',
    'dotnet-msbuild',
    'dotnet-test',
    'dotnet-nuget',
    'dotnet-upgrade',
    'dotnet-test-migration',
    'dotnet-aspnetcore',
    'dotnet-data',
    'dotnet-template-engine',
    'dotnet-ai'
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

if (-not (Test-Path $targetRoot)) {
    Write-Host "Каталог не существует: $targetRoot (нечего удалять)"
    return
}

# Имена скиллов заданных плагинов (junction удаляем только если он указывает
# именно на эти каталоги — не трогаем чужие установки с теми же именами).
$ownedTargets = @{}
foreach ($p in $Plugins) {
    $pluginDir = Join-Path $skillsRoot $p
    if (Test-Path $pluginDir) {
        foreach ($skill in (Get-ChildItem $pluginDir -Directory)) {
            $ownedTargets[$skill.Name] = $skill.FullName
        }
    } else {
        Write-Warning "Плагин не найден в порте: $p (junction'и искать не по чему)"
    }
}

$removed = @(); $skipped = @()
foreach ($name in $ownedTargets.Keys) {
    $target = Join-Path $targetRoot $name
    if (-not (Test-Path $target)) { continue }
    $item = Get-Item $target -Force
    if ($item.LinkType -ne 'Junction' -and $item.LinkType -ne 'SymbolicLink') {
        $skipped += $name
        continue
    }
    $linkTarget = $item.Target
    if ($item.LinkType -eq 'SymbolicLink') { $linkTarget = $item.Target[0] }
    # Нормализация путей для сравнения
    $expected = [IO.Path]::GetFullPath($ownedTargets[$name]).TrimEnd('\')
    $actual = [IO.Path]::GetFullPath($linkTarget).TrimEnd('\')
    if ($actual -ieq $expected) {
        # PS 5.1 Remove-Item падает с NullReferenceException на junction'ах —
        # используем rmdir, он удаляет только ссылку, не цель.
        cmd /c rmdir "$target" | Out-Null
        $removed += $name
    } else {
        $skipped += "$name (junction указывает не в этот репозиторий: $actual)"
    }
}

Write-Host "OK ($Scope): удалено $($removed.Count) junction'ов из $targetRoot"
if ($skipped) {
    Write-Host "Пропущено: $($skipped.Count)"
    $skipped | ForEach-Object { Write-Host "  - $_" }
}
