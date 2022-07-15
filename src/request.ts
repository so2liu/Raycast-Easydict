import { deeplAuthKey } from "./crypto";
/*
 * @author: tisfeng
 * @createTime: 2022-06-26 11:13
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-15 11:52
 * @fileName: request.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import axios, { AxiosRequestConfig } from "axios";
import CryptoJS from "crypto-js";
import querystring from "node:querystring";
import * as tencentcloud from "tencentcloud-sdk-nodejs-tmt";
import { TranslateType } from "./consts";
import {
  baiduAppId,
  baiduAppSecret,
  caiyunToken,
  tencentSecretId,
  tencentSecretKey,
  youdaoAppId,
  youdaoAppSecret,
} from "./crypto";

import { LanguageDetectType, LanguageDetectTypeResult } from "./detectLanguage";
import {
  BaiduTranslateResult,
  CaiyunTranslateResult,
  RequestErrorInfo,
  TencentTranslateResult,
  TranslateTypeResult,
} from "./types";
import { getLanguageItemFromYoudaoId } from "./utils";

const tencentEndpoint = "tmt.tencentcloudapi.com";
const tencentRegion = "ap-guangzhou";
const tencentProjectId = 0;
const TmtClient = tencentcloud.tmt.v20180321.Client;

const clientConfig = {
  credential: {
    secretId: tencentSecretId,
    secretKey: tencentSecretKey,
  },
  region: tencentRegion,
  profile: {
    httpProfile: {
      endpoint: tencentEndpoint,
    },
  },
};
const client = new TmtClient(clientConfig);

/**
 * Caclulate axios request cost time
 */
export const requestCostTime = "x-request-cost";
axios.interceptors.request.use(function (config: AxiosRequestConfig) {
  if (config.headers) {
    config.headers["request-startTime"] = new Date().getTime();
  }
  return config;
});
axios.interceptors.response.use(function (response) {
  if (response.config.headers) {
    const startTime = response.config.headers["request-startTime"] as number;
    const endTime = new Date().getTime();
    response.headers[requestCostTime] = (endTime - startTime).toString();
  }
  return response;
});

/**
 * 腾讯语种识别，5次/秒
 * Docs: https://cloud.tencent.com/document/product/551/15620?cps_key=1d358d18a7a17b4a6df8d67a62fd3d3d
 */
export async function tencentLanguageDetect(text: string): Promise<LanguageDetectTypeResult> {
  const params = {
    Text: text,
    ProjectId: tencentProjectId,
  };
  const startTime = new Date().getTime();
  try {
    const response = await client.LanguageDetect(params);
    const endTime = new Date().getTime();
    console.warn(`tencent detect cost time: ${endTime - startTime} ms`);
    const typeResult = {
      type: LanguageDetectType.Tencent,
      youdaoLanguageId: response.Lang || "",
      confirmed: false,
    };
    return Promise.resolve(typeResult);
  } catch (err) {
    const error = err as { code: string; message: string };
    console.error(`tencent detect error, code: ${error.code}, message: ${error.message}`);
    const errorInfo: RequestErrorInfo = {
      type: TranslateType.Tencent,
      code: error.code,
      message: error.message,
    };
    return Promise.reject(errorInfo);
  }
}

/**
 * 腾讯文本翻译，5次/秒
 * Docs: https://console.cloud.tencent.com/api/explorer?Product=tmt&Version=2018-03-21&Action=TextTranslate&SignVersion=
 */
export async function requestTencentTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<TranslateTypeResult> {
  const from = getLanguageItemFromYoudaoId(fromLanguage).tencentLanguageId || "auto";
  const to = getLanguageItemFromYoudaoId(targetLanguage).tencentLanguageId;
  if (!to) {
    return Promise.reject(new Error("Target language is not supported by Tencent Translate"));
  }
  const params = {
    SourceText: queryText,
    Source: from,
    Target: to,
    ProjectId: tencentProjectId,
  };
  const startTime = new Date().getTime();

  try {
    const response = await client.TextTranslate(params);
    const endTime = new Date().getTime();
    console.log(`tencen translate: ${response.TargetText}, cost: ${endTime - startTime} ms`);
    const typeResult = {
      type: TranslateType.Tencent,
      result: response as TencentTranslateResult,
    };
    return Promise.resolve(typeResult);
  } catch (err) {
    const error = err as { code: string; message: string };
    console.error(`tencent translate error, code: ${error.code}, message: ${error.message}`);
    const errorInfo: RequestErrorInfo = {
      type: TranslateType.Tencent,
      code: error.code,
      message: error.message,
    };
    return Promise.reject(errorInfo);
  }
}

/**
 * 有道翻译
 * Docs: https://ai.youdao.com/DOCSIRMA/html/自然语言翻译/API文档/文本翻译服务/文本翻译服务-API文档.html
 */
export function requestYoudaoDictionary(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<TranslateTypeResult> {
  function truncate(q: string): string {
    const len = q.length;
    return len <= 20 ? q : q.substring(0, 10) + len + q.substring(len - 10, len);
  }

  const timestamp = Math.round(new Date().getTime() / 1000);
  const salt = timestamp;
  const sha256Content = youdaoAppId + truncate(queryText) + salt + timestamp + youdaoAppSecret;
  const sign = CryptoJS.SHA256(sha256Content).toString();
  const url = "https://openapi.youdao.com/api";
  const params = querystring.stringify({
    sign,
    salt,
    from: fromLanguage,
    signType: "v3",
    q: queryText,
    appKey: youdaoAppId,
    curtime: timestamp,
    to: targetLanguage,
  });

  return new Promise((resolve, reject) => {
    axios
      .post(url, params)
      .then((response) => {
        console.log(`---> youdao translate cost: ${response.headers[requestCostTime]} ms`);
        resolve({
          type: TranslateType.Youdao,
          result: response.data,
        });
      })
      .catch((error) => {
        // It seems that Youdao will never reject, always resolve...
        console.error(`youdao translate error: ${error}`);
        reject(error);
      });
  });
}

//
/**
 * 百度翻译API
 * Docs: https://fanyi-api.baidu.com/doc/21
 */
export function requestBaiduTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<TranslateTypeResult> {
  const salt = Math.round(new Date().getTime() / 1000);
  const md5Content = baiduAppId + queryText + salt + baiduAppSecret;
  const sign = CryptoJS.MD5(md5Content).toString();
  const url = "https://fanyi-api.baidu.com/api/trans/vip/translate";
  const from = getLanguageItemFromYoudaoId(fromLanguage).baiduLanguageId;
  const to = getLanguageItemFromYoudaoId(targetLanguage).baiduLanguageId;
  const encodeQueryText = Buffer.from(queryText, "utf8").toString();
  const params = {
    q: encodeQueryText,
    from: from,
    to: to,
    appid: baiduAppId,
    salt: salt,
    sign: sign,
  };
  return new Promise((resolve, reject) => {
    axios
      .get(url, { params })
      .then((response) => {
        const baiduResult = response.data as BaiduTranslateResult;
        if (baiduResult.trans_result) {
          const translateText = baiduResult.trans_result[0].dst;
          console.log(`baidu translate: ${translateText}, cost: ${response.headers[requestCostTime]} ms`);
          resolve({
            type: TranslateType.Baidu,
            result: baiduResult,
          });
        } else {
          console.error(`baidu translate error: ${JSON.stringify(baiduResult)}`);
          const errorInfo: RequestErrorInfo = {
            type: TranslateType.Baidu,
            code: baiduResult.error_code || "",
            message: baiduResult.error_msg || "",
          };
          reject(errorInfo);
        }
      })
      .catch((err) => {
        // It seems that Baidu will never reject, always resolve...
        console.error(`baidu translate error: ${err}`);
        reject(err);
      });
  });
}

/**
 * 彩云小译
 * Docs: https://open.caiyunapp.com/%E4%BA%94%E5%88%86%E9%92%9F%E5%AD%A6%E4%BC%9A%E5%BD%A9%E4%BA%91%E5%B0%8F%E8%AF%91_API
 */
export function requestCaiyunTextTranslate(
  queryText: string,
  fromLanguage: string,
  targetLanguage: string
): Promise<TranslateTypeResult> {
  const url = "https://api.interpreter.caiyunai.com/v1/translator";
  const from = getLanguageItemFromYoudaoId(fromLanguage).caiyunLanguageId || "auto";
  const to = getLanguageItemFromYoudaoId(targetLanguage).caiyunLanguageId;
  const trans_type = `${from}2${to}`; // "auto2xx";

  // Note that Caiyun Translate only supports these types of translation at present.
  const supportedTranslatType = ["zh2en", "zh2ja", "en2zh", "ja2zh"];
  if (!supportedTranslatType.includes(trans_type)) {
    console.log(`caiyun translate not support language: ${from} --> ${to}`);
    return Promise.resolve({
      type: TranslateType.Caiyun,
      result: null,
    });
  }

  const params = {
    source: queryText.split("\n"), // source can be text or array. if source is an array, it will be translated in parallel
    trans_type,
    detect: from === "auto",
  };
  const headers = {
    headers: {
      "content-type": "application/json",
      "x-authorization": "token " + caiyunToken,
    },
  };
  return new Promise((resolve, reject) => {
    axios
      .post(url, params, headers)
      .then((response) => {
        const caiyunResult = response.data as CaiyunTranslateResult;
        console.log(`caiyun translate: ${caiyunResult.target}, cost: ${response.headers[requestCostTime]} ms`);
        resolve({
          type: TranslateType.Caiyun,
          result: caiyunResult,
        });
      })
      .catch((error) => {
        const errorInfo: RequestErrorInfo = {
          type: TranslateType.Caiyun,
          code: error.response.status,
          message: error.response.statusText,
        };
        reject(errorInfo);
        console.error("caiyun error response: ", error.response);
      });
  });
}

const myRandomId = 11000056;

/**
 * 浏览器模拟
 {
  "jsonrpc": "2.0",
  "method": "LMT_handle_jobs",
  "params": {
    "jobs": [
      {
        "kind": "default",
        "sentences": [{ "text": "go", "id": 0, "prefix": "" }],
        "raw_en_context_before": [],
        "raw_en_context_after": [],
        "preferred_num_beams": 4
      }
    ],
    "lang": {
      "preference": { "weight": {}, "default": "default" },
      "source_lang_computed": "EN",
      "target_lang": "ZH"
    },
    "priority": 1,
    "commonJobParams": { "browserType": 1, "formality": null },
    "timestamp": 1657597450312
  },
  "id": 11000022
}
 */
export function requestDeepTextTranslate(queryText: string, fromLanguage: string, targetLanguage: string) {
  const url = "https://api-free.deepl.com/v2/translate";
  const params = querystring.stringify({
    auth_key: deeplAuthKey,
    text: queryText,
    target_lang: "ZH",
  });
  console.log(`---> params: ${params}`);

  axios
    .post(url, params)
    .then((response) => {
      console.log(
        `deepl translate post: ${JSON.stringify(response.data, null, 4)}, cost: ${response.headers[requestCostTime]} ms`
      );
    })
    .catch((error) => {
      console.error("deepl error response: ", error.response);
    });

  // axios({
  //   method: "post",
  //   url: url,
  //   data: params,
  // })
  //   .then((response) => {
  //     console.log(
  //       `deepl translate axios: ${JSON.stringify(response.data, null, 4)}, cost: ${
  //         response.headers[requestCostTime]
  //       } ms`
  //     );
  //   })
  //   .catch((error) => {
  //     console.error("deepl error response: ", error.response);
  //   });
}

/**
 现在我来告诉你，DeepL 到底是怎么认证的。（下面并不是 DeepL 客户端的代码，是我写的 Rust 利用代码，但逻辑不变）
```rust
fn gen_fake_timestamp(texts: &Vec<String>) -> u128 {
    let ts = tool::get_epoch_ms();
    let i_count = texts
            .iter()
            .fold(
                1, 
                |s, t| s + t.text.matches('i').count()
            ) as u128;
    ts - ts % i_count + i_count
}
```
哈哈！没想到吧！人家的时间戳不是真的！

DeepL 先计算了文本中所有 i 的数量，然后对真正的时间戳进行一个小小的运算 ts - ts % i_count + i_count，这个运算差不多仅会改变时间戳的毫秒部分，这个改变如果用人眼来验证根本无法发现，人类看来就是一个普通的时间戳，不会在意毫秒级的差别。

但是 DeepL 拿到这个修改后的时间戳，既可以与真实时间对比(误差毫秒级)，又可以通过简单的运算（是否是 i_count 的整倍数）判断是否是伪造的请求。真是精妙啊！
 */
function genFakeTimestamp(text: string) {
  let timestamp = Date.now();
  console.log(`timestamp: ${timestamp}`);
  // calculate i count
  let i_count = text.match("i")?.length ?? 0;
  i_count += 1;
  console.log(`i_count: ${i_count}`);
  timestamp = timestamp - (timestamp % i_count) + i_count;
  return timestamp;
}

/**
还有更绝的！你接着看：
```rust
let req = req.replace(
    "\"method\":\"",
    if (self.id + 3) % 13 == 0 || (self.id + 5) % 29 == 0 {
        "\"method\" : \""
    } else {
        "\"method\": \""
    },
);
```
怎么样？我觉得我一开始就被玩弄了，人家的 id 就是纯粹的随机数，只不过后续的请求会在第一次的随机 id 基础上加一，但是这个 id 还决定了文本中一个小小的、微不足道的空格。

按照正常的思路，为了方便人类阅读和分析，拿到请求的第一时间，我都会先扔编辑器里格式化一下 Json，我怎么会想到，这恰恰会破坏掉人家用来认证的特征，因此无论我如何努力都难以发现。
 */

function genFakeMethodParams(text: string, id: number) {
  // const method = (id + 3) % 13 == 0 || (id + 5) % 29 == 0 ? '"method" : "' : '"method": "';
  const method = (id + 3) % 13 == 0 || (id + 5) % 29 == 0 ? "method " : "method";

  return method;
}

/**
 * JSON 
  ```json
  {
    "jsonrpc": "2.0",
    "method": "LMT_handle_texts",
    "params": {
        "texts": [{
            "text": "translate this, my friend"
        }],
        "lang": {
            "target_lang": "ZH",
            "source_lang_user_selected": "EN",
        },
        "timestamp": 1648877491942
    },
    "id": 12345,
  }
```
 */
export function fakeDeeplTranslate(text: string) {
  const url = "https://www2.deepl.com/jsonrpc";
  // const randomId = Math.floor(Math.random() * 1000000);
  const randomId = myRandomId + 1;

  const fakeTimestamp = genFakeTimestamp(text);
  console.warn(`-----> timestamp: ${fakeTimestamp}`);
  const fakeMethod = genFakeMethodParams(text, randomId);
  console.warn(`-----> fakeMethod: ${fakeMethod}, length: ${fakeMethod.length}`);
  const params = {
    jsonrpc: "2.0",
    method: "LMT_split_into_sentences",
    params: {
      texts: [
        {
          text: text,
        },
      ],
      lang: {
        target_lang: "ZH",
        lang_user_selected: "EN",
      },
      timestamp: fakeTimestamp,
    },
    id: randomId,
  };
  console.log(`---> params: ${JSON.stringify(params, null, 4)}`);

  axios
    .post(url, params)
    .then((response) => {
      console.log(
        `deep translate: ${response.data.result.translations[0].text}, cost: ${response.headers[requestCostTime]} ms`
      );
      console.log(`deep translate: ${response.data}`);
    })
    .catch((error) => {
      console.error("deep error response: ", error.response);
    });
}
