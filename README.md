# Meus Gastos

Mini app web em Google Apps Script para controlar gastos de cartão por fatura,
ligado a uma planilha do Google Sheets.

> Projeto pessoal, desenvolvido com auxílio de IA.

## O que faz

- Lança gastos pelo celular (valor, categoria, quem gastou, data)
- Compras parceladas: uma linha por parcela, cada uma na sua fatura
- Painel da fatura atual: gasto, meta, quanto resta e dias até fechar
- Gastos por categoria, semana a semana e histórico de faturas
- Parcelas em aberto e valor já comprometido nas próximas faturas
- Registro de Pix/dinheiro e de dinheiro guardado
- Conquistas e medalhas por meta cumprida
- Desfazer o último lançamento

## Tecnologias

Google Apps Script, Google Sheets, HTML/CSS/JavaScript (sem frameworks).

## Estrutura

- `Code.gs`: lógica principal (leitura da planilha, lançamentos)
- `Parcelas.gs`: parcelamento e Pix/guardado, inseridos no `Index.html` em tempo de execução
- `Caixa.gs`: aba de Pix/dinheiro e dinheiro guardado
- `Index.html`: interface

## Como usar

1. Crie uma planilha no Google Sheets com as abas `Resumo`, `Apoio`, `Metas` e `Lançamentos`.
2. Abra Extensões > Apps Script e crie os arquivos deste repositório
   (`Code.gs`, `Parcelas.gs`, `Caixa.gs` e `Index.html`).
3. Implante como Aplicativo da Web (Implantar > Nova implantação).
4. Abra o link no celular e adicione à tela inicial.

## Observações

- A fatura fecha no dia 10 (ajustável em `syncFatura_`).
- O `Parcelas.gs` altera o `Index.html` na hora de rodar, trocando trechos de texto.
  Se o `Index.html` mudar, alguma troca pode falhar (o aviso aparece em
  Execuções > Registros). Uma melhoria futura é juntar tudo no `Index.html`.
- A planilha real não está neste repositório, pois contém dados pessoais.
