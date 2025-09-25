# Simulador - Microprocessador Didático

Este projeto é um simulador de um microprocessador didático de 8 bits, projetado para ser uma ferramenta educacional para o aprendizado de conceitos de arquitetura de computadores e programação em Assembly. 

A interface web interativa permite que os usuários escrevam ou carreguem código Assembly, montem ele em código de máquina hexadecimal, e executem o programa passo a passo ou continuamente, observando o estado dos registradores e da memória em tempo real.

## Visão Geral

O simulador é composto pelas seguintes seções principais:

* **Controles e Editor de Código:** Permite ao usuário controlar a execução do simulador (Step, Run, Reset) e inserir código em Assembly ou hexadecimal.
* **Registradores:** Exibe o estado atual de todos os registradores do microprocessador, incluindo o Acumulador (AC), Registradores de propósito geral (R0-R3), Contador de Programa (PC), Ponteiro de Pilha (SP), e flags como o Zero Flag (ZF). A interface também inclui switches de entrada (SW) para interação do usuário com o programa em execução.
* **Memória ROM e RAM:** Mostra o conteúdo da memória de programa (ROM) e da memória de dados (RAM). O usuário pode ver a instrução Assembly, seu correspondente em hexadecimal na ROM, e os valores armazenados na RAM.

## Funcionalidades

* **Montador Assembly:** Converte código Assembly escrito pelo usuário em código de máquina hexadecimal que o simulador pode executar. Suporta labels para saltos e chamadas.
* **Carregador Hexadecimal:** Permite carregar diretamente código de máquina em formato hexadecimal na ROM.
* **Execução Controlada:**
    * **Step:** Executa uma única instrução, destacando a instrução atual na tabela da ROM.
    * **Run:** Executa o programa continuamente com um pequeno intervalo entre as instruções.
    * **Reset:** Restaura o simulador ao seu estado inicial, limpando os registradores e a memória.
* **Visualização Interativa:**
    * O estado dos registradores e da memória é atualizado em tempo real.
    * Os valores dos registradores são exibidos tanto em hexadecimal quanto em formato de bits individuais.
    * Os switches de entrada (SW) podem ser ligados ou desligados com um clique para fornecer dados ao programa.
* **Exportação de ROM:** Permite exportar o conteúdo da ROM montada para um arquivo de texto no formato TDF (Table Definition File), útil para síntese em hardware (VHDL/Altera).

## Arquitetura e Conjunto de Instruções (ISA)

O microprocessador simulado possui uma arquitetura de 8 bits com os seguintes registradores:

* `AC`: Acumulador
* `RS`: Registrador de Saída
* `R0`, `R1`, `R2`, `R3`: Registradores de propósito geral
* `PC`: Contador de Programa
* `SP`: Ponteiro de Pilha
* `ZF`: Flag Zero

As instruções são codificadas em 16 bits, sendo os 5 bits mais significativos para o opcode e os 8 bits menos significativos para os operandos ou dados.

### Instruções Suportadas

| Mnemônico | Opcode | Operandos | Descrição |
| :--- | :--- | :--- | :--- |
| `ADD` | `0x00` | `Ra, Rb` | `Ra = Ra + Rb` |
| `SUB` | `0x01` | `Ra, Rb` | `Ra = Ra - Rb` |
| `INC` | `0x02` | `Ra` | `Ra = Ra + 1` |
| `DEC` | `0x03` | `Ra` | `Ra = Ra - 1` |
| `CPL` | `0x04` | `Ra` | `Ra = ~Ra` (Complemento bit a bit) |
| `AND` | `0x05` | `Ra, Rb` | `Ra = Ra & Rb` (AND bit a bit) |
| `OR` | `0x06` | `Ra, Rb` | `Ra = Ra \| Rb` (OR bit a bit) |
| `XOR` | `0x07` | `Ra, Rb` | `Ra = Ra ^ Rb` (XOR bit a bit) |
| `RR` | `0x08` | `Ra` | `Ra = Ra >> 1` (Deslocamento para a direita) |
| `RL` | `0x09` | `Ra` | `Ra = Ra << 1` (Deslocamento para a esquerda) |
| `CALL` | `0x16` | `Endereço/Label`| Chama uma sub-rotina no endereço especificado. |
| `RET` | `0x15` | `AC` | Retorna de uma sub-rotina para o valor armazenado em SP. |
| `JZ` | `0x18` | `Endereço/Label`| Salta para o endereço indicado se o resultado da última operação for zero. |
| `STORE` | `0x19` | `[Ra], Rb` | Armazena o valor do registrador `Rb` na posição indicada por `[Ra]` na RAM. |
| `LOAD` | `0x1A` | `Ra, [Rb]` | Carrega o valor da posição da RAM indicada por `[Rb]` no registrador `Ra`. |
| `OUT AC` | `0x1B` | `AC` | Envia o valor do Acumulador (`AC`) para a saída (`RS`). |
| `IN AC` | `0x1C` | `AC` | Carrega o valor dos switches (`SW`) para o Acumulador (`AC`). |
| `SET` | `0x1D` | `AC, valor` | `AC = valor` (Carrega valor hexadecimal imediato) |
| `JMP` | `0x1E` | `Endereço/Label`| Salta incondicionalmente para o endereço especificado. |
| `MOV` | `0x1F` | `Ra, Rb` | `Ra = Rb` (Move o valor de `Rb` para `Ra`) |

## Como Usar

1.  **Acesse o site [Simulador Microprocessador Didático](https://luk4w.github.io/mp-didatico/)** ou baixe o código e rode local.
2.  **Escreva seu código:** No "Editor de Código", digite seu programa em Assembly. Você pode usar o código de exemplo como ponto de partida.

    ```assembly
    ; Exemplo de programa:
    ; Mostra o primeiro valor da fila da memória RAM
    ; Cria uma fila nos endereços de 0x00 a 0x07 da memória RAM
    ; Insere o valor lido de SW[6..0] na última posição da fila, se e somente se, existir uma borda de subida em SW[7].
    
    INICIO:
        SET AC, 00
        LOAD R0, [AC]
        MOV AC, R0 
        OUT AC
        SET AC, 80 
        MOV R0, AC
    TESTA0:
        IN AC 
        AND AC, R0 
        JZ TESTA1 
        JMP TESTA0
    TESTA1:
        IN AC 
        MOV R3, AC
        AND AC, R0 
        JZ TESTA1
        SET AC, 08
        MOV R2, AC
        SET AC, 01
        MOV R1, AC
    FILA:
        MOV AC, R1
        DEC AC
        LOAD R0, [R1]
        STORE [AC], R0 
        INC R1 
        MOV AC, R1
        XOR AC, R2
        JZ INSERIR
        JMP FILA
    INSERIR:
        SET AC, 7F
        AND R3, AC
        SET AC, 07
        STORE [AC], R3 
        SET AC, 00
        MOV R1, AC	
        JMP INICIO
    ```
3.  **Monte o código:** Clique no botão **"Montar Assembly"**. O código será convertido para hexadecimal e carregado na memória ROM.
4.  **Execute:**
    * Clique em **"Step"** para executar o código instrução por instrução. Observe a linha destacada na tabela da ROM e as mudanças nos registradores.
    * Clique em **"Run"** para que o programa seja executado continuamente. O botão se tornará "Pause" para permitir a interrupção da execução.
5.  **Interaja com o programa:** Para instruções como `IN`, você pode clicar nos bits da seção "SW" para definir o valor de entrada antes da instrução ser executada.
6.  **Reset:** A qualquer momento, clique em **"Reset"** para reiniciar todo o simulador para seu estado padrão.
