param (
    [string]$RepoUrl = ""
)

if ($RepoUrl -eq "") {
    $RepoUrl = Read-Host "Por favor, insira a URL do seu repositório no GitHub (ex: https://github.com/usuario/forja-de-elementos.git)"
}

if ($RepoUrl -eq "") {
    Write-Host "URL do repositório não fornecida. Cancelando." -ForegroundColor Red
    exit
}

Write-Host "Inicializando repositório Git..." -ForegroundColor Cyan
git init

Write-Host "Adicionando arquivos..." -ForegroundColor Cyan
git add .

Write-Host "Criando commit..." -ForegroundColor Cyan
git commit -m "Publicando jogo online"

Write-Host "Configurando branch main..." -ForegroundColor Cyan
git branch -M main

Write-Host "Configurando repositório remoto..." -ForegroundColor Cyan
# Tenta remover a origem caso já exista para evitar erros
git remote remove origin 2>$null
git remote add origin $RepoUrl

Write-Host "Enviando arquivos para o GitHub..." -ForegroundColor Cyan
git push -u origin main

Write-Host "========================================================" -ForegroundColor Green
Write-Host "Concluído com sucesso! Os arquivos foram enviados." -ForegroundColor Green
Write-Host "Para tornar o jogo online, vá até o seu repositório no GitHub:" -ForegroundColor Yellow
Write-Host "1. Clique na aba 'Settings' (Configurações)" -ForegroundColor Yellow
Write-Host "2. No menu lateral esquerdo, desça até e clique em 'Pages'" -ForegroundColor Yellow
Write-Host "3. Em 'Build and deployment', na opção 'Branch', selecione 'main' e '(/root)' e clique em Save" -ForegroundColor Yellow
Write-Host "4. Aguarde alguns minutos. Uma mensagem aparecerá no topo dessa página com a URL do seu jogo rodando online!" -ForegroundColor Yellow
Write-Host "========================================================" -ForegroundColor Green
