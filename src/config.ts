import { promises as fsp } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

const tokenPath = join(tmpdir(), 'gpt_web_token.json');
//包含配置相关的代码，包括获取和设置配置项等功能。

export const getConfig = async (initConfig: Record<string, any> = {}) => {
  let config: Record<string, any> = {} = {};
  try {
    if (await fsp.lstat(tokenPath)) {
      config = JSON.parse(await fsp.readFile(tokenPath, 'utf-8'));
    }
  } finally {
    Object.keys(initConfig).forEach((key) => {
      if (initConfig[key] !== undefined) {
        config[key] = initConfig[key];
      }
    });
    return config;
  }
};

export const setConfig = async (config) => {
  const oldConfig = await getConfig();
  fsp.writeFile(tokenPath, JSON.stringify({
    ...oldConfig,
    ...config,
  }));
};
