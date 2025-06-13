document.addEventListener('DOMContentLoaded', () => {
    // === UI Element References ===
    const stepBtn = document.getElementById('stepBtn');
    const resetBtn = document.getElementById('resetBtn');
    const runBtn = document.getElementById('runBtn');
    const addToRomBtn = document.getElementById('addToRomBtn');
    const codeInput = document.getElementById('codeInput');
    const romTableBody = document.getElementById('romTableBody');
    const ramTableBody = document.getElementById('ramTableBody');
    const zfVal = document.getElementById('ZF');

    // === Simulator State ===
    let registers = {};
    let ram = new Uint8Array(16);
    let rom = [];
    let running = false;
    let runInterval;

    const REG_NAMES = ['AC', 'RS', 'R0', 'R1', 'R2', 'R3', 'PC', 'SP'];

    // === Instruction Set Definitions (based on PDF) ===
    const REGS = {
        R0: 0, R1: 1, R2: 2, R3: 3, AC: 4, PC: 5, IO: 6, SP: 7,
        ROM: 9, RAM: 10, NONE: 15
    };
    const OPS = {
        ADD: 0x00, SUB: 0x01, INC: 0x02, DEC: 0x03, CPL: 0x04, AND: 0x05, OR: 0x06, XOR: 0x07,
        RR: 0x08, RL: 0x09, BYPASS_A: 0x0E, BYPASS_B: 0x0F,
        CALL: 0x16, RET: 0x17, JZ: 0x18, STORE: 0x19, LOAD: 0x1A, OUT: 0x1B,
        IN: 0x1C, SET: 0x1D, JMP: 0x1E, MOV: 0x1F
    };

    // === Initialization ===
    function initialize() {
        registers = { AC: 0, RS: 0, R0: 0, R1: 0, R2: 0, R3: 0, PC: 0, ZF: 0, SP: 0 };
        ram.fill(0);
        rom = [];
        running = false;
        clearInterval(runInterval);
        runBtn.textContent = 'Run';
        updateAllDisplays();
        romTableBody.innerHTML = '';
        renderRAM();
    }

    // === UI Update Functions ===
    function updateRegisterDisplay(reg, value) {
        registers[reg] = value & 0xFF; // Ensure 8-bit
        const hexValue = registers[reg].toString(16).toUpperCase().padStart(2, '0');
        document.getElementById(`${reg}Val`).textContent = hexValue;
        updateBitDisplay(`${reg}Bits`, registers[reg]);
    }

    function updateBitDisplay(containerId, value) {
        const container = document.getElementById(containerId);
        if (!container) return;
        container.innerHTML = '';
        for (let i = 7; i >= 0; i--) {
            const bitBox = document.createElement('div');
            bitBox.className = 'bit-box';
            bitBox.textContent = i;
            if ((value >> i) & 1) {
                bitBox.classList.add('on');
            }
            container.appendChild(bitBox);
        }
    }

    function updateAllDisplays() {
        REG_NAMES.forEach(reg => updateRegisterDisplay(reg, registers[reg]));
        zfVal.textContent = registers.ZF;
    }

    function renderROM() {
        romTableBody.innerHTML = '';
        rom.forEach((instr, index) => {
            const row = romTableBody.insertRow();
            if (index === registers.PC) row.classList.add('current-instruction');
            row.insertCell(0).textContent = index.toString(16).toUpperCase().padStart(2, '0');
            row.insertCell(1).textContent = instr.text;
            row.insertCell(2).textContent = instr.hex.toString(16).toUpperCase().padStart(4, '0');
        });
    }

    function renderRAM() {
        ramTableBody.innerHTML = '';
        for (let i = 0; i < ram.length; i++) {
            const row = ramTableBody.insertRow();
            row.insertCell(0).textContent = i.toString(16).toUpperCase();
            row.insertCell(1).textContent = ram[i].toString(16).toUpperCase().padStart(2, '0');
        }
    }

    // === Instruction Parser (CORRECTED) ===
    function parseInstruction(line) {
        line = line.trim().toUpperCase().split(';')[0];
        if (!line) return null;

        const parts = line.split(/[\s,]+/);
        const mnemonic = parts[0];
        const op1 = parts[1];
        const op2 = parts[2];

        let opcodeHex = 0;
        let dataHex = 0;

        try {
            switch (mnemonic) {
                case 'MOV':
                    opcodeHex = OPS.MOV << 8;
                    dataHex = (REGS[op1] << 4) | REGS[op2];
                    break;
                case 'SET':
                    // **CORRECTION**: Handles "SET <value>" and "SET AC, <value>"
                    // The value is taken from op2 if it exists, otherwise from op1.
                    opcodeHex = OPS.SET << 8;
                    const valueToSet = (op2 !== undefined) ? op2 : op1;
                    dataHex = parseInt(valueToSet, 16);
                    break;
                case 'JMP':
                case 'JZ':
                case 'CALL':
                    opcodeHex = OPS[mnemonic] << 8;
                    dataHex = parseInt(op1, 16);
                    break;
                case 'IN':
                case 'OUT':
                case 'RET':
                    opcodeHex = OPS[mnemonic] << 8;
                    break;
                case 'LOAD': // e.g., LOAD R1, [AC] -> R1 = RAM[AC]
                    opcodeHex = OPS.LOAD << 8;
                    dataHex = (REGS[op1] << 4);
                    break;
                case 'STORE': // e.g., STORE [AC], R0 -> RAM[AC] = R0
                    opcodeHex = OPS.STORE << 8;
                    dataHex = REGS[op2];
                    break;
                // ULA Instructions
                case 'INC':
                case 'DEC':
                case 'CPL': // NOT
                case 'RR':  // Rotate Right
                case 'RL':  // Rotate Left
                    opcodeHex = OPS[mnemonic] << 8;
                    dataHex = (REGS[op1] << 4) | REGS[op1];
                    break;
                case 'ADD':
                case 'SUB':
                case 'AND':
                case 'OR':
                case 'XOR':
                    opcodeHex = OPS[mnemonic] << 8;
                    dataHex = (REGS[op1] << 4) | REGS[op2];
                    break;
                default:
                    throw new Error(`Mnemônico desconhecido: ${mnemonic}`);
            }
             if (isNaN(dataHex)) throw new Error(`Operando inválido em: ${line}`);
            return { text: line, hex: opcodeHex | dataHex };
        } catch (e) {
            alert(`Erro ao processar a linha "${line}": ${e.message}`);
            return null;
        }
    }

    // === Core Execution Logic (No changes needed here for this fix) ===
    function step() {
        if (registers.PC >= rom.length) {
            if (running) {
                runBtn.click();
                console.log("Fim do programa.");
            }
            return;
        }

        const instruction = rom[registers.PC];
        const opcode = (instruction.hex >> 8) & 0x1F;
        const data = instruction.hex & 0xFF;
        let pcUpdated = false;
        let tempResult = 0;

        const destReg = (data >> 4) & 0xF;
        const srcReg = data & 0xF;
        const destKey = Object.keys(REGS).find(k => REGS[k] === destReg);
        const srcKey = Object.keys(REGS).find(k => REGS[k] === srcReg);

        switch (opcode) {
            case OPS.MOV:
                if (destKey && srcKey) registers[destKey] = registers[srcKey];
                break;
            case OPS.SET:
                registers.AC = data;
                break;
            case OPS.JMP:
                registers.PC = data;
                pcUpdated = true;
                break;
            case OPS.JZ:
                if (registers.ZF === 1) {
                    registers.PC = data;
                    pcUpdated = true;
                }
                break;
            case OPS.IN:
                const val = prompt("Digite um valor de 8-bit em hexadecimal para a entrada (SW):", "00");
                registers.AC = parseInt(val, 16) || 0;
                break;
            case OPS.OUT:
                registers.RS = registers.AC;
                break;
            case OPS.LOAD:
                if (destKey) registers[destKey] = ram[registers.AC];
                break;
            case OPS.STORE:
                if (srcKey) ram[registers.AC] = registers[srcKey];
                renderRAM();
                break;
            case OPS.CALL:
                registers.SP = registers.PC + 1;
                registers.PC = data;
                pcUpdated = true;
                break;
            case OPS.RET:
                registers.PC = registers.SP;
                pcUpdated = true;
                break;
            // ULA Operations
            case OPS.ADD:
                if (destKey && srcKey) tempResult = registers[destKey] + registers[srcKey];
                break;
            case OPS.SUB:
                if (destKey && srcKey) tempResult = registers[destKey] - registers[srcKey];
                break;
            case OPS.INC:
                if (destKey) tempResult = registers[destKey] + 1;
                break;
            case OPS.DEC:
                if (destKey) tempResult = registers[destKey] - 1;
                break;
            case OPS.CPL:
                if (destKey) tempResult = ~registers[destKey];
                break;
            case OPS.AND:
                if (destKey && srcKey) tempResult = registers[destKey] & registers[srcKey];
                break;
            case OPS.OR:
                if (destKey && srcKey) tempResult = registers[destKey] | registers[srcKey];
                break;
            case OPS.XOR:
                if (destKey && srcKey) tempResult = registers[destKey] ^ registers[srcKey];
                break;
            case OPS.RR:
                if (destKey) tempResult = (registers[destKey] >> 1);
                break;
            case OPS.RL:
                if (destKey) tempResult = (registers[destKey] << 1);
                break;
        }

        // Update destination register and flags for ULA ops
        if (opcode <= OPS.RL) {
            if (destKey) {
                registers[destKey] = tempResult & 0xFF;
                registers.ZF = (registers[destKey] === 0) ? 1 : 0;
            }
        }

        if (!pcUpdated) {
            registers.PC++;
        }

        updateAllDisplays();
        renderROM();
    }

    // === Event Listeners ===
    stepBtn.addEventListener('click', step);
    resetBtn.addEventListener('click', initialize);

    runBtn.addEventListener('click', () => {
        if (running) {
            clearInterval(runInterval);
            running = false;
            runBtn.textContent = 'Run';
        } else {
            running = true;
            runBtn.textContent = 'Pause';
            runInterval = setInterval(step, 200);
        }
    });

    addToRomBtn.addEventListener('click', () => {
        const lines = codeInput.value.split('\n');
        lines.forEach(line => {
            if (rom.length >= 256) {
                if (!window.romFullAlerted) {
                    alert("A memória ROM está cheia (256 posições)!");
                    window.romFullAlerted = true;
                }
                return;
            }
            const parsed = parseInstruction(line);
            if (parsed) {
                rom.push(parsed);
            }
        });
        window.romFullAlerted = false;
        codeInput.value = '';
        renderROM();
    });

    // === Initial Page Load ===
    initialize();
});