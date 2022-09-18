/*
 * @author: tisfeng
 * @createTime: 2022-09-17 10:35
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-09-18 18:25
 * @fileName: microsoft.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { LocalStorage } from "@raycast/api";
import axios, { AxiosRequestConfig } from "axios";
import qs from "qs";
import { checkIfIpInChina } from "../checkIP";
import { userAgent } from "../consts";
import { QueryWordInfo } from "../dictionary/youdao/types";
import { requestCostTime } from "./../axiosConfig";
import { isChineseIPKey } from "./../consts";

console.log(`enter microsoft.ts`);

const bingConfigKey = "BingConfig";

// * bing tld depends ip, if ip is in china, `must` use cn.bing.com, otherwise use www.bing.com. And vice versa.
let bingTld: string | undefined;
let bingConfig: BingConfig | undefined;

// First check user ip, then check if bing token expired, if expired, get a new one. else use the stored one as bingConfig.
LocalStorage.getItem<boolean>(isChineseIPKey).then((isChineseIP) => {
  if (isChineseIP !== undefined) {
    bingTld = getBingTld(isChineseIP);
    checkIfBingTokenExpired();
  }
});

interface BingConfig {
  IG: string; // F4D70DC299D549CE824BFCD7506749E7
  IID: string; // translator.5023
  key: string; // key is timestamp: 1663381745198
  token: string; // -2ptk6FgbTk2jgZWATe8L_VpY9A_niur
  expirationInterval: string; // 3600000, 10 min
  count: number; // current token request count, default is 1.
}

/**
 * Request Microsoft Bing Web Translator.
 */
export async function requestWebBingTranslate(queryWordInfo: QueryWordInfo) {
  console.log(`start requestWebBingTranslate`);

  const { fromLanguage, toLanguage, word } = queryWordInfo;
  console.log(`fromLanguage: ${fromLanguage}, toLanguage: ${toLanguage}, word: ${word}`);

  if (!bingConfig) {
    console.log(`no stored bingConfig, get a new one`);
    bingConfig = await requestBingConfig();
    if (!bingConfig) {
      console.error(`get bingConfig failed`);
      return;
    }
  }

  console.log(`request with bingConfig: ${JSON.stringify(bingConfig, null, 4)}`);
  const { IID, IG, key, token, count } = bingConfig;
  const requestCount = count + 1;
  bingConfig.count = requestCount;
  LocalStorage.setItem(bingConfigKey, JSON.stringify(bingConfig));

  // Todo: convert fromLanguage and toLanguage to bing language code.
  const data = {
    fromLang: "auto-detect",
    text: word,
    to: "zh-Hans",
    token: token,
    key: key,
  };
  console.log(`bing request data: ${JSON.stringify(data, null, 4)}`);

  const IIDString = `${IID}.${requestCount}`;

  if (!bingTld) {
    const isChineseIP = await checkIfIpInChina();
    bingTld = getBingTld(isChineseIP);
  }

  const url = `https://${bingTld}.bing.com/ttranslatev3?isVertical=1&IG=${IG}&IID=${IIDString}`;
  console.log(`bing url: ${url}`);

  const config: AxiosRequestConfig = {
    method: "post",
    url: url,
    headers: {
      "User-Agent": userAgent,
    },
    data: qs.stringify(data),
  };

  axios(config)
    .then(function (response) {
      const bingResult = response.data;
      console.log(`bing cost time: ${response.headers[requestCostTime]}`);
      console.warn(`bing translate response: ${JSON.stringify(bingResult, null, 4)}`);

      // If bing translate response is empty, may be ip has been changed, bing tld is not correct, so check ip again, then request again.
      if (!bingResult) {
        checkIfIpInChina().then((isIpInChina) => {
          bingTld = getBingTld(isIpInChina);
          console.log(`bing tld is changed to: ${bingTld}, try request bing again`);
          requestWebBingTranslate(queryWordInfo);
        });
      }
    })
    .catch(function (error) {
      console.error(`bing translate error: ${error}`);
    });
}

/**
 * Request Bing Translator API Token from web.
 *
 * Ref: https://github.com/plainheart/bing-translate-api/blob/master/src/index.js
 */
async function requestBingConfig(): Promise<BingConfig | undefined> {
  console.log(`start requestBingConfig`);

  // * tld should depends on user current IP.
  if (!bingTld) {
    const isChineseIP = await checkIfIpInChina();
    bingTld = getBingTld(isChineseIP);
  }

  return new Promise((resolve) => {
    const url = `https://${bingTld}.bing.com/translator`;
    console.log(`get bing config url: ${url}`);

    axios
      .get(url, { headers: { "User-Agent": userAgent } })
      .then((response) => {
        const config = parseBingConfig(response.data as string);
        console.log(`get bing config cost time: ${response.headers[requestCostTime]}`);

        if (config) {
          bingConfig = config;
          resolve(config);
          LocalStorage.setItem(bingConfigKey, JSON.stringify(config));
        } else {
          console.warn(`parse bing config failed`);
          checkIfIpInChina();
        }
      })
      .catch((error) => {
        console.error(`requestBingConfig error: ${error}`);
      });
  });
}

/**
 * Parse bing config from html.
 */
function parseBingConfig(html: string): BingConfig | undefined {
  // IG:"C064D2C8D4F84111B96C9F14E2F5CE07"
  const IG = html.match(/IG:"(.*?)"/)?.[1];
  // data-iid="translator.5023"
  const IID = html.match(/data-iid="(.*?)"/)?.[1];
  // var params_RichTranslateHelper = [1663259642763, "ETrbGhqGa5PwV8WL3sTYSBxsYRagh5bl", 3600000, true, null, false, "必应翻译", false, false, null, null];
  const params_RichTranslateHelper = html.match(/var params_RichTranslateHelper = (.*?);/)?.[1];
  if (IG && params_RichTranslateHelper) {
    const paramsArray = JSON.parse(params_RichTranslateHelper);
    const [key, token, tokenExpirationInterval] = paramsArray;
    const config: BingConfig = {
      IG: IG,
      IID: IID || "translator.5023",
      key: key,
      token: token,
      expirationInterval: tokenExpirationInterval,
      count: 1,
    };
    // console.log(`getBingConfig from web: ${JSON.stringify(config, null, 4)}`);

    bingConfig = config;
    LocalStorage.setItem(bingConfigKey, JSON.stringify(config));
    return config;
  }
}

/**
 * Check if token expired, if expired, get a new one. else use the stored one as bingConfig.
 */
function checkIfBingTokenExpired(): Promise<boolean> {
  console.log(`check if bing token expired`);
  return new Promise((resolve) => {
    LocalStorage.getItem<string>(bingConfigKey).then((value) => {
      if (!value) {
        requestBingConfig();
        return resolve(true);
      }

      // console.log(`stored bingConfig: ${JSON.stringify(value, null, 4)}`);
      const config = JSON.parse(value) as BingConfig;
      const { key, expirationInterval: tokenExpirationInterval } = config;
      const tokenStartTime = parseInt(key);
      const isExpired = Date.now() - tokenStartTime > parseInt(tokenExpirationInterval);
      if (isExpired) {
        requestBingConfig();
      } else {
        bingConfig = config;
      }
      resolve(isExpired);
    });
  });
}

/**
 * Get bing tld from ip.  Chinese ip, use cn.bing.com, otherwise use www.bing.com
 */
function getBingTld(isChineseIP: boolean): string {
  const tld = isChineseIP ? "cn" : "www";
  console.log(`get bing tld: ${tld}`);
  return tld;
}
