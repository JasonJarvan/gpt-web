import { randomUUID } from 'crypto';
import assert from 'assert';
import Debug from 'debug';
import fetch from './fetch';
import * as types from './types.d';

const debug = Debug('gpt-web:chat');
//src/chat.ts：包含用于聊天的代码，包括发送消息、获取模型列表等功能。
export default class ChatGPT {
  private conversationId: string;
  private parentMessageId: string = randomUUID();
  constructor(
    readonly accessToken: string,
    readonly proxyUrl: string = 'https://ai.fakeopen.com/api/conversation',
  ) { }

  async sendMessage(
    text: string,
    opts: types.SendMessageBrowserOptions = {}
  ): Promise<types.ChatMessage> {
    const {
      timeout,
      action,
      model = 'gpt-3.5-turbo',
      onMessage,
    } = opts;

    let { abortSignal } = opts;

    let abortController: AbortController = null
    if (timeout && !abortSignal) {
      abortController = new AbortController();
      abortSignal = abortController.signal;
    }

    const messageId = randomUUID();
    const body: types.ConversationJSONBody = {
      action: action || 'next',
      messages: [
        {
          id: messageId,
          role: 'user',
          content: {
            content_type: 'text',
            parts: [text],
          },
        },
      ],
      model,
      parent_message_id: this.parentMessageId,
    }

    body.conversation_id = this.conversationId;

    const result: types.ChatMessage = {
      role: 'assistant',
      id: randomUUID(),
      parentMessageId: messageId,
      conversationId: this.conversationId,
      text: '',
    };
    this.parentMessageId = messageId;

    const responseP = new Promise<types.ChatMessage>(async (resolve, reject) => {
      const url = this.proxyUrl;
      const headers = {
        Authorization: `Bearer ${this.accessToken}`,
        Accept: 'text/event-stream',
        'Content-Type': 'application/json',
      };

      debug('start chat', url, JSON.stringify(body));
      try {
        const response = await fetch(
          url,
          {
            method: 'POST',
            headers,
            body: JSON.stringify(body),
            signal: abortSignal,
          },
        );

        assert(response.status === 200, `invalid response: ${response.status}`)

        let tid = setTimeout(() => {
          abortController?.abort('Timeout');
        }, timeout || 60000);

        const onProgress = (data: string) => {
          if (data === '[DONE]') {
            debug('text', result?.text);
            clearTimeout(tid);
            onMessage?.(result);
            return resolve(result)
          }
          try {
            const json: types.ConversationResponseEvent =
              JSON.parse(data);
            if (json.conversation_id) {
              result.conversationId = json.conversation_id;
              this.conversationId = result.conversationId;
            }

            if (json.message?.id) {
              result.id = json.message.id;
              this.parentMessageId = result.id;
            }

            const message = json.message;

            if (message && typeof message === 'object') {
              if (message.author.role !== 'assistant') {
                return;
              }
              let text = message?.content?.parts?.[0];

              if (text) {
                result.text = text;
                onMessage?.(result);
              }
            } else if (message) {
              reject(message);
            }
          } catch (err) { }
        }
        const textDecoder = new TextDecoder();
        // @ts-ignore
        if (response.body) {
          // @ts-ignore
          let chunks = [];
          for await (const chunk of response.body) {
            if (abortSignal?.aborted) throw abortSignal.reason;
            chunks.push(textDecoder.decode(chunk)); // chunk maybe more than one line
            if (chunk.at(-1) === 10) { // Read until the newline flag
              const messages = chunks.join('').split(/\n+/);
              chunks = [];
              for (const message of messages) {
                onProgress(message.slice(6));
              }
            }
          }
        }
      } catch (err) {
        debug('chat error', err);
        const errMessageL = err.toString().toLowerCase();

        if (
          result.text &&
          (errMessageL === 'error: typeerror: terminated' ||
            errMessageL === 'typeerror: terminated')
        ) {
          return resolve(result);
        } else {
          return reject(err);
        }
      }
    });

    return responseP;
  }

  async getModels() {
    const headers = {
      Authorization: `Bearer ${this.accessToken}`,
      Accept: 'text/event-stream',
      'Content-Type': 'application/json',
    };
    return fetch(`https://ai.fakeopen.com/api/models`, {
      headers,
    }).then(res => res.json())
  }
}