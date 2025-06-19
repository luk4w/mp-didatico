document.addEventListener('DOMContentLoaded', () => {
    // === UI Element References ===
    const stepBtn = document.getElementById('stepBtn');
    const resetBtn = document.getElementById('resetBtn');
    const runBtn = document.getElementById('runBtn');
    const assembleBtn = document.getElementById('assembleBtn');
    const loadHexBtn = document.getElementById('loadHexBtn');
    const codeInput = document.getElementById('codeInput');
    const romTableBody = document.getElementById('romTableBody');
    const exportRomBtn = document.getElementById('exportRomBtn');
    const ramTableBody = document.getElementById('ramTableBody');
    const zfValSpan = document.getElementById('ZF');
    const swHexVal = document.getElementById('SWVal');

    // === Simulator State ===
    let registers = {};
    let ram = new Uint8Array(16);
    let rom = [];
    let running = false;
    let runInterval;
    let switchBitElements = [];

    const REG_NAMES = ['AC', 'RS', 'R0', 'R1', 'R2', 'R3', 'PC', 'SP'];
    const BIT_CONTAINER_IDS = ['SWBits', 'ACBits', 'RSBits', 'R0Bits', 'R1Bits', 'R2Bits', 'R3Bits', 'PCBits', 'SPBits'];

    // === Instruction Set Definitions ===
    const REGS = { R0: 0, R1: 1, R2: 2, R3: 3, AC: 4, PC: 5, IO: 6, SP: 7, ROM: 9, RAM: 10, NONE: 15 };
    const OPS = { ADD: 0x00, SUB: 0x01, INC: 0x02, DEC: 0x03, CPL: 0x04, AND: 0x05, OR: 0x06, XOR: 0x07, RR: 0x08, RL: 0x09, BYPASS_A: 0x0E, BYPASS_B: 0x0F, CALL: 0x16, RET: 0x15, JZ: 0x18, STORE: 0x19, LOAD: 0x1A, OUT: 0x1B, IN: 0x1C, SET: 0x1D, JMP: 0x1E, MOV: 0x1F };

    // === UI Update and Creation Functions ===
    function createBitElements() {
        BIT_CONTAINER_IDS.forEach(containerId => {
            const container = document.getElementById(containerId);
            if (!container) return;
            container.innerHTML = '';
            const elements = [];
            for (let i = 7; i >= 0; i--) {
                const bitEl = document.createElement('div');
                const isSwitch = (containerId === 'SWBits');
                bitEl.className = isSwitch ? 'switch-bit' : 'bit-box';
                bitEl.textContent = i;
                if (isSwitch) {
                    bitEl.addEventListener('click', () => {
                        bitEl.classList.toggle('on');
                        updateSwitchesHexValue();
                    });
                }
                container.appendChild(bitEl);
                elements.push(bitEl);
            }
            if (containerId === 'SWBits') {
                switchBitElements = elements;
            }
        });
    }

    function updateSwitchesHexValue() {
        let currentValue = 0;
        switchBitElements.forEach((bit, index) => {
            if (bit.classList.contains('on')) {
                currentValue |= (1 << (7 - index));
            }
        });
        if (swHexVal) swHexVal.textContent = currentValue.toString(16).toUpperCase().padStart(2, '0');
    }

    function updateBitDisplay(containerId, value) {
        const container = document.getElementById(containerId);
        if (!container || !container.children) return;
        Array.from(container.children).forEach((bitBox, index) => {
            const bitIndex = 7 - index;
            if ((value >> bitIndex) & 1) bitBox.classList.add('on');
            else bitBox.classList.remove('on');
        });
    }

    function updateRegisterDisplay(reg, value) {
        registers[reg] = value & 0xFF;
        const hexValue = registers[reg].toString(16).toUpperCase().padStart(2, '0');
        const valElement = document.getElementById(`${reg}Val`);
        if (valElement) valElement.textContent = hexValue;
        updateBitDisplay(`${reg}Bits`, registers[reg]);
    }

    function updateAllDisplays() {
        REG_NAMES.forEach(reg => {
            if (registers[reg] !== undefined) updateRegisterDisplay(reg, registers[reg]);
        });
        if (zfValSpan) zfValSpan.textContent = registers.ZF.toString(16).toUpperCase().padStart(2, '0');
        renderROM();
        renderRAM();
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

    // ================================================================
    // ASSEMBLER
    // ================================================================
    function parseInstruction(line, labelMap) {
        const originalLine = line.trim();
        line = originalLine.replace(/\[|\]/g, ' ');
        line = line.toUpperCase().split(';')[0].trim();
        if (!line) return null;
        const parts = line.split(/[\s,]+/);
        const mnemonic = parts[0];
        const op1 = parts[1];
        const op2 = parts[2];
        let opcodeHex = 0;
        let dataHex = 0;
        try {
            if (!OPS.hasOwnProperty(mnemonic)) throw new Error(`Mnemônico desconhecido: ${mnemonic}`);
            opcodeHex = OPS[mnemonic] << 8;
            switch (mnemonic) {
                case 'JMP': case 'JZ': case 'CALL':
                    if (labelMap[op1] !== undefined) { dataHex = labelMap[op1]; }
                    else { dataHex = parseInt(op1, 16); }
                    break;
                case 'LOAD': case 'STORE': case 'MOV': case 'ADD': case 'SUB': case 'AND': case 'OR': case 'XOR':
                    if (!REGS.hasOwnProperty(op1) || !REGS.hasOwnProperty(op2)) throw new Error(`Registrador inválido: ${op1} ou ${op2}`);
                    dataHex = (REGS[op1] << 4) | REGS[op2];
                    break;
                case 'SET':
                    const valueToSet = (op2 !== undefined) ? op2 : op1;
                    dataHex = parseInt(valueToSet, 16);
                    break;
                case 'INC': case 'DEC': case 'CPL': case 'RR': case 'RL':
                    if (!REGS.hasOwnProperty(op1)) throw new Error(`Registrador inválido: ${op1}`);
                    dataHex = (REGS[op1] << 4);
                    break;
                case 'IN': case 'OUT': case 'RET':
                    dataHex = 0;
                    break;
            }
            if (isNaN(dataHex)) throw new Error(`Operando ou Label inválido: '${op1}' ou '${op2}'`);
            return { text: originalLine, hex: opcodeHex | dataHex };
        } catch (e) {
            alert(`Erro na linha "${originalLine}": ${e.message}`);
            throw e;
        }
    }

    function assemble(code) {
        const lines = code.split('\n');
        const labelMap = {};
        const cleanCodeLines = [];
        let addressCounter = 0;
        lines.forEach(line => {
            const cleanLine = line.split(';')[0].trim();
            if (!cleanLine) return;
            if (cleanLine.endsWith(':')) {
                const labelName = cleanLine.slice(0, -1).toUpperCase();
                if (labelMap[labelName]) throw new Error(`Erro: Label '${labelName}' duplicado.`);
                labelMap[labelName] = addressCounter;
            } else {
                cleanCodeLines.push(line);
                addressCounter++;
            }
        });
        const newRom = [];
        cleanCodeLines.forEach(line => {
            const parsed = parseInstruction(line, labelMap);
            if (parsed) newRom.push(parsed);
        });
        return newRom;
    }

    // === Core Execution Logic ===
    function step() {
        if (rom.length === 0 || registers.PC >= rom.length) { if (running) runBtn.click(); return; }
        const instruction = rom[registers.PC];
        if (!instruction) { if (running) runBtn.click(); return; }
        const currentPC = registers.PC;
        let pcUpdated = false;
        const opcode = (instruction.hex >> 8) & 0x1F;
        const data = instruction.hex & 0xFF;
        let tempResult = 0;
        const destRegIdx = (data >> 4) & 0xF;
        const srcRegIdx = data & 0xF;
        const destKey = Object.keys(REGS).find(k => REGS[k] === destRegIdx);
        const srcKey = Object.keys(REGS).find(k => REGS[k] === srcRegIdx);
        switch (opcode) {
            case OPS.IN: let v = 0; switchBitElements.forEach((b, i) => { if (b.classList.contains('on')) v |= (1 << (7 - i)); }); registers.AC = v; break;
            case OPS.OUT: registers.RS = registers.AC; break;
            case OPS.MOV: if (destKey && srcKey) registers[destKey] = registers[srcKey]; break;
            case OPS.SET: registers.AC = data; break;
            case OPS.JMP: registers.PC = data; pcUpdated = true; break;
            case OPS.JZ: if (registers.ZF === 1) { registers.PC = data; pcUpdated = true; } break;
            case OPS.CALL: registers.SP = currentPC + 1; registers.PC = data; pcUpdated = true; break;
            case OPS.RET: registers.PC = registers.SP; pcUpdated = true; break;
            case OPS.LOAD: if (destKey && srcKey) registers[destKey] = ram[registers[srcKey]]; break;
            case OPS.STORE: if (destKey && srcKey) { ram[registers[destKey]] = registers[srcKey]; renderRAM(); } break;
            case OPS.ADD: if (destKey && srcKey) tempResult = registers[destKey] + registers[srcKey]; break;
            case OPS.SUB: if (destKey && srcKey) tempResult = registers[destKey] - registers[srcKey]; break;
            case OPS.INC: if (destKey) tempResult = registers[destKey] + 1; break;
            case OPS.DEC: if (destKey) tempResult = registers[destKey] - 1; break;
            case OPS.CPL: if (destKey) tempResult = ~registers[destKey]; break;
            case OPS.AND: if (destKey && srcKey) tempResult = registers[destKey] & registers[srcKey]; break;
            case OPS.OR: if (destKey && srcKey) tempResult = registers[destKey] | registers[srcKey]; break;
            case OPS.XOR: if (destKey && srcKey) tempResult = registers[destKey] ^ registers[srcKey]; break;
            case OPS.RR: if (destKey) tempResult = (registers[destKey] >> 1); break;
            case OPS.RL: if (destKey) tempResult = (registers[destKey] << 1); break;
        }
        if (opcode <= OPS.RL) {
            if (destKey) {
                registers[destKey] = tempResult & 0xFF;
                registers.ZF = (registers[destKey] === 0) ? 1 : 0;
            }
        }
        if (!pcUpdated) {
            registers.PC = currentPC + 1;
        }
        updateAllDisplays();
    }

    // === Initialization ===
    function initialize() {
        registers = { AC: 0, RS: 0, R0: 0, R1: 0, R2: 0, R3: 0, PC: 0, ZF: 0, SP: 0 };
        for (let i = 0; i < ram.length; i++) ram[i] = i + 0xA0;
        rom = [];
        running = false;
        if (runInterval) clearInterval(runInterval);
        runBtn.textContent = 'Run';
        createBitElements();
        updateAllDisplays();
        updateSwitchesHexValue();
    }

    // === Event Listeners ===
    stepBtn.addEventListener('click', step);
    resetBtn.addEventListener('click', initialize);
    runBtn.addEventListener('click', () => {
        running = !running;
        runBtn.textContent = running ? 'Pause' : 'Run';
        if (running) { runInterval = setInterval(step, 200); }
        else { clearInterval(runInterval); }
    });

    assembleBtn.addEventListener('click', () => {
        try {
            rom = assemble(codeInput.value);
            codeInput.value = '';
            registers.PC = 0;
            updateAllDisplays();
        } catch (error) {
            console.error("Falha na montagem do código:", error.message);
        }
    });

    function disassemble(hex) {
        const opcode = (hex >> 8) & 0x1F;
        const data = hex & 0xFF;

        const mnemonic = Object.keys(OPS).find(k => OPS[k] === opcode);
        if (!mnemonic) return `??? (0x${hex.toString(16)})`;

        const destRegIdx = (data >> 4) & 0xF;
        const srcRegIdx = data & 0xF;
        const destKey = Object.keys(REGS).find(k => REGS[k] === destRegIdx);
        const srcKey = Object.keys(REGS).find(k => REGS[k] === srcRegIdx);

        switch (mnemonic) {
            case 'JMP': case 'JZ': case 'CALL':
                return `${mnemonic} ${data.toString(16).toUpperCase().padStart(2, '0')}`;

            case 'LOAD':
                return `${mnemonic} ${destKey}, [${srcKey}]`;

            case 'STORE':
                return `${mnemonic} [${destKey}], ${srcKey}`;

            case 'MOV': case 'ADD': case 'SUB': case 'AND': case 'OR': case 'XOR':
                return `${mnemonic} ${destKey}, ${srcKey}`;

            case 'SET':
                return `SET AC, ${data.toString(16).toUpperCase().padStart(2, '0')}`;

            case 'INC': case 'DEC': case 'CPL': case 'RR': case 'RL':
                return `${mnemonic} ${destKey}`;

            case 'IN': case 'OUT': case 'RET':
                return `${mnemonic} AC`;

            default:
                return `${mnemonic} 0x${data.toString(16).toUpperCase().padStart(2, '0')}`;
        }
    }

    loadHexBtn.addEventListener('click', () => {
        const lines = codeInput.value.split('\n');
        const newRom = [];
        try {
            lines.forEach(line => {
                const cleanLine = line.trim();
                if (cleanLine === '') return; // Ignora linhas vazias

                const hexValue = parseInt(cleanLine, 16);
                if (isNaN(hexValue) || hexValue < 0 || hexValue > 0xFFFF) {
                    throw new Error(`Valor hexadecimal inválido na linha: "${cleanLine}"`);
                }

                newRom.push({
                    text: disassemble(hexValue),
                    hex: hexValue
                });
            });

            rom = newRom;
            codeInput.value = '';
            registers.PC = 0;
            updateAllDisplays();

        } catch (error) {
            alert(error.message);
        }
    });

    function exportRomAsTDF() {
        if (rom.length === 0) {
            alert("A ROM está vazia. Monte um código primeiro.");
            return;
        }
        let tdfString = "TABLE  Address [7..0] => REG_FF[].d;\n";
        rom.forEach((instruction, index) => {
            const addressHex = index.toString(16).toUpperCase().padStart(2, '0');
            const instructionHex = instruction.hex.toString(16).toUpperCase().padStart(4, '0');
            tdfString += `\t\tH"${addressHex}"    => H"${instructionHex}";\n`;
        });
        const lines = tdfString.trim().split('\n');
        tdfString = lines.join('\n') + '\n';
        tdfString += "\tEND TABLE;\n";

        const blob = new Blob([tdfString], { type: 'text/plain' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'rom_export.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
    }

    exportRomBtn.addEventListener('click', exportRomAsTDF);


    // === Initial Page Load ===
    initialize();
});