/*
 * @author: tisfeng
 * @createTime: 2022-07-25 22:10
 * @lastEditor: tisfeng
 * @lastEditTime: 2022-07-30 21:55
 * @fileName: types.ts
 *
 * Copyright (c) 2022 by tisfeng, All Rights Reserved.
 */

import { QueryWordInfo } from "../../types";

export interface LingueeDictionaryResult {
  queryWordInfo: QueryWordInfo;
  wordItems: LingueeWordItem[];
  examples: LingueeExample[];
  relatedWords: LingueeWordItem[];
  wikipedias: LingueeWikipedia[];
}

export interface LingueeWordItem {
  word: string;
  title: string;
  featured: boolean;
  pos: string; // part of speech, e.g. noun, verb, adj, etc.
  placeholder: string; // eg. (sth. ~), sth.
  audioUrl: string; // may have value when search English word, there are US and UK audio, we use US audio
  explanationItems: LingueeWordExplanation[];
}

export interface LingueeWordExplanation {
  featured?: boolean;
  explanation: string;
  pos: string;
  frequency: LingueeDisplayType; // AlmostAlways, OfenUsed, Common, LessCommon
  audioUrl: string; // may have value when search Chinese word
  tag: string; // (often used), (almost always used)
  examples: LingueeExample[]; // French: good
}

export interface LingueeExample {
  example: string;
  translation: string;
  pos: string;
}

export interface LingueeWikipedia {
  title: string;
  explanation: string;
  source: string;
  sourceUrl: string;
}

export enum LingueeDisplayType {
  AlmostAlways = "almost always used", // also featured, eg. true
  OftenUsed = "often used", // also featured, eg. good
  Common = "common", // also featured
  LessCommon = "less common", // unfeatured

  SpecialTag = "special tag", // a special tag, like often used, but we currently don't handle it. eg. good  English-French

  Unfeatured = "unfeatured",
  Example = "example",
  RelatedWord = "related word", // eg. 优雅, 美丽
  Wikipedia = "wikipedia", // eg. sql
}
