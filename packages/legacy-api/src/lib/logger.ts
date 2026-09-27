import pino from "pino";

import config = require("../../config");

const logConfig = config("/log") as { level: string; pretty: boolean };

export const instance = pino({
  level: logConfig.level,
  ...(logConfig.pretty
    ? { transport: { target: "pino-pretty", options: { colorize: true } } }
    : {}),
});

export const info = (message: string, ...rest: unknown[]) => {
  instance.info(rest.length ? { rest } : {}, message);
};
export const warn = (message: string, ...rest: unknown[]) => {
  instance.warn(rest.length ? { rest } : {}, message);
};
export const error = (message: string, err?: unknown) => {
  instance.error({ err }, message);
};
