import * as readline from 'readline/promises'
import { stdin as input, stdout as output } from 'process'

//包含用于终端交互的代码，包括读取用户输入等功能。
export class RL {
  rl: ReturnType<typeof readline.createInterface>;
  constructor() {
    this.rl = readline.createInterface({
      input,
      output
    });
  }
  question = async (prompt: string) => {
    this.rl.setPrompt(prompt);
    this.rl.prompt(true);
    const lines = [];
    let closeTid: NodeJS.Timeout;
    for await (const input of this.rl) {
      clearTimeout(closeTid);
      closeTid = setTimeout(() => {
        if (input === '') {
          process.stdout.write('\n');
        }
        this.close();
      }, 500);
      lines.push(input);
    }
    return lines.join('\n');
  }
  close = () => {
    this.rl?.close();
    this.rl = null;
  }
}
