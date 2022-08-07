/*
 * @author: tisfeng
 * @createTime: 2022-08-05 16:09
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-08-07 18:04
 * @fileName: google.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios, { AxiosError, AxiosResponse } from "axios";
import querystring from "node:querystring";
import { requestCostTime } from "../axiosConfig";
import { userAgent } from "../consts";
import { checkIfPreferredLanguagesContainedChinese } from "../detectLanguage";
import { getLanguageItemFromYoudaoId } from "../language/languages";
import { RequestErrorInfo, RequestTypeResult, TranslationType } from "../types";

export async function requestGoogleTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string,
  signal: AbortSignal
): Promise<RequestTypeResult> {
  console.log(`---> start request Google`);
  // if has preferred Chinese language or ip in China, use cn, else use com.
  let tld = "com"; // cn,com
  if (checkIfPreferredLanguagesContainedChinese() || (await checkIfIpInChina())) {
    tld = "cn";
    console.log(`---> use cn, use Chinese: ${checkIfPreferredLanguagesContainedChinese()}`);
  }
  return googleCrawlerTranslate(queryText, fromLanguage, targetLanguage, tld, signal);
}

/**
 *  Check if ip is in China
 *
 *  Todo: should store ip in LocalStorage.
 */
async function checkIfIpInChina(): Promise<boolean> {
  try {
    const ipInfo = await getCurrentIpInfo();
    const country = ipInfo.country;
    console.warn(`---> country: ${country}`);
    return Promise.resolve(country === "CN");
  } catch (error) {
    console.error(`checkIfIpInChina error: ${error}`);
    return Promise.resolve(true);
  }
}

/**
 * Get current ip info
 * curl https://ipinfo.io
{
  "ip": "120.240.53.42",
  "city": "Zhanjiang",
  "region": "Guangdong",
  "country": "CN",
  "loc": "21.2339,110.3875",
  "org": "AS9808 China Mobile Communications Group Co., Ltd.",
  "timezone": "Asia/Shanghai",
  "readme": "https://ipinfo.io/missingauth"
}
 */
async function getCurrentIpInfo() {
  try {
    const url = "https://ipinfo.io";
    const res = await axios.get(url);
    console.warn(`---> ip info: ${JSON.stringify(res.data, null, 4)}, cost ${res.headers[requestCostTime]} ms`);
    return Promise.resolve(res.data);
  } catch (error) {
    console.error(`getCurrentIp error: ${error}`);
    return Promise.reject(error);
  }
}

/**
 * Use crawler to get Google Translate results.
 *
 * From https://github.com/roojay520/bobplugin-google-translate/blob/master/src/google-translate-mobile.ts
 */
async function googleCrawlerTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string,
  tld = "cn",
  signal: AbortSignal
): Promise<RequestTypeResult> {
  const fromLanguageItem = getLanguageItemFromYoudaoId(fromLanguage);
  const toLanguageItem = getLanguageItemFromYoudaoId(targetLanguage);
  const fromLanguageId = fromLanguageItem.googleLanguageId || fromLanguageItem.youdaoLanguageId;
  const toLanguageId = toLanguageItem.googleLanguageId || toLanguageItem.youdaoLanguageId;
  const data = {
    sl: fromLanguageId, // source language
    tl: toLanguageId, // target language
    hl: toLanguageId, // hope language? web ui language
    q: queryText,
  };

  const headers = {
    "User-Agent": userAgent,
  };
  const url = `https://translate.google.${tld}/m?${querystring.stringify(data)}`;
  console.log(`---> google url: ${url}`); // https://translate.google.cn/m?sl=auto&tl=zh-CN&hl=zh-CN&q=good
  const errorInfo: RequestErrorInfo = {
    type: TranslationType.Google,
    message: "Google translate error",
  };

  return new Promise<RequestTypeResult>((resolve, reject) => {
    axios
      .get(url, { headers, signal })
      .then((res: AxiosResponse) => {
        // Todo: use cheerio to parse html
        try {
          const resultRegex = /<div[^>]*?class="result-container"[^>]*>[\s\S]*?<\/div>/gi;
          let translation = resultRegex.exec(res.data)?.[0]?.replace(/(<\/?[^>]+>)/gi, "") ?? "";
          translation = decodeURI(translation);
          console.warn(`---> google result: ${translation}, cost: ${res.headers["requestCostTime"]}ms`);
          resolve({
            type: TranslationType.Google,
            result: { translatedText: translation },
            translations: [translation],
          });
        } catch (error) {
          console.error(`google translate error: ${error}`);
          reject(errorInfo);
        }
      })
      .catch((error: AxiosError) => {
        if (!error.response) {
          console.log(`---> caiyun cancelled`);
          return;
        }

        console.error(`google error: ${error}`);
        reject(errorInfo);
      });
  });
}

/**
 * Get current ip address
 */
export async function getCurrentIp(): Promise<string> {
  const url = "http://icanhazip.com/"; // from https://blog.csdn.net/uikoo9/article/details/113820051
  try {
    const res = await axios.get(url);
    const ip = res.data.trim();
    console.warn(`---> current ip: ${ip}, cost ${res.headers["requestCostTime"]} ms`);
    return Promise.resolve(ip);
  } catch (error) {
    console.error(`getCurrentIp error: ${error}`);
    return Promise.reject(error);
  }
}