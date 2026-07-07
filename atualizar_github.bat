@echo off
chcp 65001 > nul
echo =======================================================
echo Atualizando "Forja de Elementos" no GitHub...
echo =======================================================
echo.

:: Inicializa o git caso ainda não tenha sido inicializado
if not exist .git (
    echo Inicializando repositorio Git local...
    git init
)

:: Garante que o remote "origin" aponta para o link correto
git remote remove origin 2>nul
git remote add origin https://github.com/flavioescunha/forja-estelar.git

:: Adiciona todas as modificações
echo Adicionando arquivos modificados...
git add .

:: Pega a data e hora atual do Windows para a mensagem de commit
for /f "tokens=2 delims==" %%I in ('wmic os get localdatetime /value') do set datetime=%%I
set data=%datetime:~6,2%/%datetime:~4,2%/%datetime:~0,4%
set hora=%datetime:~8,2%:%datetime:~10,2%

:: Faz o commit
echo.
echo Criando commit (Salvando alteracoes: %data% %hora%)...
git commit -m "Atualizacao automatica em %data% as %hora%"

:: Configura a branch principal
git branch -M main

:: Envia (push) para o GitHub
echo.
echo Enviando arquivos para o GitHub (https://github.com/flavioescunha/forja-estelar.git)...
git push -u origin main

echo.
echo =======================================================
echo Atualizacao concluida com sucesso!
echo As mudancas estarao disponiveis online em cerca de 1 a 3 minutos.
echo =======================================================
pause
