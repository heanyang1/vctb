import { evaluate, EvalCallbacks } from './eval.js';
import { NodeEnv } from './node.js';

const commandInput = document.getElementById('command-input') as HTMLInputElement | null;
const outputElement = document.getElementById('output') as HTMLElement | null;

const commandHistory: string[] = [];
let historyIndex = -1;
let currentCommand = '';

let env: NodeEnv | undefined = undefined;
let macros: Map<string, any> | undefined = undefined;

function addLine(text: string, className: string = ''): void {
  if (!outputElement) return;
  const line = document.createElement('div');
  line.className = `output-line ${className}`;
  line.textContent = text;
  outputElement.appendChild(line);
  outputElement.scrollTop = outputElement.scrollHeight;
}

function executeCommand(command: string): void {
  if (!command.trim()) return;

  if (commandHistory[commandHistory.length - 1] !== command) {
    commandHistory.push(command);
    if (commandHistory.length > 100) commandHistory.shift();
  }
  historyIndex = commandHistory.length;

  addLine(`❯ ${command}`, 'prompt-text');

  try {
    let output = '';
    let stdout = '';

    const result = evaluate(command, {
      writeOutput(text: string) {
        output += text;
      },
      writeStdout(text: string) {
        stdout += text;
      },
      writeGraph(text: string, _graphCount: number) {
        addLine(text, 'output');
      },
    }, env, macros);

    env = result.env;
    macros = result.macros;

    if (stdout) addLine(stdout, 'output');
    if (output) addLine(output, 'output');
  } catch (error) {
    addLine(`Error: ${error}`, 'error');
  }
}

if (commandInput) {
  commandInput.addEventListener('keydown', (e: KeyboardEvent) => {
    if (e.key === 'Enter') {
      const command = commandInput.value.trim();
      executeCommand(command);
      commandInput.value = '';
      currentCommand = '';
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      if (historyIndex > 0) {
        if (historyIndex === commandHistory.length) {
          currentCommand = commandInput.value;
        }
        historyIndex--;
        commandInput.value = commandHistory[historyIndex];
      }
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      if (historyIndex < commandHistory.length - 1) {
        historyIndex++;
        commandInput.value = commandHistory[historyIndex];
      } else if (historyIndex === commandHistory.length - 1) {
        historyIndex++;
        commandInput.value = currentCommand;
      }
    } else if (e.key === 'Tab') {
      e.preventDefault();
    } else if (e.key === 'l' && e.ctrlKey) {
      e.preventDefault();
      if (outputElement) outputElement.innerHTML = '';
    }
  });
}

addLine('Relic REPL - Type your Lisp expressions and press Enter to evaluate', 'output');
addLine('', 'output');

document.addEventListener('click', () => {
  commandInput?.focus();
});
