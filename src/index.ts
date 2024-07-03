import Auth from './auth2';
import { GPTOpts } from './types.d';
import ChatGPT from './chat';
//包含项目的入口文件，用于初始化聊天机器人和获取模型列表。
export default class ChatGPTWeb {
  accessToken: string = process.env.ACCESS_TOKEN;
  private chatbot: ChatGPT;
  constructor(readonly email: string, readonly password: string) {}
  private async init() {
    if (!this.chatbot) {
      if (!this.accessToken) {
        this.accessToken = await new Auth(this.email, this.password).getAccessToken();
      }
      this.chatbot = new ChatGPT(this.accessToken);
    }
  }
  async chat(input: string, options?: GPTOpts) {
    await this.init()
    const response = this.chatbot.sendMessage(input, {
      model: options.model,
      onMessage: (message) => {
        options?.onMessage?.(message.text);
      },
    }).catch(e => ({
      text: `${e}`,
    }));
    return (await response).text;
  }
  async getModels() {
    await this.init()
    return this.chatbot.getModels()
  }
}
